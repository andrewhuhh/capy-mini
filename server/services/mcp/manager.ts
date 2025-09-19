import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { prisma } from '../../index';
import { MCPType, ServerStatus } from '@prisma/client';

export interface MCPServerConfig {
  name: string;
  type: MCPType;
  endpoint: string;
}

export class MCPManager {
  private servers: Map<string, Client> = new Map();
  private configs: MCPServerConfig[] = [
    {
      name: 'filesystem',
      type: 'FILESYSTEM' as MCPType,
      endpoint: process.env.MCP_FILESYSTEM_SERVER || 'ws://localhost:4001'
    },
    {
      name: 'git',
      type: 'GIT' as MCPType,
      endpoint: process.env.MCP_GIT_SERVER || 'ws://localhost:4002'
    },
    {
      name: 'github',
      type: 'GITHUB' as MCPType,
      endpoint: process.env.MCP_GITHUB_SERVER || 'ws://localhost:4003'
    }
  ];

  async initialize(): Promise<void> {
    for (const config of this.configs) {
      await this.connectServer(config);
    }
  }

  async connectServer(config: MCPServerConfig): Promise<void> {
    try {
      const transport = new WebSocketClientTransport(new URL(config.endpoint));
      const client = new Client({
        name: `ai-coding-agent-${config.name}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      this.servers.set(config.name, client);

      // Update database status
      await prisma.mCPServer.upsert({
        where: { name: config.name },
        update: {
          status: ServerStatus.CONNECTED,
          lastPingAt: new Date(),
          endpoint: config.endpoint
        },
        create: {
          name: config.name,
          type: config.type,
          endpoint: config.endpoint,
          status: ServerStatus.CONNECTED,
          lastPingAt: new Date()
        }
      });

      console.log(`✅ Connected to MCP server: ${config.name}`);
    } catch (error) {
      console.error(`❌ Failed to connect to MCP server ${config.name}:`, error);
      
      await prisma.mCPServer.upsert({
        where: { name: config.name },
        update: {
          status: ServerStatus.ERROR
        },
        create: {
          name: config.name,
          type: config.type,
          endpoint: config.endpoint,
          status: ServerStatus.ERROR
        }
      });
    }
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const client = this.servers.get(serverName);
    if (!client) {
      throw new Error(`MCP server ${serverName} not connected`);
    }

    try {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });
      
      return result;
    } catch (error) {
      console.error(`Error calling tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }

  async listTools(serverName?: string): Promise<any[]> {
    if (serverName) {
      const client = this.servers.get(serverName);
      if (!client) return [];
      
      try {
        const response = await client.request({
          method: 'tools/list',
          params: {}
        });
        return response.tools || [];
      } catch (error) {
        console.error(`Error listing tools for ${serverName}:`, error);
        return [];
      }
    }

    // List tools from all servers
    const allTools = [];
    for (const [name, client] of this.servers.entries()) {
      try {
        const response = await client.request({
          method: 'tools/list',
          params: {}
        });
        const tools = (response.tools || []).map((tool: any) => ({
          ...tool,
          server: name
        }));
        allTools.push(...tools);
      } catch (error) {
        console.error(`Error listing tools for ${name}:`, error);
      }
    }
    return allTools;
  }

  async disconnect(): Promise<void> {
    for (const [name, client] of this.servers.entries()) {
      try {
        await client.close();
        await prisma.mCPServer.update({
          where: { name },
          data: { status: ServerStatus.DISCONNECTED }
        });
      } catch (error) {
        console.error(`Error disconnecting ${name}:`, error);
      }
    }
    this.servers.clear();
  }

  getStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    for (const config of this.configs) {
      status[config.name] = this.servers.has(config.name) ? 'connected' : 'disconnected';
    }
    return status;
  }

  getServer(name: string): Client | undefined {
    return this.servers.get(name);
  }
}

// MCP tool wrappers for common operations
export class MCPToolWrapper {
  constructor(private manager: MCPManager) {}

  // Filesystem operations
  async readFile(path: string): Promise<string> {
    const result = await this.manager.callTool('filesystem', 'read_file', { path });
    return result.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.manager.callTool('filesystem', 'write_file', { path, content });
  }

  async listDirectory(path: string): Promise<string[]> {
    const result = await this.manager.callTool('filesystem', 'list_directory', { path });
    return result.entries;
  }

  // Git operations
  async gitStatus(repoPath: string): Promise<any> {
    return await this.manager.callTool('git', 'status', { path: repoPath });
  }

  async gitCommit(repoPath: string, message: string): Promise<void> {
    await this.manager.callTool('git', 'commit', { 
      path: repoPath, 
      message 
    });
  }

  async gitDiff(repoPath: string, file?: string): Promise<string> {
    const result = await this.manager.callTool('git', 'diff', { 
      path: repoPath,
      file 
    });
    return result.diff;
  }

  // GitHub operations
  async createPullRequest(
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string = 'main'
  ): Promise<any> {
    return await this.manager.callTool('github', 'create_pull_request', {
      repository: repo,
      title,
      body,
      head,
      base
    });
  }

  async createIssue(repo: string, title: string, body: string): Promise<any> {
    return await this.manager.callTool('github', 'create_issue', {
      repository: repo,
      title,
      body
    });
  }
}