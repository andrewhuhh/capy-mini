'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ChevronRight,
  GitPullRequest,
  MessageSquare,
  Code,
  Search,
  AlertCircle
} from 'lucide-react';

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    requirements: string;
    status: string;
    priority: string;
    createdAt: string;
    workflowStages?: any[];
    githubIntegration?: any;
    _count?: {
      codeReviews: number;
      agenticLoops: number;
      approvalGates: number;
    };
  };
}

const STATUS_COLORS = {
  TRIAGE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  PLANNING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  REVIEWING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
};

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
};

const PRIORITY_ICONS = {
  LOW: null,
  MEDIUM: null,
  HIGH: <AlertTriangle className="h-3 w-3" />,
  CRITICAL: <AlertCircle className="h-3 w-3" />
};

export default function TaskCard({ task }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (task.status) {
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 animate-pulse" />;
      case 'COMPLETED':
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4" />;
      case 'CANCELLED':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getCurrentStage = () => {
    if (!task.workflowStages || task.workflowStages.length === 0) {
      return null;
    }
    return task.workflowStages[0];
  };

  const currentStage = getCurrentStage();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Link 
              href={`/tasks/${task.id}`}
              className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
            >
              {task.title}
            </Link>
            
            <div className="flex items-center gap-3 mt-2">
              <span 
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]
                }`}
              >
                {getStatusIcon()}
                {task.status.replace('_', ' ')}
              </span>
              
              <span 
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]
                }`}
              >
                {PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS]}
                {task.priority}
              </span>
              
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {format(new Date(task.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
          
          <Link
            href={`/tasks/${task.id}`}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
          {task.requirements}
        </p>

        {currentStage && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Stage</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {currentStage.stage.replace('_', ' ')} - {currentStage.status.replace('_', ' ')}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            {task._count?.codeReviews > 0 && (
              <div className="flex items-center gap-1">
                <Search className="h-4 w-4" />
                <span>{task._count.codeReviews} reviews</span>
              </div>
            )}
            
            {task._count?.agenticLoops > 0 && (
              <div className="flex items-center gap-1">
                <Code className="h-4 w-4" />
                <span>{task._count.agenticLoops} iterations</span>
              </div>
            )}
            
            {task._count?.approvalGates > 0 && (
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>{task._count.approvalGates} pending approvals</span>
              </div>
            )}
          </div>
          
          {task.githubIntegration && (
            <div className="flex items-center gap-2">
              {task.githubIntegration.prNumber && (
                <a
                  href={task.githubIntegration.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <GitPullRequest className="h-4 w-4" />
                  <span>PR #{task.githubIntegration.prNumber}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {task._count?.approvalGates > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                This task requires your approval to continue
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}