import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ReportFilters, 
  TaskMetrics, 
  FlowMetrics, 
  GoalMetrics, 
  UsageMetrics,
  DashboardKPIs,
  CompletionTrend,
  AreaReport,
  UserReport,
  ReportInsight
} from '@/types/reports';
import { subDays, startOfDay, endOfDay, format, differenceInDays } from 'date-fns';

function getDateRange(filters: ReportFilters): { start: Date; end: Date } {
  const end = endOfDay(new Date());
  let start: Date;

  switch (filters.dateRange) {
    case '7d':
      start = startOfDay(subDays(end, 7));
      break;
    case '30d':
      start = startOfDay(subDays(end, 30));
      break;
    case '90d':
      start = startOfDay(subDays(end, 90));
      break;
    case 'custom':
      start = filters.startDate ? startOfDay(filters.startDate) : startOfDay(subDays(end, 30));
      break;
    default:
      start = startOfDay(subDays(end, 30));
  }

  return { start, end: filters.endDate ? endOfDay(filters.endDate) : end };
}

export function useReportMetrics(filters: ReportFilters, scope: 'org' | 'personal' = 'org') {
  const { profile } = useAuth();

  const { start, end } = useMemo(() => getDateRange(filters), [filters]);

  // Fetch task metrics
  const { data: taskMetrics, isLoading: loadingTasks } = useQuery({
    queryKey: ['report-task-metrics', profile?.organization_id, filters, scope],
    queryFn: async (): Promise<TaskMetrics> => {
      if (!profile?.organization_id) throw new Error('No organization');

      let query = supabase
        .from('tasks')
        .select('id, status, due_date, created_at, is_archived')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false);

      // Personal scope filter
      if (scope === 'personal') {
        query = query.or(`created_by.eq.${profile.id},assigned_to.eq.${profile.id}`);
      }

      // Apply filters
      if (filters.assigneeId && filters.assigneeId !== 'all') {
        query = query.eq('assigned_to', filters.assigneeId);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.taskType && filters.taskType !== 'all') {
        query = query.eq('type', filters.taskType as string);
      }

      const { data: tasks, error } = await query;
      if (error) throw error;

      // Filter by date range for created
      const tasksInRange = (tasks || []).filter(t => {
        const created = new Date(t.created_at);
        return created >= start && created <= end;
      });

      // Get completed tasks in range
      const { data: completedTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'completed')
        .eq('is_archived', false)
        .gte('updated_at', start.toISOString())
        .lte('updated_at', end.toISOString());

      const now = new Date();
      const allTasks = tasks || [];
      const openTasks = allTasks.filter(t => t.status !== 'completed');
      const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < now);

      return {
        tasksCreated: tasksInRange.length,
        tasksCompleted: completedTasks?.length || 0,
        tasksDeleted: 0, // Would need audit logs to track
        tasksOpen: openTasks.length,
        tasksInProgress: allTasks.filter(t => t.status === 'in_progress').length,
        tasksBlocked: allTasks.filter(t => t.status === 'blocked').length,
        tasksOverdue: overdueTasks.length,
        overdueRate: openTasks.length > 0 ? (overdueTasks.length / openTasks.length) * 100 : 0,
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch flow metrics (cycle time, lead time)
  const { data: flowMetrics, isLoading: loadingFlow } = useQuery({
    queryKey: ['report-flow-metrics', profile?.organization_id, filters, scope],
    queryFn: async (): Promise<FlowMetrics> => {
      if (!profile?.organization_id) throw new Error('No organization');

      let query = supabase
        .from('tasks')
        .select('id, created_at, started_at, completed_at, status')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'completed')
        .eq('is_archived', false)
        .not('completed_at', 'is', null);

      if (scope === 'personal') {
        query = query.or(`created_by.eq.${profile.id},assigned_to.eq.${profile.id}`);
      }

      const { data: completedTasks, error } = await query;
      if (error) throw error;

      const tasksInRange = (completedTasks || []).filter(t => {
        const completed = new Date(t.completed_at!);
        return completed >= start && completed <= end;
      });

      // Calculate cycle time (started_at to completed_at)
      const cycleTimeTasks = tasksInRange.filter(t => t.started_at && t.completed_at);
      const cycleTimes = cycleTimeTasks.map(t => 
        differenceInDays(new Date(t.completed_at!), new Date(t.started_at!))
      );
      const avgCycleTime = cycleTimes.length > 0 
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length 
        : null;

      // Calculate lead time (created_at to completed_at)
      const leadTimes = tasksInRange
        .filter(t => t.completed_at)
        .map(t => differenceInDays(new Date(t.completed_at!), new Date(t.created_at)));
      const avgLeadTime = leadTimes.length > 0 
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length 
        : null;

      return {
        avgCycleTime,
        avgLeadTime,
        throughput: tasksInRange.length,
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch goal metrics
  const { data: goalMetrics, isLoading: loadingGoals } = useQuery({
    queryKey: ['report-goal-metrics', profile?.organization_id, filters, scope],
    queryFn: async (): Promise<GoalMetrics> => {
      if (!profile?.organization_id) throw new Error('No organization');

      let query = supabase
        .from('tasks')
        .select('id, status, type, goal_target_value, updated_at')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false)
        .in('type', ['goal_numeric', 'goal_milestones']);

      if (scope === 'personal') {
        query = query.or(`created_by.eq.${profile.id},assigned_to.eq.${profile.id}`);
      }

      const { data: goals, error } = await query;
      if (error) throw error;

      const allGoals = goals || [];
      const completedGoals = allGoals.filter(g => g.status === 'completed');
      const inProgressGoals = allGoals.filter(g => g.status === 'in_progress');
      
      // Goals at risk: no update in 7+ days and not completed
      const sevenDaysAgo = subDays(new Date(), 7);
      const atRiskGoals = allGoals.filter(g => 
        g.status !== 'completed' && 
        new Date(g.updated_at) < sevenDaysAgo
      );

      // Calculate average progress for numeric goals
      const numericGoals = allGoals.filter(g => g.type === 'goal_numeric' && g.goal_target_value);
      let goalProgressAvg = 0;
      
      if (numericGoals.length > 0) {
        // This would need task_updates to calculate actual progress
        // For now, estimate based on status
        const progressValues = numericGoals.map(g => {
          if (g.status === 'completed') return 100;
          if (g.status === 'in_progress') return 50;
          return 0;
        });
        goalProgressAvg = progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
      }

      return {
        goalsTotal: allGoals.length,
        goalsCompleted: completedGoals.length,
        goalsInProgress: inProgressGoals.length,
        goalProgressAvg,
        goalsAtRisk: atRiskGoals.length,
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch usage metrics (from usage_events)
  const { data: usageMetrics, isLoading: loadingUsage } = useQuery({
    queryKey: ['report-usage-metrics', profile?.organization_id, filters],
    queryFn: async (): Promise<UsageMetrics> => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { data: events, error } = await supabase
        .from('usage_events')
        .select('event_type')
        .eq('organization_id', profile.organization_id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;

      const eventCounts = (events || []).reduce((acc, e) => {
        acc[e.event_type] = (acc[e.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        kanbanViews: eventCounts['kanban_viewed'] || 0,
        calendarViews: eventCounts['calendar_viewed'] || 0,
        globalSearchUses: eventCounts['search_used'] || 0,
        automationRuns: eventCounts['automation_ran'] || 0,
        aiSummariesGenerated: eventCounts['ai_summary_generated'] || 0,
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch completion trend
  const { data: completionTrend, isLoading: loadingTrend } = useQuery({
    queryKey: ['report-completion-trend', profile?.organization_id, filters, scope],
    queryFn: async (): Promise<CompletionTrend[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, created_at, completed_at, status')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;

      // Group by date
      const dateMap = new Map<string, { completed: number; created: number }>();
      
      (tasks || []).forEach(task => {
        const createdDate = format(new Date(task.created_at), 'yyyy-MM-dd');
        if (!dateMap.has(createdDate)) {
          dateMap.set(createdDate, { completed: 0, created: 0 });
        }
        dateMap.get(createdDate)!.created++;

        if (task.completed_at) {
          const completedDate = format(new Date(task.completed_at), 'yyyy-MM-dd');
          if (!dateMap.has(completedDate)) {
            dateMap.set(completedDate, { completed: 0, created: 0 });
          }
          dateMap.get(completedDate)!.completed++;
        }
      });

      return Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!profile?.organization_id,
  });

  const isLoading = loadingTasks || loadingFlow || loadingGoals || loadingUsage || loadingTrend;

  const kpis: DashboardKPIs = {
    taskMetrics: taskMetrics || {
      tasksCreated: 0,
      tasksCompleted: 0,
      tasksDeleted: 0,
      tasksOpen: 0,
      tasksInProgress: 0,
      tasksBlocked: 0,
      tasksOverdue: 0,
      overdueRate: 0,
    },
    flowMetrics: flowMetrics || {
      avgCycleTime: null,
      avgLeadTime: null,
      throughput: 0,
    },
    goalMetrics: goalMetrics || {
      goalsTotal: 0,
      goalsCompleted: 0,
      goalsInProgress: 0,
      goalProgressAvg: 0,
      goalsAtRisk: 0,
    },
    usageMetrics,
  };

  return {
    kpis,
    completionTrend: completionTrend || [],
    isLoading,
  };
}

export function useAreaReports(filters: ReportFilters) {
  const { profile } = useAuth();
  const { start, end } = useMemo(() => getDateRange(filters), [filters]);

  return useQuery({
    queryKey: ['report-areas', profile?.organization_id, filters],
    queryFn: async (): Promise<AreaReport[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Fetch areas
      const { data: areas, error: areasError } = await supabase
        .from('areas')
        .select('id, name, color, icon')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false);

      if (areasError) throw areasError;

      // Fetch task-area relationships with task data
      const { data: taskAreas, error: taskAreasError } = await supabase
        .from('task_areas')
        .select(`
          area_id,
          task:tasks(id, status, due_date, completed_at, started_at, created_at, is_archived)
        `)
        .in('area_id', (areas || []).map(a => a.id));

      if (taskAreasError) throw taskAreasError;

      // Fetch task-tag relationships for top tags
      const { data: taskTags } = await supabase
        .from('task_tags')
        .select('task_id, tag:tags(id, name)');

      const now = new Date();

      return (areas || []).map(area => {
        const areaTasks = (taskAreas || [])
          .filter(ta => ta.area_id === area.id && ta.task && !ta.task.is_archived)
          .map(ta => ta.task!);

        const openTasks = areaTasks.filter(t => t.status !== 'completed');
        const completedTasks = areaTasks.filter(t => 
          t.status === 'completed' && 
          t.completed_at && 
          new Date(t.completed_at) >= start && 
          new Date(t.completed_at) <= end
        );
        const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < now);
        const blockedTasks = areaTasks.filter(t => t.status === 'blocked');

        // Calculate cycle time
        const cycleTimeTasks = completedTasks.filter(t => t.started_at && t.completed_at);
        const cycleTimes = cycleTimeTasks.map(t => 
          differenceInDays(new Date(t.completed_at!), new Date(t.started_at!))
        );
        const avgCycleTime = cycleTimes.length > 0 
          ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length 
          : null;

        // Get top tags for this area's tasks
        const areaTaskIds = areaTasks.map(t => t.id);
        const tagCounts = new Map<string, { tagId: string; tagName: string; count: number }>();
        
        (taskTags || [])
          .filter(tt => areaTaskIds.includes(tt.task_id) && tt.tag)
          .forEach(tt => {
            const key = tt.tag!.id;
            if (!tagCounts.has(key)) {
              tagCounts.set(key, { tagId: tt.tag!.id, tagName: tt.tag!.name, count: 0 });
            }
            tagCounts.get(key)!.count++;
          });

        const topTags = Array.from(tagCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        return {
          areaId: area.id,
          areaName: area.name,
          areaColor: area.color,
          areaIcon: area.icon,
          tasksOpen: openTasks.length,
          tasksCompleted: completedTasks.length,
          tasksOverdue: overdueTasks.length,
          tasksBlocked: blockedTasks.length,
          avgCycleTime,
          topTags,
        };
      });
    },
    enabled: !!profile?.organization_id,
  });
}

export function useTeamReports(filters: ReportFilters) {
  const { profile } = useAuth();
  const { start, end } = useMemo(() => getDateRange(filters), [filters]);

  return useQuery({
    queryKey: ['report-team', profile?.organization_id, filters],
    queryFn: async (): Promise<UserReport[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Fetch team members
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('organization_id', profile.organization_id);

      if (membersError) throw membersError;

      // Fetch all tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status, due_date, assigned_to, completed_at, started_at, is_archived')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false);

      if (tasksError) throw tasksError;

      const now = new Date();

      return (members || []).map(member => {
        const userTasks = (tasks || []).filter(t => t.assigned_to === member.id);
        const openTasks = userTasks.filter(t => t.status !== 'completed');
        const completedTasks = userTasks.filter(t => 
          t.status === 'completed' && 
          t.completed_at && 
          new Date(t.completed_at) >= start && 
          new Date(t.completed_at) <= end
        );
        const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < now);

        // Calculate cycle time
        const cycleTimeTasks = completedTasks.filter(t => t.started_at && t.completed_at);
        const cycleTimes = cycleTimeTasks.map(t => 
          differenceInDays(new Date(t.completed_at!), new Date(t.started_at!))
        );
        const avgCycleTime = cycleTimes.length > 0 
          ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length 
          : null;

        return {
          userId: member.id,
          userName: member.name,
          tasksOpen: openTasks.length,
          tasksCompleted: completedTasks.length,
          tasksOverdue: overdueTasks.length,
          avgCycleTime,
        };
      });
    },
    enabled: !!profile?.organization_id,
  });
}

export function useReportInsights(kpis: DashboardKPIs, previousKpis?: DashboardKPIs): ReportInsight[] {
  return useMemo(() => {
    const insights: ReportInsight[] = [];

    // Blocked tasks warning
    if (kpis.taskMetrics.tasksBlocked > 0) {
      insights.push({
        type: 'warning',
        icon: 'AlertTriangle',
        message: `Tienes ${kpis.taskMetrics.tasksBlocked} tarea${kpis.taskMetrics.tasksBlocked > 1 ? 's' : ''} bloqueada${kpis.taskMetrics.tasksBlocked > 1 ? 's' : ''}`,
        metric: 'blocked',
      });
    }

    // High overdue rate warning
    if (kpis.taskMetrics.overdueRate > 20) {
      insights.push({
        type: 'warning',
        icon: 'Clock',
        message: `La tasa de tareas vencidas es del ${kpis.taskMetrics.overdueRate.toFixed(0)}%`,
        metric: 'overdue_rate',
      });
    }

    // Goals at risk
    if (kpis.goalMetrics.goalsAtRisk > 0) {
      insights.push({
        type: 'warning',
        icon: 'Target',
        message: `${kpis.goalMetrics.goalsAtRisk} objetivo${kpis.goalMetrics.goalsAtRisk > 1 ? 's' : ''} sin progreso en 7+ días`,
        metric: 'goals_at_risk',
      });
    }

    // Good throughput
    if (kpis.flowMetrics.throughput > 10) {
      insights.push({
        type: 'success',
        icon: 'TrendingUp',
        message: `Excelente productividad: ${kpis.flowMetrics.throughput} tareas completadas`,
        metric: 'throughput',
      });
    }

    // Cycle time info
    if (kpis.flowMetrics.avgCycleTime !== null) {
      const cycleTimeStatus = kpis.flowMetrics.avgCycleTime <= 3 ? 'success' : 
                             kpis.flowMetrics.avgCycleTime <= 7 ? 'info' : 'warning';
      insights.push({
        type: cycleTimeStatus,
        icon: 'Timer',
        message: `Tiempo medio de ciclo: ${kpis.flowMetrics.avgCycleTime.toFixed(1)} días`,
        metric: 'cycle_time',
      });
    }

    // Compare with previous period if available
    if (previousKpis) {
      const completedDiff = kpis.taskMetrics.tasksCompleted - previousKpis.taskMetrics.tasksCompleted;
      if (completedDiff > 0) {
        insights.push({
          type: 'success',
          icon: 'ArrowUp',
          message: `+${completedDiff} tareas completadas vs periodo anterior`,
          metric: 'completed_trend',
          trend: 'up',
        });
      } else if (completedDiff < 0) {
        insights.push({
          type: 'info',
          icon: 'ArrowDown',
          message: `${completedDiff} tareas completadas vs periodo anterior`,
          metric: 'completed_trend',
          trend: 'down',
        });
      }
    }

    return insights.slice(0, 5); // Max 5 insights
  }, [kpis, previousKpis]);
}
