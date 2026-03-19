export interface ReportFilters {
  dateRange: '7d' | '30d' | '90d' | 'custom';
  startDate?: Date;
  endDate?: Date;
  areaIds?: string[];
  tagIds?: string[];
  assigneeId?: string;
  status?: string;
  taskType?: 'simple' | 'goal_numeric' | 'goal_milestones' | 'all';
}

export interface TaskMetrics {
  tasksCreated: number;
  tasksCompleted: number;
  tasksDeleted: number;
  tasksOpen: number;
  tasksInProgress: number;
  tasksBlocked: number;
  tasksOverdue: number;
  overdueRate: number;
}

export interface FlowMetrics {
  avgCycleTime: number | null; // in days
  avgLeadTime: number | null; // in days
  throughput: number; // completed per period
}

export interface GoalMetrics {
  goalsTotal: number;
  goalsCompleted: number;
  goalsInProgress: number;
  goalProgressAvg: number;
  goalsAtRisk: number;
}

export interface UsageMetrics {
  kanbanViews: number;
  calendarViews: number;
  globalSearchUses: number;
  automationRuns: number;
  aiSummariesGenerated: number;
}

export interface ReportSnapshot {
  id: string;
  organization_id: string;
  scope: 'org' | 'user' | 'area' | 'team';
  scope_id: string | null;
  period: 'daily' | 'weekly' | 'monthly';
  date_key: string;
  metrics_json: Record<string, any>;
  created_at: string;
}

export interface DashboardKPIs {
  taskMetrics: TaskMetrics;
  flowMetrics: FlowMetrics;
  goalMetrics: GoalMetrics;
  usageMetrics?: UsageMetrics;
}

export interface AreaReport {
  areaId: string;
  areaName: string;
  areaColor: string | null;
  areaIcon: string | null;
  tasksOpen: number;
  tasksCompleted: number;
  tasksOverdue: number;
  tasksBlocked: number;
  avgCycleTime: number | null;
  topTags: { tagId: string; tagName: string; count: number }[];
}

export interface UserReport {
  userId: string;
  userName: string | null;
  tasksOpen: number;
  tasksCompleted: number;
  tasksOverdue: number;
  avgCycleTime: number | null;
}

export interface ReportInsight {
  type: 'warning' | 'info' | 'success';
  icon: string;
  message: string;
  metric?: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface CompletionTrend {
  date: string;
  completed: number;
  created: number;
}

export const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: 'custom', label: 'Personalizado' },
] as const;

export const TASK_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'blocked', label: 'Bloqueada' },
  { value: 'completed', label: 'Completada' },
] as const;

export const TASK_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'simple', label: 'Tarea simple' },
  { value: 'goal_numeric', label: 'Objetivo numérico' },
  { value: 'goal_milestones', label: 'Objetivo con hitos' },
] as const;

// Vehicle Cleaning Reports Types
export interface VehicleCleaningUserStats {
  userId: string;
  userName: string | null;
  vehiclesCleaned: number;
  vehiclesFullyCleaned: number;
  tasksByType: Record<string, number>;
  totalTasks: number;
  // Time tracking metrics
  avgCleaningTimeMinutes: number | null;
  totalCleaningTimeMinutes: number;
  vehiclesWithTimeData: number;
}

export interface VehicleCleaningMetrics {
  totalVehiclesCleaned: number;
  totalTasksCompleted: number;
  avgTasksPerVehicle: number;
  avgTasksPerUser: number;
  tasksByType: { taskKey: string; taskLabel: string; count: number }[];
  cleaningTrend: { date: string; count: number }[];
  // Time tracking metrics
  avgCleaningTimeMinutes: number | null;
  minCleaningTimeMinutes: number | null;
  maxCleaningTimeMinutes: number | null;
  cleaningTimeDistribution: { range: string; count: number }[];
}

export interface VehicleCleaningReport {
  metrics: VehicleCleaningMetrics;
  userStats: VehicleCleaningUserStats[];
}
