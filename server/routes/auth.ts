import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const UpdateApiKeySchema = z.object({
  apiKey: z.string().min(1)
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = RegisterSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    // Create session
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.SESSION_EXPIRY || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.SESSION_EXPIRY || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasApiKey: !!user.apiKey
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await prisma.session.delete({ where: { token } });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      hasApiKey: !!user.apiKey,
      hasGithubToken: !!user.githubToken,
      createdAt: user.createdAt
    });
  } catch (error) {
    next(error);
  }
});

// Update API key
router.put('/api-key', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { apiKey } = UpdateApiKeySchema.parse(req.body);

    await prisma.user.update({
      where: { id: req.userId },
      data: { apiKey }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Update GitHub token
router.put('/github-token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);

    await prisma.user.update({
      where: { id: req.userId },
      data: { githubToken: token }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;