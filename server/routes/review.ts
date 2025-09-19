import { Router } from 'express';
import { z } from 'zod';
import { prisma, wsManager } from '../index';
import { authenticate, AuthRequest, requireApiKey } from '../middleware/auth';
import { OpenRouterClient } from '../services/openrouter';
import { CodeReviewAgent } from '../agents/codeReview';

const router = Router();

// Validation schemas
const StartReviewSchema = z.object({
  taskId: z.string(),
  files: z.array(z.object({
    path: z.string(),
    diff: z.string(),
    fullContent: z.string().optional()
  }))
});

const ResolveReviewSchema = z.object({
  reviewId: z.string(),
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED', 'IGNORED', 'FALSE_POSITIVE'])
});

// Start code review for a task
router.post('/start', authenticate, requireApiKey, async (req: AuthRequest, res, next) => {
  try {
    const { taskId, files } = StartReviewSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const openRouter = new OpenRouterClient(req.user.apiKey);
    const reviewAgent = new CodeReviewAgent(openRouter);

    wsManager.emitLog(taskId, 'Starting code review...', 'info');
    wsManager.emitStageUpdate(taskId, 'CODE_REVIEW', 'IN_PROGRESS');

    // Update workflow stage
    await prisma.workflowStage.upsert({
      where: { taskId_stage: { taskId, stage: 'CODE_REVIEW' } },
      update: { status: 'IN_PROGRESS', startedAt: new Date() },
      create: {
        taskId,
        stage: 'CODE_REVIEW',
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    });

    const allReviews = [];

    for (const file of files) {
      wsManager.emitLog(taskId, `Reviewing ${file.path}...`, 'info');
      
      const reviews = await reviewAgent.reviewCode(
        file.path,
        file.diff,
        file.fullContent
      );

      // Save reviews to database
      const savedReviews = await Promise.all(
        reviews.map(review =>
          prisma.codeReview.create({
            data: {
              taskId,
              filePath: file.path,
              diffContent: file.diff,
              reviewType: review.type,
              severity: review.severity,
              issue: review.issue,
              suggestion: review.suggestion,
              lineStart: review.lineStart,
              lineEnd: review.lineEnd,
              metadata: JSON.stringify(review.metadata || {})
            }
          })
        )
      );

      allReviews.push(...savedReviews);
    }

    // Generate summary
    const summary = await reviewAgent.generateSummary(allReviews);

    // Update workflow stage
    await prisma.workflowStage.update({
      where: { taskId_stage: { taskId, stage: 'CODE_REVIEW' } },
      data: {
        status: 'WAITING_APPROVAL',
        metadata: JSON.stringify({ summary, totalIssues: allReviews.length })
      }
    });

    wsManager.emitComplete(taskId, 'CODE_REVIEW', { reviews: allReviews, summary });

    res.json({
      reviews: allReviews,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// Get reviews for a task
router.get('/:taskId/reviews', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { severity, reviewType, status } = req.query;

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.taskId,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const where: any = { taskId: req.params.taskId };
    if (severity) where.severity = severity;
    if (reviewType) where.reviewType = reviewType;
    if (status) where.status = status;

    const reviews = await prisma.codeReview.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Group by file
    const groupedReviews = reviews.reduce((acc, review) => {
      if (!acc[review.filePath]) {
        acc[review.filePath] = [];
      }
      acc[review.filePath].push(review);
      return acc;
    }, {} as Record<string, typeof reviews>);

    res.json({
      reviews,
      groupedReviews,
      stats: {
        total: reviews.length,
        critical: reviews.filter(r => r.severity === 'CRITICAL').length,
        major: reviews.filter(r => r.severity === 'MAJOR').length,
        minor: reviews.filter(r => r.severity === 'MINOR').length,
        info: reviews.filter(r => r.severity === 'INFO').length,
        unresolved: reviews.filter(r => r.status === 'PENDING').length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update review status
router.put('/resolve', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { reviewId, status } = ResolveReviewSchema.parse(req.body);

    const review = await prisma.codeReview.findUnique({
      where: { id: reviewId },
      include: { task: true }
    });

    if (!review || review.task.userId !== req.userId) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const updatedReview = await prisma.codeReview.update({
      where: { id: reviewId },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : null
      }
    });

    // Check if all critical/major reviews are resolved
    const unresolvedCritical = await prisma.codeReview.count({
      where: {
        taskId: review.taskId,
        severity: { in: ['CRITICAL', 'MAJOR'] },
        status: 'PENDING'
      }
    });

    if (unresolvedCritical === 0) {
      // Can proceed to PR creation
      await prisma.workflowStage.update({
        where: { taskId_stage: { taskId: review.taskId, stage: 'CODE_REVIEW' } },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      wsManager.emitComplete(review.taskId, 'CODE_REVIEW');
      wsManager.emitLog(review.taskId, 'All critical reviews resolved', 'info');
    }

    wsManager.emitTaskUpdate({
      taskId: review.taskId,
      type: 'progress',
      message: `Review ${status.toLowerCase()}: ${review.issue}`,
      data: { review: updatedReview }
    });

    res.json(updatedReview);
  } catch (error) {
    next(error);
  }
});

// Get AI suggestions for fixing reviews
router.post('/:reviewId/suggest-fix', authenticate, requireApiKey, async (req: AuthRequest, res, next) => {
  try {
    const review = await prisma.codeReview.findUnique({
      where: { id: req.params.reviewId },
      include: { task: true }
    });

    if (!review || review.task.userId !== req.userId) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const openRouter = new OpenRouterClient(req.user.apiKey);
    const reviewAgent = new CodeReviewAgent(openRouter);

    const fix = await reviewAgent.suggestFix(review);

    res.json({ fix });
  } catch (error) {
    next(error);
  }
});

export default router;