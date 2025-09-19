import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import triageRoutes from './routes/triage';
import reviewRoutes from './routes/review';
import githubRoutes from './routes/github';
import mcpRoutes from './routes/mcp';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { WebSocketManager } from './services/websocket';
import { MCPManager } from './services/mcp/manager';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    credentials: true
  }
});

export const prisma = new PrismaClient();
export const wsManager = new WebSocketManager(io);
export const mcpManager = new MCPManager();

// Middleware
app.use(cors({
  origin: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimiter);

// Health check
app.get('/health', (_, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      database: prisma ? 'connected' : 'disconnected',
      websocket: wsManager.getConnectionCount() >= 0 ? 'active' : 'inactive',
      mcp: mcpManager.getStatus()
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/mcp', mcpRoutes);

// Error handling
app.use(errorHandler);

// WebSocket handling
io.on('connection', (socket) => {
  wsManager.handleConnection(socket);
});

// Initialize services
async function initialize() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');

    // Initialize MCP connections
    await mcpManager.initialize();
    console.log('✅ MCP services initialized');

    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  await mcpManager.disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

initialize();