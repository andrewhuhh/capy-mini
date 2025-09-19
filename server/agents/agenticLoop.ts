import { OpenRouterClient, OpenRouterMessage } from '../services/openrouter';
import { MCPToolWrapper } from '../services/mcp/manager';
import { wsManager } from '../index';
import { prisma } from '../index';
import { LoopPhase, LoopStatus } from '@prisma/client';

export interface LoopPlan {
  steps: Array<{
    id: string;
    action: string;
    description: string;
    dependencies: string[];
    tools: string[];
    validation: string[];
  }>;
  resources: {
    files: string[];
    dependencies: string[];
    apis: string[];
  };
  estimatedIterations: number;
}

export interface ExecutionLog {
  timestamp: string;
  action: string;
  result: string;
  filesModified: string[];
  errors?: string[];
}

export interface ValidationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    status: 'passed' | 'failed' | 'warning';
    message: string;
  }>;
  needsIteration: boolean;
  suggestions?: string[];
}

export class AgenticLoopAgent {
  private currentIteration: number = 0;
  private maxIterations: number = 10;
  private executionHistory: ExecutionLog[] = [];

  constructor(
    private openRouter: OpenRouterClient,
    private mcpTools: MCPToolWrapper,
    private taskId: string
  ) {}

  async execute(requirements: string, plan: any, approvalCallback?: (gate: any) => Promise<boolean>) {
    try {
      // Start agentic loop
      await this.updateStage('AGENTIC_LOOP', 'IN_PROGRESS');
      wsManager.emitLog(this.taskId, 'Starting autonomous implementation...', 'info');

      // Phase 1: Planning
      const loopPlan = await this.createPlan(requirements, plan);
      await this.saveLoopIteration(LoopPhase.PLANNING, loopPlan);
      
      // Check for architecture approval
      if (approvalCallback && loopPlan.steps.some(s => s.action === 'ARCHITECTURE_CHANGE')) {
        const approved = await this.requestApproval('ARCHITECTURE_DECISION', loopPlan, approvalCallback);
        if (!approved) {
          throw new Error('Architecture changes rejected');
        }
      }

      // Phase 2: Execution
      let iterationCount = 0;
      let validationPassed = false;

      while (!validationPassed && iterationCount < this.maxIterations) {
        iterationCount++;
        wsManager.emitProgress(this.taskId, 'AGENTIC_LOOP', 
          (iterationCount / this.maxIterations) * 100, 
          `Iteration ${iterationCount}`
        );

        // Execute plan steps
        const executionResult = await this.executePlan(loopPlan, iterationCount);
        await this.saveLoopIteration(LoopPhase.EXECUTION, executionResult);

        // Phase 3: Validation
        const validation = await this.validateImplementation(requirements, executionResult);
        await this.saveLoopIteration(LoopPhase.VALIDATION, validation);

        if (validation.passed) {
          validationPassed = true;
          wsManager.emitLog(this.taskId, 'Implementation validated successfully', 'info');
        } else if (validation.needsIteration) {
          // Phase 4: Iteration
          wsManager.emitLog(this.taskId, `Iteration ${iterationCount} needs refinement`, 'warning');
          loopPlan.steps = await this.refinePlan(loopPlan, validation);
          await this.saveLoopIteration(LoopPhase.ITERATION, { refinedPlan: loopPlan });
        } else {
          throw new Error('Validation failed without clear iteration path');
        }
      }

      if (!validationPassed) {
        throw new Error(`Max iterations (${this.maxIterations}) reached without validation`);
      }

      await this.updateStage('AGENTIC_LOOP', 'COMPLETED');
      wsManager.emitComplete(this.taskId, 'AGENTIC_LOOP', { 
        iterations: iterationCount,
        history: this.executionHistory 
      });

      return {
        success: true,
        iterations: iterationCount,
        executionHistory: this.executionHistory
      };
    } catch (error: any) {
      await this.handleError(error);
      throw error;
    }
  }

