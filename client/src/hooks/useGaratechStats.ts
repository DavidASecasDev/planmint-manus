import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import {
  startOfMonth, startOfQuarter, startOfYear, endOfMonth,
  format, subMonths, differenceInDays, parseISO,
  eachMonthOfInterval, isBefore, isAfter,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { RepairStatus, RepairType, Repair } from '@/types/garatech';

// =====================================================
// Types
// =====================================================

export type PeriodPreset = 'this_month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

interface ActivityItem {
  id: string;
  type: 'repair' | 'accident' | 'report';
  typeLabel: string;
  title: string;
  description: string;
  date: string;
  status?: string;
}

interface WorkshopCost {
  id: string;
  name: string;
  totalCost: number;
  repairCount: number;
}

interface VehicleCost {
  matricula: string;
  vehicleId: string;
  totalCost: number;
  repairCount: number;
}

interface MonthlyData {
  month: string;
  monthFull: string;
  income: number;
  expenses: number;
  balance: number;
  repairCount: number;
}

export interface GaratechStats {
  // KPIs principales
  activeRepairs: number;
  totalRepairs: number;
  accidentsInPeriod: number;
  workshopsCount: number;
  damageReportsCount: number;
  repairsByStatus: Record<RepairStatus, number>;
  totalCostInPeriod: number;
  totalCostPreviousPeriod: number;
  costTrend: number; // percentage change
  averageRepairDays: number;
  averageCostPerRepair: number;
  // Balance financiero
  incomeInPeriod: number;
  expensesInPeriod: number;
  balanceInPeriod: number;
  // Distribución por tipo
  repairsByType: Record<RepairType, number>;
  // Top talleres por coste
  topWorkshops: WorkshopCost[];
  // Top vehículos más costosos
  topVehiclesByCost: VehicleCost[];
  // Urgentes
  urgentRepairs: Repair[];
  // Datos mensuales
  monthlyData: MonthlyData[];
  // Legacy compat
  monthlyExpenses: { month: string; total: number }[];
  monthlyBalance: { month: string; income: number; expenses: number; balance: number }[];
  // Period info
  periodLabel: string;
}

// =====================================================
// Helpers
// =====================================================

export function getDateRangeForPreset(preset: PeriodPreset): DateRange {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { from: startOfMonth(now), to: now };
    case 'quarter':
      return { from: startOfQuarter(now), to: now };
    case 'year':
      return { from: startOfYear(now), to: now };
    case 'custom':
      // Default to last 6 months for custom until user picks
      return { from: subMonths(now, 6), to: now };
  }
}

function getPreviousPeriodRange(range: DateRange): DateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - durationMs),
    to: new Date(range.from.getTime() - 1),
  };
}

const defaultRepairsByStatus: Record<RepairStatus, number> = {
  pendiente_aprobacion: 0,
  listo_entregar_taller: 0,
  en_taller: 0,
  esperando_piezas: 0,
  listo_recoger: 0,
  finalizado: 0,
};

const defaultRepairsByType: Record<RepairType, number> = {
  mantenimiento: 0,
  reparacion: 0,
  revision: 0,
  itv: 0,
  accidente: 0,
};

// =====================================================
// Hook
// =====================================================

