import { Router } from 'express';
import { z } from 'zod';
import { prisma, wsManager } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { TaskStatus, Priority } from '@prisma/client';

const router = Router();

// Validation schemas
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  requirements: z.string().min(10),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional()
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum([
    'TRIAGE', 'PLANNING', 'IN_PROGRESS', 
    'REVIEWING', 'APPROVED', 'COMPLETED', 
    'FAILED', 'CANCELLED'
  ]).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  triageNotes: z.string().optional()
});

// Get all tasks for the user
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, priority, limit = 50, offset = 0 } = req.query;

    const where: any = { userId: req.userId };
    if (status) where.status = status as TaskStatus;
    if (priority) where.priority = priority as Priority;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        workflowStages: {
          orderBy: { startedAt: 'desc' },
          take: 1
        },
        githubIntegration: true,
        _count: {
          select: {
            codeReviews: true,
            agenticLoops: true,
            approvalGates: { where: { status: 'PENDING' } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset)
    });

    const total = await prisma.task.count({ where });

    res.json({
      tasks,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific task
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      },
      include: {
        workflowStages: {
          orderBy: { startedAt: 'asc' }
        },
        triageQuestions: {
          orderBy: { askedAt: 'asc' }
        },
        agenticLoops: {
          orderBy: { iteration: 'asc' }
        },
        codeReviews: {
          orderBy: { createdAt: 'desc' }
        },
        approvalGates: {
          orderBy: { requestedAt: 'desc' }
        },
        githubIntegration: true
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

// Create a new task
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { title, requirements, priority = 'MEDIUM' } = CreateTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        userId: req.userId!,
        title,
        requirements,
        priority: priority as Priority,
        workflowStages: {
          create: {
            stage: 'TRIAGE',
            status: 'IN_PROGRESS',
            startedAt: new Date()
          }
        }
      },
      include: {
        workflowStages: true
      }
    });

    // Emit WebSocket event
    wsManager.emitToUser(req.userId!, 'task:created', task);
    wsManager.emitStageUpdate(task.id, 'TRIAGE', 'IN_PROGRESS');

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// Update a task
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const updates = UpdateTaskSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: updates,
      include: {
        workflowStages: true,
        githubIntegration: true
      }
    });

    // Emit WebSocket event
    wsManager.emitToUser(req.userId!, 'task:updated', updatedTask);

    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
});

// Delete a task
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({
      where: { id: req.params.id }
    });

    // Emit WebSocket event
    wsManager.emitToUser(req.userId!, 'task:deleted', { id: req.params.id });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get task progress/stages
router.get('/:id/progress', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const stages = await prisma.workflowStage.findMany({
      where: { taskId: req.params.id },
      orderBy: { startedAt: 'asc' }
    });

    const currentStage = stages.find(s => s.status === 'IN_PROGRESS');
    const completedStages = stages.filter(s => s.status === 'COMPLETED').length;
    const totalStages = 5; // Total workflow stages
    const progress = (completedStages / totalStages) * 100;

    res.json({
      currentStage: currentStage?.stage || null,
      completedStages,
      totalStages,
      progress: Math.round(progress),
      stages
    });
  } catch (error) {
    next(error);
  }
});

// Approve/reject a task at an approval gate
router.post('/:id/approve', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { gateId, approved, notes } = z.object({
      gateId: z.string(),
      approved: z.boolean(),
      notes: z.string().optional()
    }).parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const gate = await prisma.approvalGate.update({
      where: { id: gateId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        respondedAt: new Date(),
        approverNotes: notes
      }
    });

    // Emit WebSocket event
    wsManager.emitTaskUpdate({
      taskId: task.id,
      type: 'stage_update',
      stage: 'APPROVAL_GATE',
      status: approved ? 'APPROVED' : 'REJECTED',
      data: gate
    });

    res.json(gate);
  } catch (error) {
    next(error);
  }
});

export default router;