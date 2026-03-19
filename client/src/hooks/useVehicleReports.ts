import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ReportFilters, VehicleCleaningUserStats, VehicleCleaningReport } from '@/types/reports';
import { CLEANING_TASKS } from '@/types/vehicles';
import { startOfDay, endOfDay, subDays, format, differenceInMinutes } from 'date-fns';

interface CleaningTimeData {
  vehicleId: string;
  startTime: Date | null;
  endTime: Date | null;
  durationMinutes: number | null;
  completedBy: string | null;
}

function calculateCleaningTimes(tasks: any[]): CleaningTimeData[] {
  // Group tasks by vehicle
  const vehicleTasksMap = new Map<string, any[]>();
  tasks.forEach((task: any) => {
    const vehicleId = task.vehicle_id;
    if (!vehicleTasksMap.has(vehicleId)) {
      vehicleTasksMap.set(vehicleId, []);
    }
    vehicleTasksMap.get(vehicleId)!.push(task);
  });

  const results: CleaningTimeData[] = [];

  vehicleTasksMap.forEach((vehicleTasks, vehicleId) => {
    // Find inicio_prep task
    const inicioPrepTask = vehicleTasks.find((t: any) => t.task_key === 'inicio_prep' && t.completed_at);
    
    if (!inicioPrepTask) {
      // No inicio_prep completed, can't calculate time
      return;
    }

    // Find the last completed task (excluding inicio_prep)
    const otherTasks = vehicleTasks.filter((t: any) => t.task_key !== 'inicio_prep' && t.completed_at);
    
    if (otherTasks.length === 0) {
      return;
    }

    // Get the latest completed_at from other tasks
    const sortedOtherTasks = otherTasks.sort(
      (a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );
    const lastTask = sortedOtherTasks[0];

    const startTime = new Date(inicioPrepTask.completed_at);
    const endTime = new Date(lastTask.completed_at);
    const durationMinutes = differenceInMinutes(endTime, startTime);

    // Only include if duration is positive and reasonable (less than 24 hours)
    if (durationMinutes > 0 && durationMinutes < 1440) {
      results.push({
        vehicleId,
        startTime,
        endTime,
        durationMinutes,
        // Use the person who completed inicio_prep as the primary cleaner
        completedBy: inicioPrepTask.completed_by,
      });
    }
  });

  return results;
}

function calculateTimeDistribution(times: CleaningTimeData[]): { range: string; count: number }[] {
  const ranges = [
    { range: '0-15 min', min: 0, max: 15 },
    { range: '15-30 min', min: 15, max: 30 },
    { range: '30-45 min', min: 30, max: 45 },
    { range: '45-60 min', min: 45, max: 60 },
    { range: '60+ min', min: 60, max: Infinity },
  ];

  return ranges.map(({ range, min, max }) => ({
    range,
    count: times.filter((t) => t.durationMinutes !== null && t.durationMinutes >= min && t.durationMinutes < max).length,
  }));
}

export function useVehicleCleaningReports(filters: ReportFilters, locationId?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['vehicle-cleaning-reports', profile?.organization_id, filters, locationId],
    queryFn: async (): Promise<VehicleCleaningReport> => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Calculate date range
      const end = filters.endDate ? endOfDay(filters.endDate) : endOfDay(new Date());
      const days = filters.dateRange === '7d' ? 7 : filters.dateRange === '30d' ? 30 : 90;
      const start = filters.startDate ? startOfDay(filters.startDate) : startOfDay(subDays(end, days));

      // Fetch completed cleaning tasks with vehicles info
      const { data: tasks, error: tasksError } = await supabase
        .from('vehicle_cleaning_tasks')
        .select(`
          id,
          vehicle_id,
          task_key,
          completed,
          completed_at,
          completed_by,
          vehicles!inner(id, organization_id, location_id)
        `)
        .eq('completed', true)
        .gte('completed_at', start.toISOString())
        .lte('completed_at', end.toISOString());

      if (tasksError) throw tasksError;

      // Filter by organization (vehicles table has org_id)
      let filteredTasks = (tasks || []).filter(
        (t: any) => t.vehicles?.organization_id === profile.organization_id
      );

      // Apply location filter if specified
      if (locationId && locationId !== 'all') {
        filteredTasks = filteredTasks.filter((t: any) =>
          locationId === 'none'
            ? !t.vehicles?.location_id
            : t.vehicles?.location_id === locationId
        );
      }

      // Fetch team members
      const { data: members } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('organization_id', profile.organization_id);

      // Calculate cleaning times
      const cleaningTimes = calculateCleaningTimes(filteredTasks);
      const timeDistribution = calculateTimeDistribution(cleaningTimes);

      // Calculate time metrics
      const validTimes = cleaningTimes.filter((t) => t.durationMinutes !== null);
      const avgCleaningTimeMinutes = validTimes.length > 0
        ? validTimes.reduce((sum, t) => sum + (t.durationMinutes || 0), 0) / validTimes.length
        : null;
      const minCleaningTimeMinutes = validTimes.length > 0
        ? Math.min(...validTimes.map((t) => t.durationMinutes || 0))
        : null;
      const maxCleaningTimeMinutes = validTimes.length > 0
        ? Math.max(...validTimes.map((t) => t.durationMinutes || 0))
        : null;

      // Calculate user stats with time tracking
      const userStatsMap = new Map<string, VehicleCleaningUserStats>();
      const vehiclesByUser = new Map<string, Set<string>>();
      const timeByUser = new Map<string, { total: number; count: number }>();

      // Track time by user (based on who completed inicio_prep)
      cleaningTimes.forEach((ct) => {
        if (ct.completedBy && ct.durationMinutes !== null) {
          if (!timeByUser.has(ct.completedBy)) {
            timeByUser.set(ct.completedBy, { total: 0, count: 0 });
          }
          const userData = timeByUser.get(ct.completedBy)!;
          userData.total += ct.durationMinutes;
          userData.count += 1;
        }
      });

      filteredTasks.forEach((task: any) => {
        if (!task.completed_by) return;

        if (!userStatsMap.has(task.completed_by)) {
          const member = members?.find((m) => m.id === task.completed_by);
          const userTimeData = timeByUser.get(task.completed_by);
          
          userStatsMap.set(task.completed_by, {
            userId: task.completed_by,
            userName: member?.name || null,
            vehiclesCleaned: 0,
            vehiclesFullyCleaned: 0,
            tasksByType: {},
            totalTasks: 0,
            avgCleaningTimeMinutes: userTimeData && userTimeData.count > 0 
              ? userTimeData.total / userTimeData.count 
              : null,
            totalCleaningTimeMinutes: userTimeData?.total || 0,
            vehiclesWithTimeData: userTimeData?.count || 0,
          });
          vehiclesByUser.set(task.completed_by, new Set());
        }

        const stats = userStatsMap.get(task.completed_by)!;
        stats.totalTasks++;
        stats.tasksByType[task.task_key] = (stats.tasksByType[task.task_key] || 0) + 1;
        vehiclesByUser.get(task.completed_by)!.add(task.vehicle_id);
      });

      // Set vehicle counts
      vehiclesByUser.forEach((vehicles, userId) => {
        const stats = userStatsMap.get(userId);
        if (stats) stats.vehiclesCleaned = vehicles.size;
      });

      // Calculate aggregate metrics
      const tasksByType = CLEANING_TASKS.map((td) => ({
        taskKey: td.key,
        taskLabel: td.label,
        count: filteredTasks.filter((t: any) => t.task_key === td.key).length,
      }));

      // Calculate cleaning trend by day
      const trendMap = new Map<string, number>();
      filteredTasks.forEach((task: any) => {
        if (task.completed_at) {
          const date = format(new Date(task.completed_at), 'yyyy-MM-dd');
          trendMap.set(date, (trendMap.get(date) || 0) + 1);
        }
      });

      const cleaningTrend = Array.from(trendMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const uniqueVehicles = new Set(filteredTasks.map((t: any) => t.vehicle_id));

      return {
        metrics: {
          totalVehiclesCleaned: uniqueVehicles.size,
          totalTasksCompleted: filteredTasks.length,
          avgTasksPerVehicle:
            uniqueVehicles.size > 0 ? filteredTasks.length / uniqueVehicles.size : 0,
          avgTasksPerUser:
            userStatsMap.size > 0 ? filteredTasks.length / userStatsMap.size : 0,
          tasksByType,
          cleaningTrend,
          avgCleaningTimeMinutes,
          minCleaningTimeMinutes,
          maxCleaningTimeMinutes,
          cleaningTimeDistribution: timeDistribution,
        },
        userStats: Array.from(userStatsMap.values()).sort(
          (a, b) => b.totalTasks - a.totalTasks
        ),
      };
    },
    enabled: !!profile?.organization_id,
  });
}