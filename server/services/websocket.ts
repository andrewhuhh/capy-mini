import { Server, Socket } from 'socket.io';

export interface WorkflowUpdate {
  taskId: string;
  type: 'stage_update' | 'progress' | 'log' | 'error' | 'complete';
  stage?: string;
  status?: string;
  message?: string;
  progress?: number;
  data?: any;
}

export class WebSocketManager {
  private io: Server;
  private connections: Map<string, Socket> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  handleConnection(socket: Socket) {
    console.log(`New WebSocket connection: ${socket.id}`);
    this.connections.set(socket.id, socket);

    // Handle authentication
    socket.on('authenticate', (data: { userId: string; token: string }) => {
      // In production, verify the token
      this.associateUserSocket(data.userId, socket.id);
      socket.join(`user:${data.userId}`);
      socket.emit('authenticated', { userId: data.userId });
    });

    // Handle task subscription
    socket.on('subscribe:task', (taskId: string) => {
      socket.join(`task:${taskId}`);
      socket.emit('subscribed', { taskId });
    });

    // Handle task unsubscription
    socket.on('unsubscribe:task', (taskId: string) => {
      socket.leave(`task:${taskId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`WebSocket disconnected: ${socket.id}`);
      this.connections.delete(socket.id);
      
      // Remove from user associations
      for (const [userId, sockets] of this.userSockets.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
          }
        }
      }
    });
  }

  private associateUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  // Send update to all clients subscribed to a task
  emitTaskUpdate(update: WorkflowUpdate) {
    this.io.to(`task:${update.taskId}`).emit('task:update', update);
  }

  // Send update to a specific user
  emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Broadcast to all connected clients
  broadcast(event: string, data: any) {
    this.io.emit(event, data);
  }

  // Get connection count
  getConnectionCount(): number {
    return this.connections.size;
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  // Emit progress updates
  emitProgress(taskId: string, stage: string, progress: number, message?: string) {
    this.emitTaskUpdate({
      taskId,
      type: 'progress',
      stage,
      progress,
      message
    });
  }

  // Emit stage updates
  emitStageUpdate(taskId: string, stage: string, status: string, data?: any) {
    this.emitTaskUpdate({
      taskId,
      type: 'stage_update',
      stage,
      status,
      data
    });
  }

  // Emit log messages
  emitLog(taskId: string, message: string, level: 'info' | 'warning' | 'error' = 'info') {
    this.emitTaskUpdate({
      taskId,
      type: 'log',
      message,
      data: { level }
    });
  }

  // Emit errors
  emitError(taskId: string, error: string, stage?: string) {
    this.emitTaskUpdate({
      taskId,
      type: 'error',
      stage,
      message: error
    });
  }

  // Emit completion
  emitComplete(taskId: string, stage: string, data?: any) {
    this.emitTaskUpdate({
      taskId,
      type: 'complete',
      stage,
      status: 'completed',
      data
    });
  }
}