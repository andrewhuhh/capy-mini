import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { mcpManager } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { MCPToolWrapper } from '../services/mcp/manager';

const router = Router();

// Validation schemas
const CallToolSchema = z.object({
  server: z.string(),
  tool: z.string(),
  args: z.record(z.any())
});

const FileOperationSchema = z.object({
  path: z.string(),
  content: z.string().optional()
});

// Get MCP server status
router.get('/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const servers = await prisma.mCPServer.findMany();
    const status = mcpManager.getStatus();

    res.json({
      servers: servers.map(server => ({
        name: server.name,
        type: server.type,
        endpoint: server.endpoint,
        status: server.status,
        connected: status[server.name] === 'connected',
        lastPingAt: server.lastPingAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// List available tools
router.get('/tools', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { server } = req.query;
    const tools = await mcpManager.listTools(server as string | undefined);

    res.json({ tools });
  } catch (error) {
    next(error);
  }
});

// Call an MCP tool
router.post('/call', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { server, tool, args } = CallToolSchema.parse(req.body);

    const result = await mcpManager.callTool(server, tool, args);

    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Filesystem operations wrapper endpoints
const mcpTools = new MCPToolWrapper(mcpManager);

// Read file
router.post('/fs/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { path } = FileOperationSchema.parse(req.body);
    const content = await mcpTools.readFile(path);

    res.json({ content });
  } catch (error) {
    next(error);
  }
});

// Write file
router.post('/fs/write', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { path, content } = FileOperationSchema.parse(req.body);
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    await mcpTools.writeFile(path, content);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// List directory
router.post('/fs/list', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { path } = FileOperationSchema.parse(req.body);
    const entries = await mcpTools.listDirectory(path);

    res.json({ entries });
  } catch (error) {
    next(error);
  }
});

// Git operations
router.post('/git/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { path } = FileOperationSchema.parse(req.body);
    const status = await mcpTools.gitStatus(path);

    res.json({ status });
  } catch (error) {
    next(error);
  }
});

router.post('/git/diff', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { path, file } = z.object({
      path: z.string(),
      file: z.string().optional()
    }).parse(req.body);

    const diff = await mcpTools.gitDiff(path, file);

    res.json({ diff });
  } catch (error) {
    next(error);
  }
});

router.post('/git/commit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { path, message } = z.object({
      path: z.string(),
      message: z.string()
    }).parse(req.body);

    await mcpTools.gitCommit(path, message);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Reconnect to an MCP server
router.post('/reconnect', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string() }).parse(req.body);

    const server = await prisma.mCPServer.findUnique({
      where: { name }
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    await mcpManager.connectServer({
      name: server.name,
      type: server.type,
      endpoint: server.endpoint
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;