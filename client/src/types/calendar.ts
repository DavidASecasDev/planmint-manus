export type CalendarViewMode = 'month' | 'week' | 'day' | 'range';

export interface CalendarFilters {
  search: string;
  status: 'all' | 'pending' | 'in_progress' | 'blocked' | 'completed';
  priority: 'all' | 'low' | 'medium' | 'high' | 'urgent';
  type: 'all' | 'simple' | 'goal_numeric' | 'goal_milestones';
  areaIds: string[];
  tagIds: string[];
  assigneeId: string | null;
  onlyMine: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  type: 'all',
  areaIds: [],
  tagIds: [],
  assigneeId: null,
  onlyMine: false,
  dateFrom: null,
  dateTo: null,
};
