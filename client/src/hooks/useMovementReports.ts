import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { ReportFilters } from '@/types/reports';
import { subDays, startOfDay, endOfDay, format, differenceInMinutes } from 'date-fns';

function getDateRange(filters: ReportFilters): { start: Date; end: Date } {
  const end = endOfDay(new Date());
  let start: Date;
  switch (filters.dateRange) {
    case '7d': start = startOfDay(subDays(end, 7)); break;
    case '30d': start = startOfDay(subDays(end, 30)); break;
    case '90d': start = startOfDay(subDays(end, 90)); break;
    case 'custom':
      start = filters.startDate ? startOfDay(filters.startDate) : startOfDay(subDays(end, 30));
      break;
    default: start = startOfDay(subDays(end, 30));
  }
  if (filters.dateRange === 'custom' && filters.endDate) {
    return { start, end: endOfDay(filters.endDate) };
  }
  return { start, end };
}

export interface MovementUserStats {
  userId: string;
  userName: string | null;
  total: number;
  entregas: number;
  recogidas: number;
  escobas: number;
  limpiezas: number;
  completed: number;
  avgDurationMinutes: number | null;
}

export interface MovementReportData {
  kpis: {
    total: number;
    completed: number;
    cancelled: number;
    inProgress: number;
    entregas: number;
    recogidas: number;
    escobas: number;
    limpiezas: number;
    avgPerUser: number;
  };
  userStats: MovementUserStats[];
  dailyTrend: { date: string; count: number }[];
  byType: { type: string; label: string; count: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  entrega: 'Entregas',
  recogida: 'Recogidas',
  escoba: 'Escobas',
  limpieza: 'Limpiezas',
};

export function useMovementReports(filters: ReportFilters) {
  const { organization } = useAuth();

  const query = useQuery({
    queryKey: ['movement-reports', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { start, end } = getDateRange(filters);

      const { data, error } = await supabaseQuery
        .from('vehicle_movements')
        .select('id, movement_type, status, started_at, ended_at, driver_id, profiles!vehicle_movements_driver_id_fkey(name)')
        .eq('organization_id', organization.id)
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const report = useMemo<MovementReportData | null>(() => {
    if (!query.data) return null;
    const movements = query.data;

    // KPIs
    let total = movements.length;
    let completed = 0, cancelled = 0, inProgress = 0;
    let entregas = 0, recogidas = 0, escobas = 0, limpiezas = 0;

    // User map
    const userMap = new Map<string, {
      name: string | null;
      total: number;
      entregas: number;
      recogidas: number;
      escobas: number;
      limpiezas: number;
      completed: number;
      totalDurationMin: number;
      durationCount: number;
    }>();

    // Daily trend map
    const dailyMap = new Map<string, number>();

    for (const m of movements) {
      // Status counts
      if (m.status === 'completado') completed++;
      else if (m.status === 'cancelado') cancelled++;
      else inProgress++;

      // Type counts
      if (m.movement_type === 'entrega') entregas++;
      else if (m.movement_type === 'recogida') recogidas++;
      else if (m.movement_type === 'escoba') escobas++;
      else if (m.movement_type === 'limpieza') limpiezas++;

      // User stats
      const uid = m.driver_id;
      const profileData = m.profiles as any;
      const userName = profileData?.name || null;
      if (!userMap.has(uid)) {
        userMap.set(uid, { name: userName, total: 0, entregas: 0, recogidas: 0, escobas: 0, limpiezas: 0, completed: 0, totalDurationMin: 0, durationCount: 0 });
      }
      const u = userMap.get(uid)!;
      u.total++;
      if (m.movement_type === 'entrega') u.entregas++;
      else if (m.movement_type === 'recogida') u.recogidas++;
      else if (m.movement_type === 'escoba') u.escobas++;
      else if (m.movement_type === 'limpieza') u.limpiezas++;
      if (m.status === 'completado') u.completed++;

      // Duration
      if (m.ended_at && m.started_at) {
        const mins = differenceInMinutes(new Date(m.ended_at), new Date(m.started_at));
        if (mins > 0) {
          u.totalDurationMin += mins;
          u.durationCount++;
        }
      }

      // Daily trend (completed only)
      if (m.status === 'completado' && m.ended_at) {
        const day = format(new Date(m.ended_at), 'yyyy-MM-dd');
        dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      }
    }

    const uniqueUsers = userMap.size;

    const userStats: MovementUserStats[] = Array.from(userMap.entries())
      .map(([userId, s]) => ({
        userId,
        userName: s.name,
        total: s.total,
        entregas: s.entregas,
        recogidas: s.recogidas,
        escobas: s.escobas,
        limpiezas: s.limpiezas,
        completed: s.completed,
        avgDurationMinutes: s.durationCount > 0 ? s.totalDurationMin / s.durationCount : null,
      }))
      .sort((a, b) => b.total - a.total);

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byType = [
      { type: 'entrega', label: 'Entregas', count: entregas },
      { type: 'recogida', label: 'Recogidas', count: recogidas },
      { type: 'escoba', label: 'Escobas', count: escobas },
      { type: 'limpieza', label: 'Limpiezas', count: limpiezas },
    ];

    return {
      kpis: {
        total, completed, cancelled, inProgress,
        entregas, recogidas, escobas, limpiezas,
        avgPerUser: uniqueUsers > 0 ? total / uniqueUsers : 0,
      },
      userStats,
      dailyTrend,
      byType,
    };
  }, [query.data]);

  return { data: report, isLoading: query.isLoading };
}
