import { Router } from 'express';
import { z } from 'zod';
import { prisma, wsManager } from '../index';
import { authenticate, AuthRequest, requireApiKey } from '../middleware/auth';
import { OpenRouterClient, MODEL_PRESETS } from '../services/openrouter';
import { TriageAgent } from '../agents/triage';

const router = Router();

// Validation schemas
const StartTriageSchema = z.object({
  taskId: z.string()
});

const AnswerQuestionSchema = z.object({
  questionId: z.string(),
  answer: z.string().min(1)
});

// Start triage for a task
router.post('/start', authenticate, requireApiKey, async (req: AuthRequest, res, next) => {
  try {
    const { taskId } = StartTriageSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Initialize OpenRouter client with user's API key
    const openRouter = new OpenRouterClient(req.user.apiKey);
    const triageAgent = new TriageAgent(openRouter);

    // Start triage analysis
    wsManager.emitLog(taskId, 'Starting triage analysis...', 'info');
    
    const analysis = await triageAgent.analyzeRequirements(task.requirements);
    
    // Generate clarifying questions
    const questions = await triageAgent.generateQuestions(analysis);

    // Save questions to database
    const savedQuestions = await Promise.all(
      questions.map(q => 
        prisma.triageQuestion.create({
          data: {
            taskId,
            question: q.question,
            category: q.category,
            isRequired: q.isRequired || true
          }
        })
      )
    );

    // Update task with initial triage notes
    await prisma.task.update({
      where: { id: taskId },
      data: {
        triageNotes: JSON.stringify(analysis),
        status: 'TRIAGE'
      }
    });

    // Update workflow stage
    await prisma.workflowStage.upsert({
      where: { taskId_stage: { taskId, stage: 'TRIAGE' } },
      update: {
        status: 'WAITING_APPROVAL',
        metadata: JSON.stringify({ questionsCount: questions.length })
      },
      create: {
        taskId,
        stage: 'TRIAGE',
        status: 'WAITING_APPROVAL',
        startedAt: new Date(),
        metadata: JSON.stringify({ questionsCount: questions.length })
      }
    });

    wsManager.emitStageUpdate(taskId, 'TRIAGE', 'WAITING_APPROVAL', {
      questions: savedQuestions
    });

    res.json({
      analysis,
      questions: savedQuestions
    });
  } catch (error) {
    next(error);
  }
});

// Get triage questions for a task
router.get('/:taskId/questions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.taskId,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const questions = await prisma.triageQuestion.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { askedAt: 'asc' }
    });

    res.json(questions);
  } catch (error) {
    next(error);
  }
});

// Answer a triage question
router.post('/answer', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { questionId, answer } = AnswerQuestionSchema.parse(req.body);

    const question = await prisma.triageQuestion.findUnique({
      where: { id: questionId },
      include: { task: true }
    });

    if (!question || question.task.userId !== req.userId) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const updatedQuestion = await prisma.triageQuestion.update({
      where: { id: questionId },
      data: {
        answer,
        answeredAt: new Date()
      }
    });

    // Check if all required questions are answered
    const allQuestions = await prisma.triageQuestion.findMany({
      where: {
        taskId: question.taskId,
        isRequired: true
      }
    });

    const allAnswered = allQuestions.every(q => q.answer);

    if (allAnswered) {
      // Move to next stage
      await prisma.workflowStage.update({
        where: { taskId_stage: { taskId: question.taskId, stage: 'TRIAGE' } },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      await prisma.workflowStage.create({
        data: {
          taskId: question.taskId,
          stage: 'TASK_CREATION',
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      });

      wsManager.emitComplete(question.taskId, 'TRIAGE');
      wsManager.emitStageUpdate(question.taskId, 'TASK_CREATION', 'IN_PROGRESS');
    }

    wsManager.emitTaskUpdate({
      taskId: question.taskId,
      type: 'progress',
      message: `Question answered: ${question.question}`,
      data: { question: updatedQuestion }
    });

    res.json(updatedQuestion);
  } catch (error) {
    next(error);
  }
});

// Complete triage and create task plan
router.post('/:taskId/complete', authenticate, requireApiKey, async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.taskId,
        userId: req.userId
      },
      include: {
        triageQuestions: true
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const openRouter = new OpenRouterClient(req.user.apiKey);
    const triageAgent = new TriageAgent(openRouter);

    // Generate task plan based on requirements and answers
    wsManager.emitLog(task.id, 'Generating task plan...', 'info');
    
    const plan = await triageAgent.createTaskPlan(
      task.requirements,
      task.triageNotes ? JSON.parse(task.triageNotes) : {},
      task.triageQuestions
    );

    // Update task with plan
    await prisma.task.update({
      where: { id: task.id },
      data: {
        triageNotes: JSON.stringify(plan),
        status: 'PLANNING'
      }
    });

    // Complete triage stage
    await prisma.workflowStage.update({
      where: { taskId_stage: { taskId: task.id, stage: 'TRIAGE' } },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: JSON.stringify({ plan })
      }
    });

    // Start task creation stage
    await prisma.workflowStage.create({
      data: {
        taskId: task.id,
        stage: 'TASK_CREATION',
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    });

    wsManager.emitComplete(task.id, 'TRIAGE', { plan });
    wsManager.emitStageUpdate(task.id, 'TASK_CREATION', 'IN_PROGRESS');

    res.json({ plan });
  } catch (error) {
    next(error);
  }
});

export default router;