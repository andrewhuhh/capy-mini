import { Router } from 'express';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { prisma, wsManager } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const CreatePRSchema = z.object({
  taskId: z.string(),
  repository: z.string().regex(/^[\w-]+\/[\w-]+$/), // owner/repo format
  title: z.string(),
  body: z.string(),
  head: z.string(),
  base: z.string().default('main'),
  draft: z.boolean().optional()
});

const CreateIssueSchema = z.object({
  taskId: z.string(),
  repository: z.string().regex(/^[\w-]+\/[\w-]+$/),
  title: z.string(),
  body: z.string(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional()
});

const LinkIssueSchema = z.object({
  taskId: z.string(),
  repository: z.string(),
  issueNumber: z.number()
});

// Helper to get Octokit instance
function getOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: 'AI-Coding-Agent/1.0'
  });
}

// Create a pull request
router.post('/pr/create', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user.githubToken) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    const { taskId, repository, title, body, head, base, draft } = CreatePRSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const [owner, repo] = repository.split('/');
    const octokit = getOctokit(req.user.githubToken);

    wsManager.emitLog(taskId, `Creating pull request in ${repository}...`, 'info');

    // Create the pull request
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body: `${body}\n\n---\n*Created by AI Coding Agent for task: ${task.title}*`,
      head,
      base,
      draft: draft || false
    });

    // Save to database
    await prisma.githubIntegration.upsert({
      where: { taskId },
      update: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        prStatus: pr.state,
        lastSyncedAt: new Date()
      },
      create: {
        taskId,
        repository,
        prNumber: pr.number,
        prUrl: pr.html_url,
        prStatus: pr.state,
        branchName: head
      }
    });

    // Update workflow stage
    await prisma.workflowStage.upsert({
      where: { taskId_stage: { taskId, stage: 'PR_CREATION' } },
      update: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: JSON.stringify({ prNumber: pr.number, prUrl: pr.html_url })
      },
      create: {
        taskId,
        stage: 'PR_CREATION',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        metadata: JSON.stringify({ prNumber: pr.number, prUrl: pr.html_url })
      }
    });

    // Update task status
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' }
    });

    wsManager.emitComplete(taskId, 'PR_CREATION', { pr });
    wsManager.emitLog(taskId, `Pull request created: ${pr.html_url}`, 'info');

    res.json({
      pr: {
        number: pr.number,
        url: pr.html_url,
        state: pr.state,
        title: pr.title
      }
    });
  } catch (error: any) {
    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid GitHub token' });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: 'Repository not found or no access' });
    }
    next(error);
  }
});

// Create an issue
router.post('/issue/create', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user.githubToken) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    const { taskId, repository, title, body, labels, assignees } = CreateIssueSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const [owner, repo] = repository.split('/');
    const octokit = getOctokit(req.user.githubToken);

    wsManager.emitLog(taskId, `Creating issue in ${repository}...`, 'info');

    // Create the issue
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title,
      body: `${body}\n\n---\n*Created by AI Coding Agent for task: ${task.title}*`,
      labels,
      assignees
    });

    // Save to database
    await prisma.githubIntegration.upsert({
      where: { taskId },
      update: {
        issueNumber: issue.number,
        lastSyncedAt: new Date()
      },
      create: {
        taskId,
        repository,
        issueNumber: issue.number
      }
    });

    wsManager.emitLog(taskId, `Issue created: #${issue.number}`, 'info');

    res.json({
      issue: {
        number: issue.number,
        url: issue.html_url,
        state: issue.state,
        title: issue.title
      }
    });
  } catch (error: any) {
    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid GitHub token' });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: 'Repository not found or no access' });
    }
    next(error);
  }
});

// Link existing issue to task
router.post('/issue/link', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { taskId, repository, issueNumber } = LinkIssueSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.githubIntegration.upsert({
      where: { taskId },
      update: {
        issueNumber,
        repository
      },
      create: {
        taskId,
        repository,
        issueNumber
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get PR/Issue status
router.get('/:taskId/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.taskId,
        userId: req.userId
      },
      include: {
        githubIntegration: true
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.githubIntegration) {
      return res.json({ status: 'not_integrated' });
    }

    const integration = task.githubIntegration;
    
    if (!req.user.githubToken) {
      return res.json({
        status: 'integrated',
        repository: integration.repository,
        issueNumber: integration.issueNumber,
        prNumber: integration.prNumber,
        prUrl: integration.prUrl,
        prStatus: integration.prStatus,
        lastSyncedAt: integration.lastSyncedAt
      });
    }

    // Fetch latest status from GitHub
    const [owner, repo] = integration.repository.split('/');
    const octokit = getOctokit(req.user.githubToken);

    let prStatus = integration.prStatus;
    let issueStatus = null;

    if (integration.prNumber) {
      try {
        const { data: pr } = await octokit.pulls.get({
          owner,
          repo,
          pull_number: integration.prNumber
        });
        prStatus = pr.state;
        
        // Update database
        await prisma.githubIntegration.update({
          where: { id: integration.id },
          data: {
            prStatus: pr.state,
            lastSyncedAt: new Date()
          }
        });
      } catch (error) {
        console.error('Failed to fetch PR status:', error);
      }
    }

    if (integration.issueNumber) {
      try {
        const { data: issue } = await octokit.issues.get({
          owner,
          repo,
          issue_number: integration.issueNumber
        });
        issueStatus = issue.state;
      } catch (error) {
        console.error('Failed to fetch issue status:', error);
      }
    }

    res.json({
      status: 'integrated',
      repository: integration.repository,
      issueNumber: integration.issueNumber,
      issueStatus,
      prNumber: integration.prNumber,
      prUrl: integration.prUrl,
      prStatus,
      branchName: integration.branchName,
      lastSyncedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// List repositories
router.get('/repos', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user.githubToken) {
      return res.status(400).json({ error: 'GitHub token not configured' });
    }

    const octokit = getOctokit(req.user.githubToken);
    
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100
    });

    res.json(
      repos.map(repo => ({
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        private: repo.private,
        defaultBranch: repo.default_branch,
        description: repo.description,
        language: repo.language,
        updatedAt: repo.updated_at
      }))
    );
  } catch (error: any) {
    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid GitHub token' });
    }
    next(error);
  }
});

export default router;