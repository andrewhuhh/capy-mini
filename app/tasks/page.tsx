"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api";
import TaskCard from "@/components/tasks/TaskCard";
import {
  Plus,
  LayoutGrid,
  List as ListIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Filter,
  Trash2,
  Archive,
  ChevronDown,
} from "lucide-react";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "review", label: "Pending Review" },
  { key: "completed", label: "Completed" },
] as const;

const PRIORITIES = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function statusToProgress(status: string) {
  switch (status) {
    case "TRIAGE":
      return 10;
    case "PLANNING":
      return 20;
    case "IN_PROGRESS":
      return 50;
    case "REVIEWING":
      return 80;
    case "COMPLETED":
    case "APPROVED":
      return 100;
    default:
      return 0;
  }
}

export default function TasksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [view, setView] = useState<"grid" | "list">((searchParams.get("view") as any) || "grid");
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["key"]>(((searchParams.get("tab") as any) || "all") as any);
  const [status, setStatus] = useState<string>(searchParams.get("status") || "");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>(((searchParams.get("priority") as any) || "ALL") as any);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "created_desc");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [limit, setLimit] = useState(Number(searchParams.get("limit") || 10));
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("tab", tab);
    if (status) params.set("status", status); else params.delete("status");
    if (priority && priority !== "ALL") params.set("priority", priority); else params.delete("priority");
    if (q) params.set("q", q); else params.delete("q");
    if (from) params.set("from", from); else params.delete("from");
    if (to) params.set("to", to); else params.delete("to");
    if (sort) params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", String(limit));
    router.replace(`${pathname}?${params.toString()}`);
  }, [view, tab, status, priority, q, from, to, sort, page, limit, router, pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/login");
  }, [router]);

  const statusParam = useMemo(() => {
    if (tab === "review") return "REVIEWING";
    if (tab === "completed") return "COMPLETED";
    return status || undefined;
  }, [tab, status]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tasks", { statusParam, priority, page, limit }],
    queryFn: async () => {
      const res = await tasksApi.list({ status: statusParam, priority: priority !== "ALL" ? (priority as string) : undefined, limit, offset: (page - 1) * limit });
      return res.data as { tasks: any[]; total: number; limit: number; offset: number };
    },
    keepPreviousData: true,
  });

  const tasks = useMemo(() => {
    let list = data?.tasks || [];
    if (tab === "active") {
      list = list.filter((t: any) => ["TRIAGE", "PLANNING", "IN_PROGRESS", "REVIEWING"].includes(t.status));
    }
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter((t: any) => t.title.toLowerCase().includes(qq) || t.requirements.toLowerCase().includes(qq));
    }
    if (from) list = list.filter((t: any) => +new Date(t.createdAt) >= +new Date(from));
    if (to) list = list.filter((t: any) => +new Date(t.createdAt) <= +new Date(to + "T23:59:59"));
    switch (sort) {
      case "created_asc":
        list = [...list].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
        break;
      case "created_desc":
        list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      case "priority_desc":
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as any;
        list = [...list].sort((a, b) => order[b.priority] - order[a.priority]);
        break;
      case "status":
        list = [...list].sort((a, b) => a.status.localeCompare(b.status));
        break;
    }
    return list;
  }, [data, tab, q, from, to, sort]);

  const total = data?.total || 0;

  const allSelectedIds = useMemo(() => tasks.filter((t: any) => selected[t.id]).map((t: any) => t.id), [tasks, selected]);
  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    tasks.forEach((t: any) => (next[t.id] = checked));
    setSelected(next);
  };

  const mutateUpdate = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => tasksApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const mutateDelete = useMutation({
    mutationFn: async (id: string) => tasksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const bulkArchive = async () => {
    await Promise.all(allSelectedIds.map((id) => mutateUpdate.mutateAsync({ id, payload: { status: "CANCELLED" } })));
    setSelected({});
  };
  const bulkDelete = async () => {
    await Promise.all(allSelectedIds.map((id) => mutateDelete.mutateAsync(id)));
    setSelected({});
  };
  const bulkChangePriority = async (p: string) => {
    await Promise.all(allSelectedIds.map((id) => mutateUpdate.mutateAsync({ id, payload: { priority: p } })));
    setSelected({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage and monitor all tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search tasks..."
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <Link href="/tasks/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Task
          </Link>
          <div className="hidden md:flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={`px-2 py-1 rounded ${view === "grid" ? "bg-gray-100 dark:bg-gray-700" : ""}`}
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-2 py-1 rounded ${view === "list" ? "bg-gray-100 dark:bg-gray-700" : ""}`}
              aria-pressed={view === "list"}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 dark:text-gray-400"}`}
            role="tab"
            aria-selected={tab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">Any</option>
              {["TRIAGE","PLANNING","IN_PROGRESS","REVIEWING","APPROVED","COMPLETED","FAILED","CANCELLED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Priority</label>
            <select value={priority} onChange={(e) => { setPriority(e.target.value as any); setPage(1); }} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
              <option value="created_desc">Creation date (newest)</option>
              <option value="created_asc">Creation date (oldest)</option>
              <option value="priority_desc">Priority</option>
              <option value="status">Status</option>
            </select>
          </div>

          {allSelectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{allSelectedIds.length} selected</span>
              <button onClick={bulkArchive} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                <Archive className="h-4 w-4" />
                Archive
              </button>
              <div className="relative inline-block">
                <details>
                  <summary className="list-none inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 cursor-pointer">
                    Change Priority
                    <ChevronDown className="h-4 w-4" />
                  </summary>
                  <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                    {["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => (
                      <button key={p} onClick={() => bulkChangePriority(p)} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">{p}</button>
                    ))}
                  </div>
                </details>
              </div>
              <button onClick={bulkDelete} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-red-800 dark:text-red-300">{(error as any)?.message || "Failed to load tasks"}</p>
              <button onClick={() => refetch()} className="mt-2 text-sm underline text-red-700 dark:text-red-300">Retry</button>
            </div>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No tasks match your filters.</p>
          <Link href="/tasks/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Create Task
          </Link>
        </div>
      ) : view === "grid" ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div key={task.id} className="relative">
                <label className="absolute top-3 left-3 z-10 inline-flex items-center">
                  <input type="checkbox" checked={!!selected[task.id]} onChange={(e) => setSelected((s) => ({ ...s, [task.id]: e.target.checked }))} className="rounded border-gray-300 dark:border-gray-700" aria-label="Select task" />
                </label>
                <div className="pl-9">
                  <TaskCard task={task} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <div className="grid grid-cols-12 items-center px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="col-span-5">Task</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-2">Progress</div>
              <div className="col-span-1 flex items-center gap-2">
                <input type="checkbox" onChange={(e) => toggleSelectAll(e.target.checked)} aria-label="Select all" className="rounded border-gray-300 dark:border-gray-700" />
              </div>
            </div>
            {tasks.map((t) => (
              <div key={t.id} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <div className="col-span-5">
                  <Link href={`/tasks/${t.id}`} className="text-sm font-medium text-gray-900 dark:text-white hover:underline">
                    {t.title}
                  </Link>
                  <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{t.requirements}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-700 dark:text-gray-300">{t.status.replace("_"," ")}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-gray-700 dark:text-gray-300">{t.priority}</span>
                </div>
                <div className="col-span-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${statusToProgress(t.status)}%` }} />
                  </div>
                </div>
                <div className="col-span-1 text-right">
                  <input type="checkbox" checked={!!selected[t.id]} onChange={(e) => setSelected((s) => ({ ...s, [t.id]: e.target.checked }))} aria-label="Select task" className="rounded border-gray-300 dark:border-gray-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Rows per page</span>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            {[10,20,50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(data?.tasks?.length || 0) < limit || isFetching}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
