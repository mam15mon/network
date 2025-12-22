import { Copy, Download, FileUp, Plus, RefreshCw, Save, Trash2, Unplug, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import { InventoryDevice } from "@/lib/types";
import { exportDevicesXlsx, parseDevicesXlsx, type InventoryDeviceRow } from "@/lib/xlsx";

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

async function fetchDevices(search: string): Promise<InventoryDevice[]> {
  const sp = new URLSearchParams();
  sp.set("limit", "200");
  sp.set("offset", "0");
  if (search.trim()) sp.set("search", search.trim());
  return apiFetch<InventoryDevice[]>(`/api/v1/inventory/devices?${sp.toString()}`);
}

export function InventoryPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [siteFilter, setSiteFilter] = useState("");
  const debouncedSite = useDebouncedValue(siteFilter, 300);

  const [typeFilter, setTypeFilter] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedNames = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState("default");
  const [scheduleIntervalMin, setScheduleIntervalMin] = useState("60");
  const [scheduleRunImmediately, setScheduleRunImmediately] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    hostname: "",
    site: "",
    device_type: "switch",
    platform: "hp_comware",
    port: "22",
    username: "",
    password: "",
    timeout: "",
    model: "",
    description: "",
    is_active: true,
  });

  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<InventoryDeviceRow[] | null>(null);

  const devicesQuery = useQuery({
    queryKey: ["inventory-devices", debouncedSearch, debouncedSite, typeFilter],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("limit", "200");
      sp.set("offset", "0");
      if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
      if (debouncedSite.trim()) sp.set("site", debouncedSite.trim());
      if (typeFilter.trim()) sp.set("device_type", typeFilter.trim());
      return apiFetch<InventoryDevice[]>(`/api/v1/inventory/devices?${sp.toString()}`);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => apiFetch<{ message: string }>("/api/v1/inventory/refresh", { method: "POST" }),
    onSuccess: (data) => {
      toast.success(data.message || "库存缓存刷新成功");
      void queryClient.invalidateQueries({ queryKey: ["inventory-devices"] });
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const createDeviceMutation = useMutation({
    mutationFn: async () => {
      const name = createForm.name.trim();
      const hostname = createForm.hostname.trim();
      const platform = createForm.platform.trim() || "cisco_ios";
      const portNum = createForm.port.trim() ? Number(createForm.port.trim()) : 22;
      const timeoutNum = createForm.timeout.trim() ? Number(createForm.timeout.trim()) : undefined;

      if (!name) throw new Error("name 不能为空");
      if (!hostname) throw new Error("hostname 不能为空");
      if (!Number.isFinite(portNum) || portNum <= 0) throw new Error("port 必须是正数");
      if (timeoutNum !== undefined && (!Number.isFinite(timeoutNum) || timeoutNum <= 0)) {
        throw new Error("timeout 必须是正数");
      }

      return apiFetch<InventoryDevice>("/api/v1/inventory/devices", {
        method: "POST",
        body: JSON.stringify({
          name,
          hostname,
          site: createForm.site.trim() || undefined,
          device_type: createForm.device_type.trim() || undefined,
          platform,
          port: portNum,
          username: createForm.username.trim() || undefined,
          password: createForm.password || undefined,
          timeout: timeoutNum,
          model: createForm.model.trim() || undefined,
          description: createForm.description.trim() || undefined,
          is_active: createForm.is_active,
        }),
      });
    },
    onSuccess: async (data) => {
      toast.success(`已新增设备：${data.name}`);
      setCreateForm((prev) => ({
        ...prev,
        name: "",
        hostname: "",
        site: "",
        device_type: "switch",
        username: "",
        password: "",
        timeout: "",
        model: "",
        description: "",
        is_active: true,
      }));
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["inventory-devices"] });
      await refreshMutation.mutateAsync();
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (names: string[]) =>
      apiFetch<{ deleted: number; not_found: string[]; failed: number }>(
        "/api/v1/inventory/devices/bulk-delete",
        {
          method: "POST",
          body: JSON.stringify({ names, confirm: true }),
        },
      ),
    onSuccess: async (data) => {
      toast.success(`已删除 ${data.deleted} 台设备`);
      setSelected({});
      await queryClient.invalidateQueries({ queryKey: ["inventory-devices"] });
      await refreshMutation.mutateAsync();
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const deleteSingleMutation = useMutation({
    mutationFn: async (name: string) =>
      apiFetch<{ message: string }>(`/api/v1/inventory/devices/${encodeURIComponent(name)}`, { method: "DELETE" }),
    onSuccess: async (data) => {
      toast.success(data.message || "删除成功");
      await queryClient.invalidateQueries({ queryKey: ["inventory-devices"] });
      await refreshMutation.mutateAsync();
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const connectivityMutation = useMutation({
    mutationFn: async (name: string) =>
      apiFetch(`/api/v1/inventory/devices/${encodeURIComponent(name)}/connectivity-test`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      const failed = data && typeof data === "object" ? (data as { failed?: boolean }).failed : undefined;
      const exception = data && typeof data === "object" ? (data as { exception?: string }).exception : undefined;
      const ok = failed === false;
      if (ok) {
        toast.success("连接测试成功");
      } else {
        toast.error(exception ? `连接测试失败：${exception}` : "连接测试失败");
      }
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (rows: InventoryDeviceRow[]) =>
      apiFetch<{ created: number; updated: number; failed: number; errors: unknown[] }>("/api/v1/inventory/devices/bulk", {
        method: "POST",
        body: JSON.stringify(
          rows.map((r) => ({
            name: r.name,
            hostname: r.hostname,
            site: r.site,
            device_type: r.device_type,
            platform: r.platform,
            port: r.port,
            username: r.username ?? undefined,
            password: r.password ?? undefined,
            timeout: r.timeout ?? undefined,
            model: r.model ?? undefined,
            description: r.description ?? undefined,
            is_active: r.is_active ?? true,
          })),
        ),
      }),
    onSuccess: async (data) => {
      toast.success(`导入完成：新增 ${data.created}，更新 ${data.updated}，失败 ${data.failed}`);
      setImportFileName(null);
      setImportPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["inventory-devices"] });
      await refreshMutation.mutateAsync();
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const backupRunningConfigMutation = useMutation({
    mutationFn: async (names: string[]) =>
      apiFetch<{ results: Record<string, { status?: string; failed?: boolean; exception?: string; snapshot_id?: number }> }>(
        "/api/v1/configs/snapshots",
        {
          method: "POST",
          body: JSON.stringify({ devices: names }),
        },
      ),
    onSuccess: (data) => {
      const results = data?.results ?? {};
      const entries = Object.entries(results);
      const ok = entries.filter(([, r]) => r && (r as { failed?: boolean }).failed === false).length;
      const failed = entries.filter(([, r]) => r && (r as { failed?: boolean }).failed !== false).length;
      setLastBackupAt(new Date().toLocaleString());
      if (failed === 0) {
        toast.success(`running-config 备份成功：${ok} 台`);
      } else {
        toast.error(`running-config 备份完成：成功 ${ok}，失败 ${failed}`);
      }
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  type BackupSchedule = {
    id: number;
    name: string;
    enabled: boolean;
    devices: string[];
    interval_minutes: number;
    last_run_at?: string | null;
    next_run_at?: string | null;
    last_status?: string | null;
    last_error?: string | null;
  };

  type SnapshotListItem = {
    id: number;
    device_name: string;
    config_type: string;
    bytes: number;
    sha256?: string | null;
    collected_at: string;
    created_by?: string | null;
  };

  const schedulesQuery = useQuery({
    queryKey: ["config-backup-schedules"],
    queryFn: async () => apiFetch<BackupSchedule[]>("/api/v1/configs/schedules?limit=200&offset=0"),
  });

  const createOrUpdateScheduleMutation = useMutation({
    mutationFn: async () => {
      const name = scheduleName.trim();
      const minutes = Number(scheduleIntervalMin.trim());
      if (!name) throw new Error("计划名称不能为空");
      if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("间隔(分钟)必须是正数");
      if (selectedNames.length === 0) throw new Error("请先选择设备");

      return apiFetch<BackupSchedule>("/api/v1/configs/schedules", {
        method: "POST",
        body: JSON.stringify({
          name,
          devices: selectedNames,
          interval_minutes: Math.floor(minutes),
          enabled: true,
          run_immediately: scheduleRunImmediately,
        }),
      });
    },
    onSuccess: async (s) => {
      toast.success(`计划已保存：#${s.id}（${s.name}）`);
      await queryClient.invalidateQueries({ queryKey: ["config-backup-schedules"] });
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (payload: { id: number; enabled?: boolean }) =>
      apiFetch<BackupSchedule>(`/api/v1/configs/schedules/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: payload.enabled }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["config-backup-schedules"] });
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const runScheduleNowMutation = useMutation({
    mutationFn: async (id: number) =>
      apiFetch<{ message: string }>(`/api/v1/configs/schedules/${id}/run-now`, { method: "POST" }),
    onSuccess: (data) => toast.success(data.message || "已触发"),
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => apiFetch<{ message: string }>(`/api/v1/configs/schedules/${id}`, { method: "DELETE" }),
    onSuccess: async (data) => {
      toast.success(data.message || "删除成功");
      await queryClient.invalidateQueries({ queryKey: ["config-backup-schedules"] });
    },
    onError: (e) => toast.error(errorToMessage(e)),
  });

  const selectedDeviceName = selectedNames.length === 1 ? selectedNames[0] : "";
  const snapshotsQuery = useQuery({
    queryKey: ["config-snapshots", selectedDeviceName],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("limit", "50");
      sp.set("offset", "0");
      if (selectedDeviceName) sp.set("device_name", selectedDeviceName);
      return apiFetch<SnapshotListItem[]>(`/api/v1/configs/snapshots?${sp.toString()}`);
    },
  });

  const [activeSnapshotId, setActiveSnapshotId] = useState<number | null>(null);
  const snapshotDetailQuery = useQuery({
    queryKey: ["config-snapshot-detail", activeSnapshotId],
    enabled: activeSnapshotId != null,
    queryFn: async () =>
      apiFetch<{ id: number; device_name: string; collected_at: string; content: string }>(
        `/api/v1/configs/snapshots/${activeSnapshotId}`,
      ),
  });

  const allDevices = devicesQuery.data ?? [];
  const allSelected = allDevices.length > 0 && allDevices.every((d) => selected[d.name]);
  const someSelected = allDevices.some((d) => selected[d.name]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">库存</h1>
          <p className="text-sm text-muted-foreground">设备列表、XLSX 导入导出、批量删除、单设备连接测试。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title="刷新 Nornir 库存缓存"
          >
            <RefreshCw className="h-4 w-4" />
            刷新缓存
          </Button>
          <Button variant="outline" onClick={() => setCreateOpen((v) => !v)}>
            {createOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {createOpen ? "收起新增" : "新增设备"}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4" />
            导入 XLSX
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const rows: InventoryDeviceRow[] = allDevices.map((d) => ({
                name: d.name,
                hostname: d.hostname,
                site: d.site ?? undefined,
                device_type: d.device_type ?? undefined,
                platform: d.platform,
                port: d.port,
                username: d.username,
                timeout: d.timeout,
                model: d.model,
                description: d.description,
                is_active: d.is_active,
              }));
              exportDevicesXlsx(rows, "devices.xlsx");
            }}
            disabled={allDevices.length === 0}
          >
            <Download className="h-4 w-4" />
            导出 XLSX
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (selectedNames.length === 0) return;
              const ok = window.confirm(`确认删除已选 ${selectedNames.length} 台设备？此操作不可恢复。`);
              if (!ok) return;
              bulkDeleteMutation.mutate(selectedNames);
            }}
            disabled={selectedNames.length === 0 || bulkDeleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            删除已选
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const parsed = await parseDevicesXlsx(file);
            setImportFileName(file.name);
            setImportPreview(parsed);
            toast.message(`已读取 ${parsed.length} 行设备数据`);
          } catch (err) {
            toast.error(errorToMessage(err));
          }
        }}
      />

	      {createOpen ? (
	        <Card>
	          <CardHeader className="pb-4">
	            <CardTitle>新增设备</CardTitle>
	            <CardDescription>写入数据库库存；成功后自动刷新 Nornir 缓存。</CardDescription>
	          </CardHeader>
	          <CardContent className="space-y-3">
	            <div className="grid gap-3 lg:grid-cols-3">
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">name *</div>
	                <Input
	                  placeholder="例如 sw1"
	                  value={createForm.name}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
	                />
	              </div>
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">hostname *</div>
	                <Input
	                  placeholder="例如 10.0.0.1"
	                  value={createForm.hostname}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, hostname: e.target.value }))}
	                />
	              </div>
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">site</div>
	                <Input
	                  placeholder="例如 福建 / DC1"
	                  value={createForm.site}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, site: e.target.value }))}
	                />
	              </div>
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">device_type</div>
	                <select
	                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	                  value={createForm.device_type}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, device_type: e.target.value }))}
	                >
	                  <option value="switch">switch</option>
	                  <option value="router">router</option>
	                  <option value="firewall">firewall</option>
	                </select>
	              </div>
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">platform</div>
	                <Input
	                  placeholder="huawei_vrp / h3c_comware / cisco_iosxe ..."
	                  value={createForm.platform}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, platform: e.target.value }))}
	                />
	              </div>
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">port</div>
	                <Input
	                  inputMode="numeric"
	                  value={createForm.port}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, port: e.target.value }))}
	                />
	              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">username</div>
                <Input
                  value={createForm.username}
                  onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">password</div>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">timeout(秒)</div>
	                <Input
	                  inputMode="numeric"
	                  placeholder="留空走默认"
	                  value={createForm.timeout}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, timeout: e.target.value }))}
	                />
	              </div>
	              <div className="space-y-2">
	                <div className="text-xs text-muted-foreground">model</div>
	                <Input
	                  placeholder="例如 S6730-H48X6C"
	                  value={createForm.model}
	                  onChange={(e) => setCreateForm((p) => ({ ...p, model: e.target.value }))}
	                />
	              </div>
	            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">description</div>
              <Input
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <label className="flex select-none items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(e) => setCreateForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              is_active
            </label>

            <div className="flex items-center gap-2">
              <Button onClick={() => createDeviceMutation.mutate()} disabled={createDeviceMutation.isPending}>
                <Plus className="h-4 w-4" />
                新增
              </Button>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                收起
              </Button>
              {createDeviceMutation.isPending ? <span className="text-xs text-muted-foreground">提交中...</span> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>设备列表</CardTitle>
          <CardDescription>默认最多加载 200 条；可按站点/类型过滤。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="搜索 name / hostname"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Input
              placeholder="站点（site）"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="max-w-[220px]"
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
            {devicesQuery.isError ? (
              <span className="text-xs text-destructive">{errorToMessage(devicesQuery.error)}</span>
            ) : null}
            <div className="ml-auto text-xs text-muted-foreground">共 {allDevices.length} 台</div>
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
                        for (const d of allDevices) next[d.name] = true;
                      }
                      setSelected(next);
                    }}
                  />
	                </TableHead>
	                <TableHead>名称</TableHead>
	                <TableHead>主机名</TableHead>
	                <TableHead>站点</TableHead>
	                <TableHead>类型</TableHead>
	                <TableHead>平台</TableHead>
	                <TableHead>型号</TableHead>
	                <TableHead className="w-[220px]">操作</TableHead>
	              </TableRow>
	            </TableHeader>
	            <TableBody>
	              {allDevices.map((d) => (
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
	                  <TableCell className="font-mono text-xs">{d.hostname}</TableCell>
	                  <TableCell>{d.site ?? "-"}</TableCell>
	                  <TableCell>{d.device_type ?? "-"}</TableCell>
	                  <TableCell>
	                    <Badge variant="secondary">{d.platform}</Badge>
	                  </TableCell>
	                  <TableCell>{d.model ?? "-"}</TableCell>
	                  <TableCell>
	                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => connectivityMutation.mutate(d.name)}
                        disabled={connectivityMutation.isPending}
                      >
                        <Unplug className="h-4 w-4" />
                        连接测试
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const ok = window.confirm(`确认删除设备 ${d.name}？此操作不可恢复。`);
                          if (!ok) return;
                          deleteSingleMutation.mutate(d.name);
                        }}
                        disabled={deleteSingleMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

	              {allDevices.length === 0 && !devicesQuery.isLoading ? (
	                <TableRow>
	                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
	                    暂无设备
	                  </TableCell>
	                </TableRow>
	              ) : null}
	            </TableBody>
	          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Running-config 备份</CardTitle>
          <CardDescription>支持手动备份，以及后端定时计划（不依赖浏览器）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm text-muted-foreground">已选 {selectedNames.length} 台设备</div>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedNames.length === 0) return toast.error("请先选择设备");
                backupRunningConfigMutation.mutate(selectedNames);
              }}
              disabled={selectedNames.length === 0 || backupRunningConfigMutation.isPending}
            >
              <Save className="h-4 w-4" />
              立即备份
            </Button>

            {lastBackupAt ? <div className="text-xs text-muted-foreground">最近：{lastBackupAt}</div> : null}
            {backupRunningConfigMutation.isPending ? (
              <div className="text-xs text-muted-foreground">备份中...</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>备份计划（后端）</CardTitle>
          <CardDescription>计划保存在数据库，后端定时触发采集并落库。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="计划名称（同名会覆盖）"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              className="h-9 w-[220px]"
            />
            <Input
              inputMode="numeric"
              placeholder="间隔(分钟)"
              value={scheduleIntervalMin}
              onChange={(e) => setScheduleIntervalMin(e.target.value)}
              className="h-9 w-[140px]"
            />
            <label className="flex select-none items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scheduleRunImmediately}
                onChange={(e) => setScheduleRunImmediately(e.target.checked)}
              />
              创建后立即执行一次
            </label>
            <Button
              variant="outline"
              onClick={() => createOrUpdateScheduleMutation.mutate()}
              disabled={createOrUpdateScheduleMutation.isPending}
            >
              <Save className="h-4 w-4" />
              保存计划（按已选设备）
            </Button>
            {createOrUpdateScheduleMutation.isPending ? (
              <span className="text-xs text-muted-foreground">保存中...</span>
            ) : null}
            {schedulesQuery.isFetching ? <span className="text-xs text-muted-foreground">加载计划中...</span> : null}
            {schedulesQuery.isError ? (
              <span className="text-xs text-destructive">{errorToMessage(schedulesQuery.error)}</span>
            ) : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">ID</TableHead>
                <TableHead>name</TableHead>
                <TableHead>enabled</TableHead>
                <TableHead>devices</TableHead>
                <TableHead>interval</TableHead>
                <TableHead>last</TableHead>
                <TableHead>next</TableHead>
                <TableHead>status</TableHead>
                <TableHead className="w-[260px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(schedulesQuery.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.enabled ? "true" : "false"}</TableCell>
                  <TableCell>{Array.isArray(s.devices) ? s.devices.length : 0}</TableCell>
                  <TableCell>{s.interval_minutes}m</TableCell>
                  <TableCell className="font-mono text-xs">{s.last_run_at ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.next_run_at ?? "-"}</TableCell>
                  <TableCell>{s.last_status ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runScheduleNowMutation.mutate(s.id)}
                        disabled={runScheduleNowMutation.isPending || !s.enabled}
                      >
                        立即执行
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateScheduleMutation.mutate({ id: s.id, enabled: !s.enabled })}
                        disabled={updateScheduleMutation.isPending}
                      >
                        {s.enabled ? "停用" : "启用"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const ok = window.confirm(`确认删除计划 #${s.id}（${s.name}）？`);
                          if (!ok) return;
                          deleteScheduleMutation.mutate(s.id);
                        }}
                        disabled={deleteScheduleMutation.isPending}
                      >
                        删除
                      </Button>
                    </div>
                    {s.last_error ? <div className="mt-2 text-xs text-destructive">{s.last_error}</div> : null}
                  </TableCell>
                </TableRow>
              ))}
              {(schedulesQuery.data ?? []).length === 0 && !schedulesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    暂无计划
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>配置快照</CardTitle>
          <CardDescription>
            快照已存储在数据库（`config_snapshots`）。{selectedDeviceName ? `当前按设备过滤：${selectedDeviceName}` : "（未过滤）"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["config-snapshots"] })}
            >
              <RefreshCw className="h-4 w-4" />
              刷新快照
            </Button>
            {snapshotsQuery.isFetching ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
            {snapshotsQuery.isError ? (
              <span className="text-xs text-destructive">{errorToMessage(snapshotsQuery.error)}</span>
            ) : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>device</TableHead>
                <TableHead>collected_at</TableHead>
                <TableHead>bytes</TableHead>
                <TableHead>sha256</TableHead>
                <TableHead>by</TableHead>
                <TableHead className="w-32">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(snapshotsQuery.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell className="font-medium">{s.device_name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.collected_at}</TableCell>
                  <TableCell className="font-mono text-xs">{s.bytes}</TableCell>
                  <TableCell className="font-mono text-xs">{s.sha256 ? s.sha256.slice(0, 10) : "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.created_by ?? "-"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setActiveSnapshotId(s.id)}>
                      查看
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(snapshotsQuery.data ?? []).length === 0 && !snapshotsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    暂无快照
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          {activeSnapshotId != null ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">快照 #{activeSnapshotId}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const content = snapshotDetailQuery.data?.content ?? "";
                        try {
                          await navigator.clipboard.writeText(content);
                          toast.success("已复制");
                        } catch {
                          toast.error("复制失败（浏览器权限限制）");
                        }
                      }}
                      disabled={!snapshotDetailQuery.data?.content}
                    >
                      <Copy className="h-4 w-4" />
                      复制
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveSnapshotId(null)}>
                      <X className="h-4 w-4" />
                      关闭
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {snapshotDetailQuery.isFetching ? (
                  <div className="text-xs text-muted-foreground">加载中...</div>
                ) : snapshotDetailQuery.isError ? (
                  <div className="text-xs text-destructive">{errorToMessage(snapshotDetailQuery.error)}</div>
                ) : (
                  <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs">
                    {snapshotDetailQuery.data?.content ?? ""}
                  </pre>
                )}
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>

      {importPreview ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>导入预览</CardTitle>
            <CardDescription>
              文件：{importFileName}（共 {importPreview.length} 行，仅预览前 20 行）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Button onClick={() => bulkImportMutation.mutate(importPreview)} disabled={bulkImportMutation.isPending}>
                <FileUp className="h-4 w-4" />
                确认导入
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setImportFileName(null);
                  setImportPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                取消
              </Button>
              {bulkImportMutation.isPending ? <span className="text-xs text-muted-foreground">导入中...</span> : null}
            </div>

	            <Table>
	              <TableHeader>
	                <TableRow>
	                  <TableHead>name</TableHead>
	                  <TableHead>hostname</TableHead>
	                  <TableHead>site</TableHead>
	                  <TableHead>device_type</TableHead>
	                  <TableHead>platform</TableHead>
	                </TableRow>
	              </TableHeader>
	              <TableBody>
	                {importPreview.slice(0, 20).map((r, idx) => (
	                  <TableRow key={`${r.name}-${idx}`}>
	                    <TableCell className="font-medium">{r.name}</TableCell>
	                    <TableCell className="font-mono text-xs">{r.hostname}</TableCell>
	                    <TableCell>{r.site ?? "-"}</TableCell>
	                    <TableCell>{r.device_type ?? "-"}</TableCell>
	                    <TableCell>{r.platform ?? "-"}</TableCell>
	                  </TableRow>
	                ))}
	              </TableBody>
	            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