export function useGaratechStats(dateRange: DateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const rangeFrom = format(dateRange.from, 'yyyy-MM-dd');
  const rangeTo = format(dateRange.to, 'yyyy-MM-dd');

  const previousRange = getPreviousPeriodRange(dateRange);
  const prevFrom = format(previousRange.from, 'yyyy-MM-dd');
  const prevTo = format(previousRange.to, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['garatech-stats', orgId, rangeFrom, rangeTo],
    queryFn: async () => {
      if (!orgId) return { stats: defaultStats, recentActivity: [] };

      // We fetch all repairs (no date filter) so we can compute active + pipeline
      // But cost/type/workshop stats are filtered by the selected period
      const [
        allRepairsRes,
        accidentsRes,
        workshopsRes,
        reportsRes,
        damageReportsWithCollectionRes,
      ] = await Promise.all([
        supabaseQuery
          .from('repairs')
          .select('id, status, description, created_at, cost_final, cost_estimate, scheduled_date, started_at, completed_at, repair_type, repair_number, km_at_repair, vehicle:vehicles(id, matricula, modelo), workshop:workshops(id, name)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        supabaseQuery
          .from('accidents')
          .select('id, description, accident_date, severity, vehicle:vehicles(matricula)')
          .eq('organization_id', orgId)
          .gte('accident_date', rangeFrom)
          .lte('accident_date', rangeTo)
          .order('accident_date', { ascending: false }),
        supabaseQuery
          .from('workshops')
          .select('id, name', { count: 'exact' })
          .eq('organization_id', orgId)
          .eq('is_active', true),
        supabaseQuery
          .from('damage_reports')
          .select('id, report_number, created_at, status, vehicle:vehicles(matricula)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabaseQuery
          .from('damage_reports')
          .select('id, amount_collected, collected_at, total_amount, status, created_at')
          .eq('organization_id', orgId),
      ]);

      const allRepairs = allRepairsRes.data || [];
      const damageReportsWithCollection = damageReportsWithCollectionRes.data || [];

      // Filter repairs within the selected period
      const repairsInPeriod = allRepairs.filter((r: any) =>
        r.created_at && r.created_at >= rangeFrom && r.created_at <= rangeTo + 'T23:59:59'
      );

      // Filter repairs in previous period (for trend)
      const repairsInPrevPeriod = allRepairs.filter((r: any) =>
        r.created_at && r.created_at >= prevFrom && r.created_at <= prevTo + 'T23:59:59'
      );

      // Count repairs by status (all time - pipeline is current state)
      const repairsByStatus = { ...defaultRepairsByStatus };
      allRepairs.forEach((r: any) => {
        if (repairsByStatus[r.status as RepairStatus] !== undefined) {
          repairsByStatus[r.status as RepairStatus]++;
        }
      });

      // Count repairs by type (within period)
      const repairsByType = { ...defaultRepairsByType };
      repairsInPeriod.forEach((r: any) => {
        if (repairsByType[r.repair_type as RepairType] !== undefined) {
          repairsByType[r.repair_type as RepairType]++;
        }
      });

      // Active repairs (not finalized - always current state)
      const activeRepairs = allRepairs.filter((r: any) => r.status !== 'finalizado');

      // Completed repairs in period
      const completedInPeriod = repairsInPeriod.filter((r: any) => r.status === 'finalizado');
      const completedInPrevPeriod = repairsInPrevPeriod.filter((r: any) => r.status === 'finalizado');

      // Expenses in period
      const expensesInPeriod = repairsInPeriod
        .reduce((sum: number, r: any) => sum + (r.cost_final || 0), 0);

      // Expenses in previous period
      const expensesPrevPeriod = repairsInPrevPeriod
        .reduce((sum: number, r: any) => sum + (r.cost_final || 0), 0);

      // Cost trend
      const costTrend = expensesPrevPeriod > 0
        ? ((expensesInPeriod - expensesPrevPeriod) / expensesPrevPeriod) * 100
        : 0;

      // Income in period
      const incomeInPeriod = damageReportsWithCollection
        .filter((r: any) => r.collected_at && r.collected_at >= rangeFrom && r.collected_at <= rangeTo + 'T23:59:59' && r.amount_collected)
        .reduce((sum: number, r: any) => sum + (r.amount_collected || 0), 0);

      const balanceInPeriod = incomeInPeriod - expensesInPeriod;

      // Average repair days (from completed repairs in period with dates)
      const repairsWithDuration = completedInPeriod.filter((r: any) => r.started_at && r.completed_at);
      const averageRepairDays = repairsWithDuration.length > 0
        ? repairsWithDuration.reduce((sum: number, r: any) => {
            const days = differenceInDays(parseISO(r.completed_at), parseISO(r.started_at));
            return sum + Math.max(days, 1);
          }, 0) / repairsWithDuration.length
        : completedInPeriod.length > 0 ? 1 : 0;

      // Average cost per repair (in period)
      const repairsWithCost = repairsInPeriod.filter((r: any) => r.cost_final && r.cost_final > 0);
      const averageCostPerRepair = repairsWithCost.length > 0
        ? repairsWithCost.reduce((sum: number, r: any) => sum + r.cost_final, 0) / repairsWithCost.length
        : 0;

      // Top workshops by cost (in period)
      const workshopCosts: Record<string, WorkshopCost> = {};
      repairsInPeriod
        .filter((r: any) => r.workshop)
        .forEach((r: any) => {
          const wId = r.workshop.id;
          if (!workshopCosts[wId]) {
            workshopCosts[wId] = { id: wId, name: r.workshop.name, totalCost: 0, repairCount: 0 };
          }
          workshopCosts[wId].totalCost += r.cost_final || 0;
          workshopCosts[wId].repairCount++;
        });
      const topWorkshops = Object.values(workshopCosts)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);

      // Top vehicles by cost (in period)
      const vehicleCosts: Record<string, VehicleCost> = {};
      repairsInPeriod
        .filter((r: any) => r.vehicle)
        .forEach((r: any) => {
          const vId = r.vehicle.id;
          if (!vehicleCosts[vId]) {
            vehicleCosts[vId] = { vehicleId: vId, matricula: r.vehicle.matricula, totalCost: 0, repairCount: 0 };
          }
          vehicleCosts[vId].totalCost += r.cost_final || 0;
          vehicleCosts[vId].repairCount++;
        });
      const topVehiclesByCost = Object.values(vehicleCosts)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 8);

      // Urgent repairs (always current state)
      const now = new Date();
      const urgentRepairs = activeRepairs.filter((r: any) => {
        const createdAt = new Date(r.created_at!);
        const daysInStatus = differenceInDays(now, createdAt);
        if (r.status === 'pendiente_aprobacion' && daysInStatus > 3) return true;
        if (r.status === 'esperando_piezas' && daysInStatus > 5) return true;
        if (r.status === 'en_taller' && daysInStatus > 10) return true;
        return false;
      }).slice(0, 6).map((r: any) => ({
        ...r,
        organization_id: orgId,
        updated_at: r.created_at!,
      })) as Repair[];

      // Monthly data within the period range
      const monthsInRange = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
      const monthlyData: MonthlyData[] = monthsInRange.map((monthDate) => {
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM', { locale: es });
        const monthFull = format(monthDate, 'MMMM yyyy', { locale: es });

        const monthExpenses = repairsInPeriod
          .filter((r: any) => r.created_at && r.created_at.startsWith(monthKey))
          .reduce((sum: number, r: any) => sum + (r.cost_final || 0), 0);

        const monthIncome = damageReportsWithCollection
          .filter((r: any) => r.collected_at && r.collected_at.startsWith(monthKey) && r.amount_collected)
          .reduce((sum: number, r: any) => sum + (r.amount_collected || 0), 0);

        const monthRepairCount = repairsInPeriod
          .filter((r: any) => r.created_at && r.created_at.startsWith(monthKey))
          .length;

        return {
          month: monthLabel,
          monthFull,
          income: monthIncome,
          expenses: monthExpenses,
          balance: monthIncome - monthExpenses,
          repairCount: monthRepairCount,
        };
      });

      // Accidents in period
      const accidentsInPeriod = (accidentsRes.data || []).length;

      const stats: GaratechStats = {
        activeRepairs: activeRepairs.length,
        totalRepairs: repairsInPeriod.length,
        accidentsInPeriod,
        workshopsCount: workshopsRes.count || 0,
        damageReportsCount: reportsRes.data?.length || 0,
        repairsByStatus,
        totalCostInPeriod: expensesInPeriod,
        totalCostPreviousPeriod: expensesPrevPeriod,
        costTrend: Math.round(costTrend),
        averageRepairDays: Math.round(averageRepairDays * 10) / 10,
        averageCostPerRepair: Math.round(averageCostPerRepair),
        urgentRepairs,
        repairsByType,
        topWorkshops,
        topVehiclesByCost,
        incomeInPeriod,
        expensesInPeriod,
        balanceInPeriod,
        monthlyData,
        monthlyExpenses: monthlyData.map(d => ({ month: d.month, total: d.expenses })),
        monthlyBalance: monthlyData.map(d => ({
          month: d.month,
          income: d.income,
          expenses: d.expenses,
          balance: d.balance,
        })),
        periodLabel: '',
      };

      // Build activity feed (always recent, not period-filtered)
      const activity: ActivityItem[] = [];
      activeRepairs.slice(0, 8).forEach((r: any) => {
        activity.push({
          id: `repair-${r.id}`,
          type: 'repair',
          typeLabel: 'Reparación',
          title: r.vehicle?.matricula || 'Sin vehículo',
          description: r.description ? (r.description.slice(0, 60) + (r.description.length > 60 ? '...' : '')) : '',
          date: r.created_at as string,
          status: r.status,
        });
      });

      (accidentsRes.data || []).slice(0, 5).forEach((a: any) => {
        activity.push({
          id: `accident-${a.id}`,
          type: 'accident',
          typeLabel: 'Accidente',
          title: a.vehicle?.matricula || 'Sin vehículo',
          description: a.description?.slice(0, 60) + (a.description?.length > 60 ? '...' : '') || '',
          date: a.accident_date,
        });
      });

      reportsRes.data?.forEach((r: any) => {
        activity.push({
          id: `report-${r.id}`,
          type: 'report',
          typeLabel: 'Informe Daños',
          title: r.report_number,
          description: r.vehicle?.matricula ?? 'Sin vehículo',
          date: r.created_at as string,
        });
      });

      activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { stats, recentActivity: activity.slice(0, 12) };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const defaultStats: GaratechStats = {
    activeRepairs: 0,
    totalRepairs: 0,
    accidentsInPeriod: 0,
    workshopsCount: 0,
    damageReportsCount: 0,
    repairsByStatus: defaultRepairsByStatus,
    totalCostInPeriod: 0,
    totalCostPreviousPeriod: 0,
    costTrend: 0,
    averageRepairDays: 0,
    averageCostPerRepair: 0,
    urgentRepairs: [],
    repairsByType: defaultRepairsByType,
    topWorkshops: [],
    topVehiclesByCost: [],
    incomeInPeriod: 0,
    expensesInPeriod: 0,
    balanceInPeriod: 0,
    monthlyData: [],
    monthlyExpenses: [],
    monthlyBalance: [],
    periodLabel: '',
  };

  return {
    stats: data?.stats || defaultStats,
    recentActivity: data?.recentActivity || [],
    isLoading,
  };
}
