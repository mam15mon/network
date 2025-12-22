import { Copy, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, apiFetch } from "@/lib/api";
import { type TaskLogItem, type TaskResponse, type TaskSummary } from "@/lib/types";

function errorToMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.detail === "string") return error.detail;
    try {
      return JSON.stringify(error.detail);
    } catch {
      return "请求失败";
    }
  }
  if (error instanceof Error) return error.message;
  return "未知错误";
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "default";
  if (s === "failed") return "destructive";
  if (s === "running") return "secondary";
  if (s === "pending") return "secondary";
  if (s === "canceled") return "secondary";
  return "secondary";
}

function formatJson(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function TasksPage() {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState("");
  const [taskType, setTaskType] = useState("");
  const [limit, setLimit] = useState("100");

  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["tasks", status, taskType, limit],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("offset", "0");
      sp.set("limit", `${Math.max(1, Math.min(1000, Number(limit) || 100))}`);
      if (status.trim()) sp.set("status", status.trim());
      if (taskType.trim()) sp.set("task_type", taskType.trim());
      return apiFetch<TaskSummary[]>(`/api/v1/tasks?${sp.toString()}`);
    },
  });

  const statsQuery = useQuery({
    queryKey: ["tasks-stats"],
    queryFn: async () =>
      apiFetch<{
        total_tasks: number;
        status_counts: Record<string, number>;
        tasks_by_type: Record<string, number>;
        success_rate: number | null;
        avg_execution_time_seconds: number | null;
      }>("/api/v1/tasks/stats/summary"),
  });

  const activeTaskQuery = useQuery({
    queryKey: ["task-detail", activeTaskId],
    enabled: activeTaskId != null,
    queryFn: async () => apiFetch<TaskResponse>(`/api/v1/tasks/${activeTaskId}`),
    refetchInterval: (query) => {
      const s = (query.state.data?.status || "").toLowerCase();
      if (s === "pending" || s === "running") return 1000;
      return false;
    },
  });

  const activeLogsQuery = useQuery({
    queryKey: ["task-logs", activeTaskId],
    enabled: activeTaskId != null,
    queryFn: async () => apiFetch<TaskLogItem[]>(`/api/v1/tasks/${activeTaskId}/logs?limit=2000&offset=0`),
    refetchInterval: (query) => {
      const s = (activeTaskQuery.data?.status || "").toLowerCase();
      if (s === "pending" || s === "running") return 1000;
      if (query.state.data && query.state.data.length > 0) return false;
      return 1500;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => apiFetch<{ message: string }>(`/api/v1/tasks/${id}/cancel`, { method: "POST" }),
    onSuccess: async () => {
      toast.success("已取消任务");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task-detail"] });
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const tasks = tasksQuery.data ?? [];
  const active = activeTaskQuery.data ?? null;

  const summaryText = useMemo(() => {
    const total = statsQuery.data?.total_tasks;
    const sr = statsQuery.data?.success_rate;
    const avg = statsQuery.data?.avg_execution_time_seconds;
    const parts: string[] = [];
    if (typeof total === "number") parts.push(`总任务 ${total}`);
    if (typeof sr === "number") parts.push(`成功率 ${sr.toFixed(1)}%`);
    if (typeof avg === "number") parts.push(`平均耗时 ${avg.toFixed(1)}s`);
    return parts.join(" / ");
  }, [statsQuery.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">任务</h1>
          <p className="text-sm text-muted-foreground">查看任务历史、执行状态与逐设备回显。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["tasks"] });
              void queryClient.invalidateQueries({ queryKey: ["tasks-stats"] });
            }}
            disabled={tasksQuery.isFetching || statsQuery.isFetching}
            title="刷新"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          {summaryText ? <span className="text-xs text-muted-foreground">{summaryText}</span> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[520px_1fr]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>任务列表</CardTitle>
            <CardDescription>默认加载最近 100 条；可按状态/类型过滤。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="status（pending/running/completed/failed/canceled）"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="min-w-[260px]"
              />
              <Input
                placeholder="task_type（command/config/connectivity/...）"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="min-w-[260px]"
              />
              <Input
                inputMode="numeric"
                placeholder="limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-28"
              />
              {tasksQuery.isFetching ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">id</TableHead>
                  <TableHead>name</TableHead>
                  <TableHead>type</TableHead>
                  <TableHead>status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const isActive = activeTaskId === t.id;
                  return (
                    <TableRow
                      key={t.id}
                      className={isActive ? "bg-secondary/30" : ""}
                      onClick={() => setActiveTaskId(t.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="font-mono text-xs">{t.task_type}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tasks.length === 0 && !tasksQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      暂无任务
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            {tasksQuery.isError ? <div className="text-xs text-destructive">{errorToMessage(tasksQuery.error)}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>任务详情</CardTitle>
                <CardDescription>选中左侧任务后查看详情与日志。</CardDescription>
              </div>
              {activeTaskId != null ? (
                <Button variant="outline" onClick={() => setActiveTaskId(null)}>
                  <X className="h-4 w-4" />
                  关闭
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTaskId == null ? (
              <div className="py-10 text-center text-sm text-muted-foreground">请选择一个任务</div>
            ) : activeTaskQuery.isError ? (
              <div className="text-sm text-destructive">{errorToMessage(activeTaskQuery.error)}</div>
            ) : !active ? (
              <div className="text-sm text-muted-foreground">加载中...</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(active.status)}>{active.status}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">id={active.id}</span>
                  <span className="text-xs text-muted-foreground font-mono">type={active.task_type}</span>
                  <span className="text-xs text-muted-foreground">targets={active.targets.length}</span>
                  {active.created_by ? <span className="text-xs text-muted-foreground">by {active.created_by}</span> : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {active.started_at ? `started ${new Date(active.started_at).toLocaleString()}` : null}
                    {active.completed_at ? ` / done ${new Date(active.completed_at).toLocaleString()}` : null}
                  </span>
                </div>

                <div className="text-sm font-medium">{active.name}</div>
                {active.description ? <div className="text-xs text-muted-foreground">{active.description}</div> : null}

                {active.status === "pending" ? (
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate(active.id)}
                    disabled={cancelMutation.isPending}
                  >
                    取消任务
                  </Button>
                ) : null}

                {active.command ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">
                    {active.command}
                  </div>
                ) : null}

                {active.error_message ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {active.error_message}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="text-sm font-medium">日志</div>
                  {activeLogsQuery.isError ? (
                    <div className="text-xs text-destructive">{errorToMessage(activeLogsQuery.error)}</div>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>device</TableHead>
                        <TableHead className="w-24">status</TableHead>
                        <TableHead>message</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(activeLogsQuery.data ?? []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.device_name}</TableCell>
                          <TableCell>
                            <Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {l.error_message ? l.error_message : l.raw_output ? "有回显（可复制）" : formatJson(l.result)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const content = l.raw_output ?? formatJson(l.result);
                                if (!content) return;
                                await navigator.clipboard.writeText(content);
                                toast.success("已复制");
                              }}
                              disabled={!l.raw_output && !l.result}
                              title="复制回显/结果"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(activeLogsQuery.data ?? []).length === 0 && !activeLogsQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            暂无日志
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

