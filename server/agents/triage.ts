import { OpenRouterClient, OpenRouterMessage } from '../services/openrouter';

export interface TriageAnalysis {
  summary: string;
  technicalRequirements: string[];
  functionalRequirements: string[];
  constraints: string[];
  assumptions: string[];
  risks: string[];
  suggestedApproach: string;
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  requiresClarification: boolean;
}

export interface TriageQuestion {
  question: string;
  category: string;
  context?: string;
  isRequired: boolean;
  possibleAnswers?: string[];
}

export interface TaskPlan {
  overview: string;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    dependencies: string[];
    estimatedEffort: string;
    acceptanceCriteria: string[];
  }>;
  technicalDecisions: Array<{
    decision: string;
    rationale: string;
    alternatives?: string[];
  }>;
  resources: {
    tools: string[];
    libraries: string[];
    apis: string[];
  };
}

export class TriageAgent {
  constructor(private openRouter: OpenRouterClient) {}

  async analyzeRequirements(requirements: string): Promise<TriageAnalysis> {
    const systemPrompt = `You are an expert software architect analyzing user requirements.
    Analyze the given requirements and provide a structured analysis including:
    - Technical and functional requirements breakdown
    - Constraints and assumptions
    - Potential risks
    - Suggested technical approach
    - Complexity assessment
    - Whether clarification is needed`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Analyze these requirements and provide a JSON response:\n\n${requirements}` 
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.3,
      maxTokens: 2000
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      // Fallback to structured extraction
      return this.extractAnalysis(response.choices[0].message.content);
    }
  }

  async generateQuestions(analysis: TriageAnalysis): Promise<TriageQuestion[]> {
    if (!analysis.requiresClarification) {
      return [];
    }

    const systemPrompt = `You are an expert requirements analyst.
    Based on the analysis, generate clarifying questions that will help:
    1. Remove ambiguity from requirements
    2. Understand technical constraints
    3. Define scope boundaries
    4. Identify integration points
    5. Clarify user expectations
    
    Questions should be specific, actionable, and help in implementation.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Generate clarifying questions for this analysis:\n${JSON.stringify(analysis, null, 2)}\n\nReturn as JSON array of questions.` 
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.4,
      maxTokens: 2000
    });

    try {
      const questions = JSON.parse(response.choices[0].message.content);
      return questions.map((q: any) => ({
        question: q.question || q,
        category: q.category || 'general',
        context: q.context,
        isRequired: q.isRequired !== false,
        possibleAnswers: q.possibleAnswers
      }));
    } catch (error) {
      // Fallback to basic questions
      return this.generateBasicQuestions(analysis);
    }
  }

  async createTaskPlan(
    requirements: string,
    analysis: TriageAnalysis,
    answeredQuestions: any[]
  ): Promise<TaskPlan> {
    const systemPrompt = `You are an expert software architect creating a detailed implementation plan.
    Create a comprehensive task plan that includes:
    1. Clear implementation steps with dependencies
    2. Technical decisions and rationale
    3. Required resources and tools
    4. Acceptance criteria for each step
    
    The plan should be actionable and guide the implementation process.`;

    const context = {
      requirements,
      analysis,
      clarifications: answeredQuestions.filter(q => q.answer).map(q => ({
        question: q.question,
        answer: q.answer
      }))
    };

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Create a detailed task plan based on:\n${JSON.stringify(context, null, 2)}\n\nReturn as JSON.` 
      }
    ];

    const response = await this.openRouter.complete(messages, {
      temperature: 0.2,
      maxTokens: 4000
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      // Fallback to basic plan
      return this.createBasicPlan(requirements, analysis);
    }
  }

  private extractAnalysis(content: string): TriageAnalysis {
    // Basic extraction logic as fallback
    return {
      summary: content.slice(0, 200),
      technicalRequirements: ['Extracted from content'],
      functionalRequirements: ['Extracted from content'],
      constraints: [],
      assumptions: [],
      risks: [],
      suggestedApproach: 'Standard implementation',
      estimatedComplexity: 'MEDIUM',
      requiresClarification: true
    };
  }

  private generateBasicQuestions(analysis: TriageAnalysis): TriageQuestion[] {
    const questions: TriageQuestion[] = [];

    if (analysis.technicalRequirements.length > 0) {
      questions.push({
        question: 'What is the expected scale and performance requirements?',
        category: 'technical',
        isRequired: true
      });
    }

    if (analysis.functionalRequirements.length > 0) {
      questions.push({
        question: 'Who are the primary users and what are their main workflows?',
        category: 'functional',
        isRequired: true
      });
    }

    questions.push({
      question: 'What is the timeline for this implementation?',
      category: 'scope',
      isRequired: false
    });

    questions.push({
      question: 'Are there any existing systems this needs to integrate with?',
      category: 'integration',
      isRequired: true
    });

    return questions;
  }

  private createBasicPlan(requirements: string, analysis: TriageAnalysis): TaskPlan {
    return {
      overview: `Implementation plan for: ${analysis.summary}`,
      steps: [
        {
          id: 'step1',
          title: 'Setup and Configuration',
          description: 'Initialize project and configure environment',
          dependencies: [],
          estimatedEffort: '2 hours',
          acceptanceCriteria: ['Project structure created', 'Dependencies installed']
        },
        {
          id: 'step2',
          title: 'Core Implementation',
          description: 'Implement main functionality',
          dependencies: ['step1'],
          estimatedEffort: '8 hours',
          acceptanceCriteria: ['Core features working', 'Tests passing']
        },
        {
          id: 'step3',
          title: 'Testing and Refinement',
          description: 'Test and refine implementation',
          dependencies: ['step2'],
          estimatedEffort: '4 hours',
          acceptanceCriteria: ['All tests passing', 'Code reviewed']
        }
      ],
      technicalDecisions: [
        {
          decision: 'Use standard architecture',
          rationale: 'Based on requirements analysis'
        }
      ],
      resources: {
        tools: ['Git', 'IDE'],
        libraries: ['Framework libraries'],
        apis: []
      }
    };
  }
}