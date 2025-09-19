import { useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export interface WorkflowUpdate {
  taskId: string;
  type: 'stage_update' | 'progress' | 'log' | 'error' | 'complete';
  stage?: string;
  status?: string;
  message?: string;
  progress?: number;
  data?: any;
}

export function useWebSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = io(WS_URL, {
        transports: ['websocket'],
        autoConnect: false
      });

      socketRef.current.on('connect', () => {
        console.log('WebSocket connected');
        
        if (userId) {
          const token = localStorage.getItem('token');
          socketRef.current?.emit('authenticate', { userId, token });
        }
      });

      socketRef.current.on('authenticated', (data) => {
        console.log('WebSocket authenticated:', data);
      });

      socketRef.current.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });

      socketRef.current.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      socketRef.current.connect();
    }

    return socketRef.current;
  }, [userId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const subscribeToTask = useCallback((taskId: string) => {
    socketRef.current?.emit('subscribe:task', taskId);
  }, []);

  const unsubscribeFromTask = useCallback((taskId: string) => {
    socketRef.current?.emit('unsubscribe:task', taskId);
  }, []);

  const onTaskUpdate = useCallback((callback: (update: WorkflowUpdate) => void) => {
    socketRef.current?.on('task:update', callback);
    return () => {
      socketRef.current?.off('task:update', callback);
    };
  }, []);

  useEffect(() => {
    const socket = connect();

    return () => {
      socket?.disconnect();
    };
  }, [connect]);

  return {
    socket: socketRef.current,
    connect,
    disconnect,
    subscribeToTask,
    unsubscribeFromTask,
    onTaskUpdate
  };
}