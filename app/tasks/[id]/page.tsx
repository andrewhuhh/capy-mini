"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import WorkflowVisualization from "@/components/workflow/WorkflowVisualization";
import { tasksApi, reviewApi, githubApi } from "@/lib/api";
import { useWebSocket, WorkflowUpdate } from "@/hooks/useWebSocket";
import {
  ArrowLeft,
  Clock,
  Edit,
  Archive,
  Play,
  Square,
  CheckCircle,
  XCircle,
  AlertCircle,
  GitPullRequest,
  Github,
  ChevronRight,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  TRIAGE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  PLANNING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  REVIEWING: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  HIGH: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

type TabKey = "overview" | "workflow" | "approvals" | "reviews" | "github" | "activity" | "iterations";

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const taskId = params.id;

  const [task, setTask] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [github, setGithub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("overview");
  const [timeline, setTimeline] = useState<Array<{ ts: string; kind: string; message: string }>>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [actionLoading, setActionLoading] = useState(false);

  const { connect, subscribeToTask, unsubscribeFromTask, onTaskUpdate } = useWebSocket();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadAll();
  }, [router, taskId]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [tRes, pRes, rRes, gRes] = await Promise.all([
        tasksApi.get(taskId),
        tasksApi.getProgress(taskId),
        reviewApi.getReviews(taskId),
        githubApi.getStatus(taskId).catch(() => ({ data: { status: "not_integrated" } })),
      ]);
      setTask(tRes.data);
      setEditTitle(tRes.data.title);
      setEditPriority(tRes.data.priority);
      setProgress(pRes.data);
      setReviews(rRes.data.reviews || []);
      setGithub(gRes.data);
      setTimeline(buildInitialTimeline(tRes.data, pRes.data));
      setupWebSocket();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    const s = connect();
    if (!s) return;
    subscribeToTask(taskId);
    const off = onTaskUpdate((u: WorkflowUpdate) => {
      if (u.taskId !== taskId) return;
      setTimeline((prev) => [
        { ts: new Date().toISOString(), kind: u.type, message: u.message || `${u.stage || ""} ${u.status || ""}`.trim() },
        ...prev,
      ]);
      if (u.type === "stage_update") {
        setTask((prev) => {
          if (!prev) return prev;
          const stages = [...(prev.workflowStages || [])];
          const idx = stages.findIndex((s: any) => s.stage === u.stage);
          if (idx >= 0) stages[idx] = { ...stages[idx], status: u.status, completedAt: u.status === "COMPLETED" ? new Date().toISOString() : stages[idx].completedAt };
          else stages.push({ stage: u.stage, status: u.status, startedAt: new Date().toISOString() });
          return { ...prev, workflowStages: stages };
        });
      }
      if (u.type === "progress") {
        setProgress((p: any) => ({ ...(p || {}), progress: u.progress ?? p?.progress, currentStage: u.stage || p?.currentStage }));
      }
    });
    return () => {
      off && off();
      unsubscribeFromTask(taskId);
    };
  };

  const buildInitialTimeline = (t: any, p: any) => {
    const events: Array<{ ts: string; kind: string; message: string }> = [];
    (t.workflowStages || []).forEach((s: any) => {
      if (s.startedAt) events.push({ ts: s.startedAt, kind: "stage_update", message: `${s.stage} started` });
      if (s.completedAt) events.push({ ts: s.completedAt, kind: "complete", message: `${s.stage} completed` });
    });
    return events.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  };

  const handleUpdateTask = async () => {
    setActionLoading(true);
    try {
      const res = await tasksApi.update(taskId, { title: editTitle, priority: editPriority });
      setTask(res.data);
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to update task");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await tasksApi.update(taskId, { status: "IN_PROGRESS" });
      setTask(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to start workflow");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const res = await tasksApi.update(taskId, { status: "CANCELLED" });
      setTask(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to stop workflow");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    await handleStop();
  };

  const pendingApprovals = useMemo(() => (task?.approvalGates || []).filter((g: any) => g.status === "PENDING"), [task]);

  const approveGate = async (gateId: string, approved: boolean, notes?: string) => {
    setActionLoading(true);
    try {
      await tasksApi.approve(taskId, gateId, approved, notes);
      const updated = await tasksApi.get(taskId);
      setTask(updated.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to submit approval");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              <button onClick={loadAll} className="mt-3 text-sm text-red-700 dark:text-red-300 underline">
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canEdit = task?.status === "TRIAGE" || task?.status === "PLANNING";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/tasks" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Tasks
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{task.title}</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                {task.status === "IN_PROGRESS" ? <Clock className="h-3 w-3" /> : task.status === "COMPLETED" ? <CheckCircle className="h-3 w-3" /> : task.status === "FAILED" || task.status === "CANCELLED" ? <XCircle className="h-3 w-3" /> : null}
                {task.status.replace("_", " ")}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Created {format(new Date(task.createdAt), "MMM d, yyyy")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              disabled={!canEdit}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 disabled:opacity-50"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            {task.status !== "IN_PROGRESS" ? (
              <button onClick={handleStart} disabled={actionLoading} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                <Play className="h-4 w-4" />
                Start
              </button>
            ) : (
              <button onClick={handleStop} disabled={actionLoading} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50">
                <Square className="h-4 w-4" />
                Stop
              </button>
            )}
            <button onClick={handleArchive} disabled={actionLoading} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
              <Archive className="h-4 w-4" />
              Archive
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-white">
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 justify-end">
              <button onClick={() => setIsEditing(false)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700">Cancel</button>
              <button onClick={handleUpdateTask} disabled={actionLoading} className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "workflow", label: "Workflow" },
              { key: "approvals", label: `Approvals${pendingApprovals.length ? ` (${pendingApprovals.length})` : ""}` },
              { key: "reviews", label: "Code Reviews" },
              { key: "github", label: "GitHub" },
              { key: "activity", label: "Activity" },
              { key: "iterations", label: "Iterations" },
            ] as { key: TabKey; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 dark:text-gray-400"}`}
              role="tab"
              aria-selected={tab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Requirements</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{task.requirements}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <WorkflowVisualization stages={task.workflowStages || []} currentStage={progress?.currentStage} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">GitHub</h3>
                {github?.status === "integrated" ? (
                  <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      <span>{github.repository}</span>
                    </div>
                    {github.prNumber && (
                      <a href={github.prUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                        <GitPullRequest className="h-4 w-4" />
                        PR #{github.prNumber}
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Not linked. Configure GitHub in Settings.</p>
                )}
              </div>

              {pendingApprovals.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pending Approvals</h3>
                  <div className="space-y-4">
                    {pendingApprovals.map((g: any) => (
                      <div key={g.id} className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{g.gateType.replace("_", " ")}</p>
                            {g.metadata && (
                              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300/90 break-all">{g.metadata}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => approveGate(g.id, true)} disabled={actionLoading} className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white">Approve</button>
                            <button onClick={() => approveGate(g.id, false)} disabled={actionLoading} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "workflow" && (
          <div className="mt-6">
            <WorkflowVisualization stages={task.workflowStages || []} currentStage={progress?.currentStage} />
          </div>
        )}

        {tab === "approvals" && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            {task.approvalGates?.length ? (
              <div className="space-y-4">
                {task.approvalGates.map((g: any) => (
                  <div key={g.id} className="flex items-start justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{g.gateType.replace("_", " ")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Status: {g.status.replace("_", " ")}</p>
                    </div>
                    {g.status === "PENDING" && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => approveGate(g.id, true)} className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white">Approve</button>
                        <button onClick={() => approveGate(g.id, false)} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white">Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No approval gates.</p>
            )}
          </div>
        )}

        {tab === "reviews" && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            {reviews.length ? (
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <div key={r.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{r.filePath}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{r.issue}</p>
                        {r.suggestion && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Suggestion: {r.suggestion}</p>}
                      </div>
                      <div className="text-right">
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{r.reviewType}</span>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Severity: {r.severity}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Status: {r.status}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No code reviews yet.</p>
            )}
          </div>
        )}

        {tab === "github" && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            {github?.status === "integrated" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Repository</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Github className="h-4 w-4" />
                    {github.repository}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Pull Request</h4>
                  {github.prNumber ? (
                    <a href={github.prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      <GitPullRequest className="h-4 w-4" />
                      PR #{github.prNumber} ({github.prStatus})
                    </a>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">None</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">No GitHub integration.</div>
            )}
          </div>
        )}

        {tab === "activity" && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              {timeline.length ? (
                timeline.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="mt-1">
                      {e.kind === "complete" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : e.kind === "error" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : e.kind === "log" ? (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white">{e.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(e.ts), "PPpp")}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No activity yet.</p>
              )}
            </div>
          </div>
        )}

        {tab === "iterations" && (
          <div className="mt-6 space-y-4">
            {(task.agenticLoops || []).length ? (
              (task.agenticLoops || []).map((loop: any) => (
                <div key={loop.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Iteration {loop.iteration} · Phase {loop.phase}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(loop.startedAt), "PPpp")}</div>
                  </div>
                  {loop.planningData && (
                    <pre className="mt-3 text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-auto max-h-60">{loop.planningData}</pre>
                  )}
                  {loop.executionLog && (
                    <pre className="mt-3 text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-auto max-h-60">{loop.executionLog}</pre>
                  )}
                  {loop.validation && (
                    <pre className="mt-3 text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-auto max-h-60">{loop.validation}</pre>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">No iterations recorded yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
