'use client';

import { useMemo } from 'react';
import { 
  MessageSquare, 
  ClipboardCheck, 
  Code, 
  Search, 
  GitPullRequest,
  CheckCircle,
  Circle,
  AlertCircle,
  Clock,
  XCircle
} from 'lucide-react';

interface WorkflowStage {
  stage: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: any;
}

interface WorkflowVisualizationProps {
  stages: WorkflowStage[];
  currentStage?: string;
}

const STAGE_INFO = {
  TRIAGE: {
    label: 'Triage',
    icon: MessageSquare,
    description: 'Analyzing requirements and asking clarifying questions'
  },
  TASK_CREATION: {
    label: 'Task Creation',
    icon: ClipboardCheck,
    description: 'Defining tasks and acceptance criteria'
  },
  AGENTIC_LOOP: {
    label: 'Implementation',
    icon: Code,
    description: 'Autonomously implementing the solution'
  },
  CODE_REVIEW: {
    label: 'Code Review',
    icon: Search,
    description: 'Analyzing code for issues and improvements'
  },
  PR_CREATION: {
    label: 'PR Creation',
    icon: GitPullRequest,
    description: 'Creating pull request on GitHub'
  }
};

export default function WorkflowVisualization({ 
  stages, 
  currentStage 
}: WorkflowVisualizationProps) {
  const stageOrder = ['TRIAGE', 'TASK_CREATION', 'AGENTIC_LOOP', 'CODE_REVIEW', 'PR_CREATION'];
  
  const stageMap = useMemo(() => {
    const map = new Map<string, WorkflowStage>();
    stages.forEach(stage => {
      map.set(stage.stage, stage);
    });
    return map;
  }, [stages]);

  const getStageStatus = (stageName: string) => {
    const stage = stageMap.get(stageName);
    if (!stage) return 'pending';
    return stage.status.toLowerCase();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'waiting_approval':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getStageColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'waiting_approval':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'failed':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const getConnectorColor = (fromStage: string, toStage: string) => {
    const fromStatus = getStageStatus(fromStage);
    const toStatus = getStageStatus(toStage);
    
    if (fromStatus === 'completed' && toStatus !== 'pending') {
      return 'bg-green-500';
    } else if (fromStatus === 'completed') {
      return 'bg-gray-300 dark:bg-gray-600';
    } else {
      return 'bg-gray-200 dark:bg-gray-700';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
        Workflow Progress
      </h3>
      
      <div className="relative">
        {/* Desktop view */}
        <div className="hidden md:flex items-center justify-between">
          {stageOrder.map((stageName, index) => {
            const stageInfo = STAGE_INFO[stageName as keyof typeof STAGE_INFO];
            const status = getStageStatus(stageName);
            const Icon = stageInfo.icon;
            const isActive = currentStage === stageName;
            
            return (
              <div key={stageName} className="flex items-center flex-1">
                <div className="relative">
                  <div
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${getStageColor(status)}
                      ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {stageInfo.label}
                          </span>
                          {getStatusIcon(status)}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {stageInfo.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {index < stageOrder.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div 
                      className={`
                        h-1 rounded-full transition-all duration-500
                        ${getConnectorColor(stageName, stageOrder[index + 1])}
                      `}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile view */}
        <div className="md:hidden space-y-4">
          {stageOrder.map((stageName, index) => {
            const stageInfo = STAGE_INFO[stageName as keyof typeof STAGE_INFO];
            const status = getStageStatus(stageName);
            const Icon = stageInfo.icon;
            const isActive = currentStage === stageName;
            
            return (
              <div key={stageName}>
                <div
                  className={`
                    p-4 rounded-lg border-2 transition-all duration-200
                    ${getStageColor(status)}
                    ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {stageInfo.label}
                          </span>
                          {getStatusIcon(status)}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {stageInfo.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {index < stageOrder.length - 1 && (
                  <div className="flex justify-center my-2">
                    <div 
                      className={`
                        w-1 h-8 rounded-full transition-all duration-500
                        ${getConnectorColor(stageName, stageOrder[index + 1])}
                      `}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Overall Progress</span>
          <span>
            {stages.filter(s => s.status === 'COMPLETED').length} / {stageOrder.length} stages
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{
              width: `${(stages.filter(s => s.status === 'COMPLETED').length / stageOrder.length) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
}