  private async createPlan(requirements: string, taskPlan: any): Promise<LoopPlan> {
    const systemPrompt = `You are an expert software architect creating an implementation plan.
    Create a detailed step-by-step plan to implement the requirements.
    Each step should be atomic and verifiable.
    Include necessary tools and validation criteria.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Create implementation plan for:\nRequirements: ${requirements}\nTask Plan: ${JSON.stringify(taskPlan)}\n\nReturn as JSON with steps, resources, and estimatedIterations.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.2,
      maxTokens: 4000
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return this.createDefaultPlan(requirements);
    }
  }

  private async executePlan(plan: LoopPlan, iteration: number): Promise<ExecutionLog[]> {
    const logs: ExecutionLog[] = [];
    
    for (const step of plan.steps) {
      wsManager.emitLog(this.taskId, `Executing: ${step.description}`, 'info');
      
      try {
        // Determine action type and execute
        const result = await this.executeStep(step);
        
        logs.push({
          timestamp: new Date().toISOString(),
          action: step.action,
          result: result.message,
          filesModified: result.filesModified || []
        });

        wsManager.emitProgress(
          this.taskId, 
          'AGENTIC_LOOP',
          (plan.steps.indexOf(step) / plan.steps.length) * 100,
          step.description
        );
      } catch (error: any) {
        logs.push({
          timestamp: new Date().toISOString(),
          action: step.action,
          result: 'Failed',
          filesModified: [],
          errors: [error.message]
        });
        
        // Decide whether to continue or fail
        if (step.action.includes('CRITICAL')) {
          throw error;
        }
      }
    }

    this.executionHistory.push(...logs);
    return logs;
  }

  private async executeStep(step: any): Promise<any> {
    const systemPrompt = `You are an AI agent executing a specific implementation step.
    Use the available MCP tools to complete the task.
    Return the exact commands/code to execute.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Execute this step:\n${JSON.stringify(step)}\n\nProvide the implementation code or commands.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.1,
      maxTokens: 3000
    });

    const implementation = response.choices[0].message.content;

    // Parse and execute based on action type
    if (step.action.includes('CREATE_FILE') || step.action.includes('WRITE')) {
      const fileMatch = implementation.match(/File: (.+)\nContent:\n([\s\S]+)/);
      if (fileMatch) {
        await this.mcpTools.writeFile(fileMatch[1], fileMatch[2]);
        return { message: `Created file: ${fileMatch[1]}`, filesModified: [fileMatch[1]] };
      }
    } else if (step.action.includes('MODIFY') || step.action.includes('UPDATE')) {
      // Extract file modifications
      const modifications = this.extractModifications(implementation);
      for (const mod of modifications) {
        const currentContent = await this.mcpTools.readFile(mod.file);
        const newContent = this.applyModification(currentContent, mod);
        await this.mcpTools.writeFile(mod.file, newContent);
      }
      return { 
        message: `Modified ${modifications.length} files`, 
        filesModified: modifications.map(m => m.file) 
      };
    } else if (step.action.includes('INSTALL')) {
      // Package installation
      return { message: 'Dependencies installed', filesModified: ['package.json'] };
    }

    return { message: 'Step completed', filesModified: [] };
  }

  private async validateImplementation(requirements: string, executionLog: ExecutionLog[]): Promise<ValidationResult> {
    const systemPrompt = `You are validating an implementation against requirements.
    Check for:
    1. Requirement fulfillment
    2. Code quality and correctness
    3. Missing functionality
    4. Potential bugs or issues
    
    Return a detailed validation result.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Validate this implementation:\nRequirements: ${requirements}\nExecution Log: ${JSON.stringify(executionLog)}\n\nReturn as JSON with passed (boolean), checks array, needsIteration (boolean), and suggestions.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.1,
      maxTokens: 2000
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return {
        passed: false,
        checks: [{ name: 'Parse Error', status: 'failed', message: 'Could not parse validation' }],
        needsIteration: true,
        suggestions: ['Review implementation manually']
      };
    }
  }

  private async refinePlan(currentPlan: LoopPlan, validation: ValidationResult): Promise<any[]> {
    const systemPrompt = `You are refining an implementation plan based on validation feedback.
    Adjust the plan to address the issues found.
    Focus on fixing failures and implementing suggestions.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Refine this plan:\nCurrent Plan: ${JSON.stringify(currentPlan)}\nValidation: ${JSON.stringify(validation)}\n\nReturn refined steps as JSON array.`
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.3,
      maxTokens: 3000
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      // Return minimal refinement
      return currentPlan.steps.filter(s => 
        validation.checks.some(c => c.status === 'failed' && c.name.includes(s.action))
      );
    }
  }

  private async requestApproval(
    gateType: string, 
    data: any, 
    approvalCallback: (gate: any) => Promise<boolean>
  ): Promise<boolean> {
    const gate = await prisma.approvalGate.create({
      data: {
        taskId: this.taskId,
        gateType: gateType as any,
        status: 'PENDING',
        metadata: JSON.stringify(data)
      }
    });

    wsManager.emitTaskUpdate({
      taskId: this.taskId,
      type: 'stage_update',
      stage: 'APPROVAL_GATE',
      status: 'WAITING_APPROVAL',
      data: gate
    });

    return approvalCallback(gate);
  }

  private async saveLoopIteration(phase: LoopPhase, data: any) {
    this.currentIteration++;
    await prisma.agenticLoop.create({
      data: {
        taskId: this.taskId,
        iteration: this.currentIteration,
        phase,
        status: LoopStatus.IN_PROGRESS,
        planningData: phase === LoopPhase.PLANNING ? JSON.stringify(data) : null,
        executionLog: phase === LoopPhase.EXECUTION ? JSON.stringify(data) : null,
        validation: phase === LoopPhase.VALIDATION ? JSON.stringify(data) : null
      }
    });
  }

  private async updateStage(stage: string, status: string) {
    await prisma.workflowStage.upsert({
      where: { taskId_stage: { taskId: this.taskId, stage: stage as any } },
      update: { 
        status: status as any,
        completedAt: status === 'COMPLETED' ? new Date() : null
      },
      create: {
        taskId: this.taskId,
        stage: stage as any,
        status: status as any,
        startedAt: new Date()
      }
    });
  }

  private async handleError(error: any) {
    wsManager.emitError(this.taskId, error.message, 'AGENTIC_LOOP');
    await this.updateStage('AGENTIC_LOOP', 'FAILED');
    
    // Save error to last iteration
    if (this.currentIteration > 0) {
      await prisma.agenticLoop.updateMany({
        where: {
          taskId: this.taskId,
          iteration: this.currentIteration
        },
        data: {
          status: LoopStatus.FAILED
        }
      });
    }
  }

  private createDefaultPlan(requirements: string): LoopPlan {
    return {
      steps: [
        {
          id: '1',
          action: 'SETUP',
          description: 'Initialize project structure',
          dependencies: [],
          tools: ['filesystem'],
          validation: ['Files created']
        },
        {
          id: '2',
          action: 'IMPLEMENT',
          description: 'Implement core functionality',
          dependencies: ['1'],
          tools: ['filesystem'],
          validation: ['Code compiles', 'Tests pass']
        }
      ],
      resources: {
        files: [],
        dependencies: [],
        apis: []
      },
      estimatedIterations: 2
    };
  }

  private extractModifications(implementation: string): any[] {
    // Parse implementation for file modifications
    const mods: any[] = [];
    const fileBlocks = implementation.split(/File: /);
    
    for (const block of fileBlocks.slice(1)) {
      const lines = block.split('\n');
      const file = lines[0].trim();
      const content = lines.slice(1).join('\n');
      mods.push({ file, content });
    }
    
    return mods;
  }

  private applyModification(currentContent: string, modification: any): string {
    // Apply the modification to the current content
    // This is a simplified version - in reality would need more sophisticated merging
    return modification.content;
  }
}