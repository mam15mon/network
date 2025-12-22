import client from './client';

// Types
export interface SNMPMetric {
  id: number;
  name: string;
  oid: string;
  description?: string;
  value_type: string;
  unit?: string;
  value_parser?: string;
  collector?: string;
  collector_config?: string;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface SNMPMetricCreate {
  name: string;
  oid: string;
  description?: string;
  value_type?: string;
  unit?: string;
  value_parser?: string;
  collector?: string;
  collector_config?: string;
}

export interface SNMPMonitorTask {
  id: number;
  name: string;
  host_id: number;
  metric_id: number;
  interval: number;
  enabled: boolean;
  last_poll_at?: string;
  last_value?: string;
  last_status: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface SNMPMonitorTaskDetail extends SNMPMonitorTask {
  host_name?: string;
  host_hostname?: string;
  host_site?: string;
  metric_name?: string;
  metric_oid?: string;
  metric_unit?: string;
  metric_collector?: string;
  metric_collector_config?: string;
  alerts: SNMPAlert[];
}

export interface SNMPMonitorTaskCreate {
  name: string;
  host_id: number;
  metric_id: number;
  interval?: number;
  enabled?: boolean;
}

export interface SNMPBatchTaskCreate {
  host_ids: number[];
  metric_ids: number[];
  interval?: number;
  enabled?: boolean;
}

export interface SNMPDataPoint {
  id: number;
  task_id: number;
  value: string;
  raw_value?: string;
  timestamp: string;
}

export interface SNMPAlert {
  id: number;
  task_id: number;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  message?: string;
  created_at: string;
  updated_at: string;
}

export interface SNMPAlertCreate {
  task_id: number;
  condition: string;
  threshold: number;
  severity?: string;
  enabled?: boolean;
  message?: string;
}

export interface SNMPTestRequest {
  host_id: number;
  oid: string;
  snmp_version?: string;
  snmp_community?: string;
}

export interface SNMPTestValue {
  oid: string;
  type: string;
  value: string;
  raw: string;
}

export interface SNMPTestResponse {
  success: boolean;
  raw_output?: string;
  parsed_values?: SNMPTestValue[];
  error?: string;
}

export interface SNMPMonitorStats {
  total_tasks: number;
  active_tasks: number;
  failed_tasks: number;
  total_hosts: number;
  total_metrics: number;
}

export interface SNMPBuiltinMetric {
  name: string;
  oid: string;
  description?: string;
  value_type?: string;
  unit?: string;
  value_parser?: string;
}

// API Functions
export const snmpApi = {
  // Metrics
  getMetrics: async (): Promise<SNMPMetric[]> => {
    const { data } = await client.get<SNMPMetric[]>('/snmp/metrics');
    return data;
  },

  getBuiltinMetrics: async (): Promise<SNMPBuiltinMetric[]> => {
    const { data } = await client.get<SNMPBuiltinMetric[]>('/snmp/metrics/builtin');
    return data;
  },

  createMetric: async (metric: SNMPMetricCreate): Promise<SNMPMetric> => {
    const { data } = await client.post<SNMPMetric>('/snmp/metrics', metric);
    return data;
  },

  updateMetric: async (id: number, metric: Partial<SNMPMetricCreate>): Promise<SNMPMetric> => {
    const { data } = await client.put<SNMPMetric>(`/snmp/metrics/${id}`, metric);
    return data;
  },

  deleteMetric: async (id: number): Promise<void> => {
    await client.delete(`/snmp/metrics/${id}`);
  },

  // Test
  testOID: async (request: SNMPTestRequest): Promise<SNMPTestResponse> => {
    const { data } = await client.post<SNMPTestResponse>('/snmp/test', request);
    return data;
  },

  // Tasks
  getTasks: async (params?: {
    host_id?: number;
    metric_id?: number;
    enabled?: boolean;
  }): Promise<SNMPMonitorTaskDetail[]> => {
    const { data } = await client.get<SNMPMonitorTaskDetail[]>('/snmp/tasks', { params });
    return data;
  },

  createTask: async (task: SNMPMonitorTaskCreate): Promise<SNMPMonitorTask> => {
    const { data } = await client.post<SNMPMonitorTask>('/snmp/tasks', task);
    return data;
  },

  createBatchTasks: async (batch: SNMPBatchTaskCreate): Promise<SNMPMonitorTask[]> => {
    const { data } = await client.post<SNMPMonitorTask[]>('/snmp/tasks/batch', batch);
    return data;
  },

  updateTask: async (id: number, task: Partial<SNMPMonitorTaskCreate>): Promise<SNMPMonitorTask> => {
    const { data } = await client.put<SNMPMonitorTask>(`/snmp/tasks/${id}`, task);
    return data;
  },

  deleteTask: async (id: number): Promise<void> => {
    await client.delete(`/snmp/tasks/${id}`);
  },

  deleteTasks: async (taskIds: number[]): Promise<void> => {
    await client.post('/snmp/tasks/batch/delete', { task_ids: taskIds });
  },

  cleanupHistory: async (options: { days?: number; deleteAll?: boolean }): Promise<{ deleted: number }> => {
    const { data } = await client.post<{ deleted: number }>('/snmp/data/cleanup', {
      days: options.days ?? 90,
      delete_all: options.deleteAll ?? false,
    });
    return data;
  },

  // Data Points
  getTaskData: async (
    taskId: number,
    options: { hours?: number; startTime?: string; endTime?: string } = {},
  ): Promise<SNMPDataPoint[]> => {
    const { hours = 24, startTime, endTime } = options;
    const params: Record<string, string | number> = { hours };
    if (startTime) {
      params.start_time = startTime;
    }
    if (endTime) {
      params.end_time = endTime;
    }

    const { data } = await client.get<SNMPDataPoint[]>(`/snmp/tasks/${taskId}/data`, {
      params,
    });
    return data;
  },

  // Alerts
  createAlert: async (alert: SNMPAlertCreate): Promise<SNMPAlert> => {
    const { data } = await client.post<SNMPAlert>('/snmp/alerts', alert);
    return data;
  },

  updateAlert: async (id: number, alert: Partial<SNMPAlertCreate>): Promise<SNMPAlert> => {
    const { data } = await client.put<SNMPAlert>(`/snmp/alerts/${id}`, alert);
    return data;
  },

  deleteAlert: async (id: number): Promise<void> => {
    await client.delete(`/snmp/alerts/${id}`);
  },

  // Stats
  getStats: async (): Promise<SNMPMonitorStats> => {
    const { data } = await client.get<SNMPMonitorStats>('/snmp/stats');
    return data;
  },
};
