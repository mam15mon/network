import { Copy, Play, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import { type InventoryDevice, type NornirHostResult, type TaskResponse } from "@/lib/types";

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

function formatUnknown(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ExecutePage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const [siteFilter, setSiteFilter] = useState("");
  const debouncedSite = useDebouncedValue(siteFilter, 200);

  const [typeFilter, setTypeFilter] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedHosts = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const [command, setCommand] = useState("");
  const [enable, setEnable] = useState(false);
  const [timeout, setTimeoutValue] = useState<string>("");

  const [results, setResults] = useState<Record<string, NornirHostResult> | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  const devicesQuery = useQuery({
    queryKey: ["inventory-devices-for-execute", debouncedSearch, debouncedSite, typeFilter],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("limit", "1000");
      sp.set("offset", "0");
      if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
      if (debouncedSite.trim()) sp.set("site", debouncedSite.trim());
      if (typeFilter.trim()) sp.set("device_type", typeFilter.trim());
      return apiFetch<InventoryDevice[]>(`/api/v1/inventory/devices?${sp.toString()}`);
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const timeoutNum = timeout.trim() ? Number(timeout.trim()) : undefined;
      const payload = {
        name: `command-${new Date().toISOString()}`,
        task_type: "command",
        targets: selectedHosts,
        command: command.trim(),
        parameters: {
          timeout: Number.isFinite(timeoutNum) ? timeoutNum : undefined,
          enable,
        },
        auto_start: true,
      };
      return apiFetch<TaskResponse>("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      setActiveTaskId(data.id);
      setResults(null);
      toast.success(`任务已创建：#${data.id}`);
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const taskQuery = useQuery({
    queryKey: ["execute-task", activeTaskId],
    enabled: activeTaskId != null,
    queryFn: async () => apiFetch<TaskResponse>(`/api/v1/tasks/${activeTaskId}`),
    refetchInterval: (query) => {
      const s = (query.state.data?.status || "").toLowerCase();
      if (s === "pending" || s === "running") return 1000;
      return false;
    },
  });

  useEffect(() => {
    const task = taskQuery.data;
    if (!task) return;
    const s = (task.status || "").toLowerCase();
    if (s === "completed" || s === "failed") {
      const next = (task.results ?? null) as Record<string, NornirHostResult> | null;
      setResults(next);
      if (s === "completed") toast.success("命令执行完成");
      if (s === "failed") toast.error(task.error_message || "命令执行失败");
    }
  }, [taskQuery.data?.id, taskQuery.data?.status, taskQuery.data?.results, taskQuery.data?.error_message]);

  const devices = devicesQuery.data ?? [];
  const allSelected = devices.length > 0 && devices.every((d) => selected[d.name]);
  const someSelected = devices.some((d) => selected[d.name]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">执行命令</h1>
        <p className="text-sm text-muted-foreground">从库存选择设备，执行命令并查看回显。</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>选择设备</CardTitle>
            <CardDescription>最多拉取 1000 条；可按站点/类型过滤。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="搜索 name / hostname"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[220px]"
              />
              <Input
                placeholder="站点（site）"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="min-w-[180px]"
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="设备类型过滤"
              >
                <option value="">全部类型</option>
                <option value="switch">switch</option>
                <option value="router">router</option>
                <option value="firewall">firewall</option>
              </select>
              {devicesQuery.isFetching ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      role="checkbox"
                      aria-label="全选"
                      checked={allSelected}
                      ref={(el) => {
                        if (!el) return;
                        el.indeterminate = !allSelected && someSelected;
                      }}
                      onChange={(e) => {
                        const next: Record<string, boolean> = {};
                        if (e.target.checked) {
                          for (const d of devices) next[d.name] = true;
                        }
                        setSelected(next);
                      }}
                    />
                  </TableHead>
                  <TableHead>name</TableHead>
                  <TableHead>site</TableHead>
                  <TableHead>type</TableHead>
                  <TableHead>platform</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>
                      <input
                        type="checkbox"
                        role="checkbox"
                        checked={!!selected[d.name]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [d.name]: e.target.checked }))}
                        aria-label={`选择 ${d.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.site ?? "-"}</TableCell>
                    <TableCell>{d.device_type ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{d.platform}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {devices.length === 0 && !devicesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      暂无设备
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            {devicesQuery.isError ? (
              <div className="text-xs text-destructive">{errorToMessage(devicesQuery.error)}</div>
            ) : null}
            <div className="text-xs text-muted-foreground">已选 {selectedHosts.length} 台</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>命令</CardTitle>
            <CardDescription>
              `timeout` 留空则走数据库默认/按命令超时（`command_timeouts`）；执行走任务系统，可在「任务」页回看。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
              <Textarea
                rows={4}
                placeholder="例如：display version / show version"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              <div className="space-y-2">
                <Input
                  inputMode="numeric"
                  placeholder="timeout(秒)"
                  value={timeout}
                  onChange={(e) => setTimeoutValue(e.target.value)}
                />
                <label className="flex select-none items-center gap-2 text-sm">
                  <input type="checkbox" checked={enable} onChange={(e) => setEnable(e.target.checked)} />
                  enable
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      if (selectedHosts.length === 0) return toast.error("请先选择设备");
                      if (!command.trim()) return toast.error("请输入命令");
                      runMutation.mutate();
                    }}
                    disabled={runMutation.isPending}
                    className="w-full"
                  >
                    <Play className="h-4 w-4" />
                    创建任务并执行
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResults(null);
                      setActiveTaskId(null);
                      setCommand("");
                      setTimeoutValue("");
                      setEnable(false);
                    }}
                    title="清空"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {activeTaskId != null ? (
                  <div className="text-xs text-muted-foreground">
                    当前任务：<span className="font-mono">#{activeTaskId}</span>{" "}
                    {taskQuery.isFetching ? (
                      <span>加载中...</span>
                    ) : taskQuery.data ? (
                      <Badge variant={taskQuery.data.status === "failed" ? "destructive" : "secondary"}>
                        {taskQuery.data.status}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {results ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">执行结果</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const merged = Object.entries(results)
                        .map(([host, r]) => {
                          const header = `===== ${host} (${r.status}) =====`;
                          const body = r.exception ? `EXCEPTION: ${r.exception}` : formatUnknown(r.result);
                          return `${header}\n${body}`;
                        })
                        .join("\n\n");
                      try {
                        await navigator.clipboard.writeText(merged);
                        toast.success("已复制到剪贴板");
                      } catch {
                        toast.error("复制失败（浏览器权限限制）");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    复制全部
                  </Button>
                </div>

                <div className="space-y-3">
                  {Object.entries(results).map(([host, r]) => (
                    <Card key={host}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{host}</div>
                          <Badge variant={r.status === "success" ? "secondary" : "destructive"}>{r.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {r.exception ? (
                          <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs text-destructive">
                            {r.exception}
                          </pre>
                        ) : null}
                        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs">
                          {formatUnknown(r.result)}
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
