import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { ReportFilters } from '@/types/reports';
import { subDays, startOfDay, endOfDay, format, differenceInDays } from 'date-fns';

function getDateRange(filters: ReportFilters) {
  const end = filters.endDate ? endOfDay(filters.endDate) : endOfDay(new Date());
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
  return { start, end };
}

export interface WorkshopStats {
  workshopId: string | null;
  workshopName: string;
  totalRepairs: number;
  totalCost: number;
  avgDays: number | null;
}

export interface GaratechReportData {
  kpis: {
    totalRepairs: number;
    activeRepairs: number;
    completedRepairs: number;
    totalCostEstimate: number;
    totalCostFinal: number;
    avgDaysInWorkshop: number | null;
    totalAccidents: number;
  };
  byStatus: { status: string; count: number }[];
  monthlyCosts: { month: string; estimated: number; final: number }[];
  workshopStats: WorkshopStats[];
}

const REPAIR_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  presupuestado: 'Presupuestado',
  aprobado: 'Aprobado',
  en_taller: 'En taller',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export function useGaratechReports(filters: ReportFilters) {
  const { organization } = useAuth();

  const repairsQuery = useQuery({
    queryKey: ['garatech-repairs-reports', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { start, end } = getDateRange(filters);

      const { data, error } = await supabaseQuery
        .from('repairs')
        .select('id, status, cost_estimate, cost_final, started_at, completed_at, created_at, workshop_id, workshops(name)')
        .eq('organization_id', organization.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const accidentsQuery = useQuery({
    queryKey: ['garatech-accidents-reports', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { start, end } = getDateRange(filters);

      const { data, error } = await supabaseQuery
        .from('accidents')
        .select('id')
        .eq('organization_id', organization.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const report = useMemo<GaratechReportData | null>(() => {
    if (!repairsQuery.data) return null;
    const repairs = repairsQuery.data;
    const accidents = accidentsQuery.data || [];

    let activeRepairs = 0, completedRepairs = 0;
    let totalCostEstimate = 0, totalCostFinal = 0;
    let totalDays = 0, daysCount = 0;

    const statusMap = new Map<string, number>();
    const monthlyMap = new Map<string, { estimated: number; final: number }>();
    const workshopMap = new Map<string, WorkshopStats>();

    for (const r of repairs) {
      // Status
      const status = r.status || 'pendiente';
      const isCompleted = status === 'completado';
      const isActive = !isCompleted && status !== 'cancelado';
      if (isCompleted) completedRepairs++;
      if (isActive) activeRepairs++;

      statusMap.set(status, (statusMap.get(status) || 0) + 1);

      // Costs
      totalCostEstimate += r.cost_estimate || 0;
      totalCostFinal += r.cost_final || 0;

      // Days in workshop
      if (r.started_at) {
        const endDate = r.completed_at ? new Date(r.completed_at) : new Date();
        const days = differenceInDays(endDate, new Date(r.started_at));
        if (days >= 0) {
          totalDays += days;
          daysCount++;
        }
      }

      // Monthly costs
      const month = format(new Date(r.created_at || new Date()), 'yyyy-MM');
      if (!monthlyMap.has(month)) monthlyMap.set(month, { estimated: 0, final: 0 });
      const m = monthlyMap.get(month)!;
      m.estimated += r.cost_estimate || 0;
      m.final += r.cost_final || 0;

      // Workshop stats
      const workshopData = r.workshops as any;
      const wName = workshopData?.name || 'Sin taller';
      const wId = r.workshop_id;
      if (!workshopMap.has(wName)) {
        workshopMap.set(wName, { workshopId: wId, workshopName: wName, totalRepairs: 0, totalCost: 0, avgDays: null });
      }
      const w = workshopMap.get(wName)!;
      w.totalRepairs++;
      w.totalCost += r.cost_final || r.cost_estimate || 0;
    }

    // Calculate workshop avg days
    for (const r of repairs) {
      if (r.started_at) {
        const workshopData = r.workshops as any;
        const wName = workshopData?.name || 'Sin taller';
        const w = workshopMap.get(wName);
        if (w) {
          const endDate = r.completed_at ? new Date(r.completed_at) : new Date();
          const days = differenceInDays(endDate, new Date(r.started_at));
          if (days >= 0) {
            if (w.avgDays === null) w.avgDays = days;
            else w.avgDays = (w.avgDays + days) / 2; // running average approximation
          }
        }
      }
    }

    const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status: REPAIR_STATUS_LABELS[status] || status,
      count,
    }));

    const monthlyCosts = Array.from(monthlyMap.entries())
      .map(([month, costs]) => ({ month, ...costs }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const workshopStats = Array.from(workshopMap.values()).sort((a, b) => b.totalRepairs - a.totalRepairs);

    return {
      kpis: {
        totalRepairs: repairs.length,
        activeRepairs,
        completedRepairs,
        totalCostEstimate,
        totalCostFinal,
        avgDaysInWorkshop: daysCount > 0 ? totalDays / daysCount : null,
        totalAccidents: accidents.length,
      },
      byStatus,
      monthlyCosts,
      workshopStats,
    };
  }, [repairsQuery.data, accidentsQuery.data]);

  return { data: report, isLoading: repairsQuery.isLoading || accidentsQuery.isLoading };
}
