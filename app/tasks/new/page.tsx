"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tasksApi, githubApi } from "@/lib/api";
import {
  Plus,
  AlertCircle,
  AlertTriangle,
  Github,
  Save,
  X,
} from "lucide-react";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  HIGH: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default function NewTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("MEDIUM");
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [createIssue, setCreateIssue] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<{ title?: boolean; requirements?: boolean }>({});
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    const draft = localStorage.getItem("taskDraft");
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.title) setTitle(d.title);
        if (d.requirements) setRequirements(d.requirements);
        if (d.priority && PRIORITIES.includes(d.priority)) setPriority(d.priority);
        if (d.selectedRepo) setSelectedRepo(d.selectedRepo);
        if (typeof d.createIssue === "boolean") setCreateIssue(d.createIssue);
      } catch {}
    }
    loadRepos();
  }, [router]);

  const loadRepos = async () => {
    setLoadingRepos(true);
    setRepoError("");
    try {
      const res = await githubApi.listRepos();
      setRepos(res.data || []);
    } catch (err: any) {
      setRepoError(
        err?.response?.data?.error || "GitHub is not configured. You can add it in Settings."
      );
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      const draft = {
        title,
        requirements,
        priority,
        selectedRepo,
        createIssue,
      };
      localStorage.setItem("taskDraft", JSON.stringify(draft));
      setDraftSavedAt(Date.now());
    }, 400);
    return () => clearTimeout(id);
  }, [title, requirements, priority, selectedRepo, createIssue]);

  const reqCharCount = requirements.length;
  const isValid = useMemo(() => {
    return title.trim().length > 0 && requirements.trim().length >= 10;
  }, [title, requirements]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if ((touched.title || title.length > 0) && title.trim().length === 0) e.title = "Title is required";
    if ((touched.requirements || requirements.length > 0) && requirements.trim().length < 10)
      e.requirements = "Requirements must be at least 10 characters";
    return e;
  }, [title, requirements, touched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await tasksApi.create({ title: title.trim(), requirements: requirements.trim(), priority });
      const task = res.data;
      localStorage.removeItem("taskDraft");
      if (createIssue && selectedRepo) {
        try {
          await githubApi.createIssue({
            taskId: task.id,
            repository: selectedRepo,
            title: task.title,
            body: task.requirements,
          });
        } catch {}
      }
      router.push(`/tasks/${task.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">New Task</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create a new coding task for the AI agent</p>
        </div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "title-error" : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.title ? "border-red-300 dark:border-red-800" : "border-gray-300 dark:border-gray-700"
            }`}
            placeholder="Short summary of the task"
          />
          {errors.title && (
            <p id="title-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Requirements
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">{reqCharCount} chars</span>
          </div>
          <textarea
            id="requirements"
            name="requirements"
            rows={8}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, requirements: true }))}
            aria-invalid={!!errors.requirements}
            aria-describedby={errors.requirements ? "req-error" : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.requirements ? "border-red-300 dark:border-red-800" : "border-gray-300 dark:border-gray-700"
            }`}
            placeholder="Describe the problem, constraints, and acceptance criteria"
          />
          {errors.requirements && (
            <p id="req-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.requirements}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Priority
            </label>
            <div className="mt-1">
              <select
                id="priority"
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select priority"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="mt-2 inline-flex items-center gap-2 text-xs">
                <span className={`px-2.5 py-0.5 rounded-full ${PRIORITY_COLORS[priority]}`}>{priority}</span>
                {priority === "HIGH" && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                {priority === "CRITICAL" && <AlertCircle className="h-3 w-3 text-red-500" />}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                GitHub Repository (optional)
              </label>
              <button
                type="button"
                onClick={loadRepos}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="mt-1">
              <div className="relative">
                <select
                  id="repository"
                  name="repository"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  disabled={loadingRepos || !!repoError}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  aria-label="Select GitHub repository"
                >
                  <option value="">Not selected</option>
                  {repos.map((r) => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
                <Github className="h-4 w-4 text-gray-400 absolute right-3 top-3" />
              </div>
              {repoError && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {repoError}
                </p>
              )}
              {!repoError && (
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-gray-700"
                    checked={createIssue}
                    onChange={(e) => setCreateIssue(e.target.checked)}
                  />
                  Create a GitHub issue with these requirements
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : "Draft not saved"}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!isValid || saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              aria-disabled={!isValid || saving}
            >
              {saving ? (
                <>
                  <Save className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
