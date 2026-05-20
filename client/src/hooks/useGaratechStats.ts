import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, format, subMonths, differenceInDays, parseISO } from 'date-fns';
import type { RepairStatus, RepairType, Repair } from '@/types/garatech';

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
  accidentsThisMonth: number;
  workshopsCount: number;
  damageReportsCount: number;
  repairsByStatus: Record<RepairStatus, number>;
  totalCostThisMonth: number;
  totalCostLastMonth: number;
  costTrend: number; // percentage change
  averageRepairDays: number;
  averageCostPerRepair: number;
  // Balance financiero
  incomeThisMonth: number;
  expensesThisMonth: number;
  balanceThisMonth: number;
  // Distribución por tipo
  repairsByType: Record<RepairType, number>;
  // Top talleres por coste
  topWorkshops: WorkshopCost[];
  // Top vehículos más costosos
  topVehiclesByCost: VehicleCost[];
  // Urgentes
  urgentRepairs: Repair[];
  // Datos mensuales (12 meses)
  monthlyData: MonthlyData[];
  // Gastos por mes (legacy compat)
  monthlyExpenses: { month: string; total: number }[];
  monthlyBalance: { month: string; income: number; expenses: number; balance: number }[];
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

export function useGaratechStats() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');
  const lastMonthEnd = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['garatech-stats', orgId],
    queryFn: async () => {
      if (!orgId) return { stats: defaultStats, recentActivity: [] };

      const twelveMonthsAgo = format(subMonths(new Date(), 12), 'yyyy-MM-dd');

      const [
        allRepairsRes,
        accidentsRes,
        workshopsRes,
        reportsRes,
        damageReportsWithCollectionRes,
      ] = await Promise.all([
        // All repairs with vehicle and workshop info
        supabaseQuery
          .from('repairs')
          .select('id, status, description, created_at, cost_final, cost_estimate, scheduled_date, started_at, completed_at, repair_type, repair_number, km_at_repair, vehicle:vehicles(id, matricula, modelo), workshop:workshops(id, name)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        // Accidents this month
        supabaseQuery
          .from('accidents')
          .select('id, description, accident_date, severity, vehicle:vehicles(matricula)')
          .eq('organization_id', orgId)
          .gte('accident_date', twelveMonthsAgo)
          .order('accident_date', { ascending: false }),
        // Active workshops
        supabaseQuery
          .from('workshops')
          .select('id, name', { count: 'exact' })
          .eq('organization_id', orgId)
          .eq('is_active', true),
        // Damage reports
        supabaseQuery
          .from('damage_reports')
          .select('id, report_number, created_at, status, vehicle:vehicles(matricula)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(10),
        // Damage reports with collection data (for balance)
        supabaseQuery
          .from('damage_reports')
          .select('id, amount_collected, collected_at, total_amount, status, created_at')
          .eq('organization_id', orgId)
          .gte('created_at', twelveMonthsAgo),
      ]);

      const allRepairs = allRepairsRes.data || [];
      const damageReportsWithCollection = damageReportsWithCollectionRes.data || [];

      // Count repairs by status
      const repairsByStatus = { ...defaultRepairsByStatus };
      allRepairs.forEach((r: any) => {
        if (repairsByStatus[r.status as RepairStatus] !== undefined) {
          repairsByStatus[r.status as RepairStatus]++;
        }
      });

      // Count repairs by type
      const repairsByType = { ...defaultRepairsByType };
      allRepairs.forEach((r: any) => {
        if (repairsByType[r.repair_type as RepairType] !== undefined) {
          repairsByType[r.repair_type as RepairType]++;
        }
      });

      // Active repairs (not finalized)
      const activeRepairs = allRepairs.filter((r: any) => r.status !== 'finalizado');

      // Completed repairs
      const completedRepairs = allRepairs.filter((r: any) => r.status === 'finalizado');

      // This month expenses
      const expensesThisMonth = completedRepairs
        .filter((r: any) => r.created_at && r.created_at >= monthStart)
        .reduce((sum: number, r: any) => sum + (r.cost_final || 0), 0);

      // Last month expenses
      const expensesLastMonth = completedRepairs
        .filter((r: any) => r.created_at && r.created_at >= lastMonthStart && r.created_at < lastMonthEnd)
        .reduce((sum: number, r: any) => sum + (r.cost_final || 0), 0);

      // Cost trend
      const costTrend = expensesLastMonth > 0
        ? ((expensesThisMonth - expensesLastMonth) / expensesLastMonth) * 100
        : 0;

      // Income this month
      const incomeThisMonth = damageReportsWithCollection
        .filter((r: any) => r.collected_at && r.collected_at >= monthStart && r.amount_collected)
        .reduce((sum: number, r: any) => sum + (r.amount_collected || 0), 0);

      const balanceThisMonth = incomeThisMonth - expensesThisMonth;

      // Average repair days (from completed repairs with dates)
      const repairsWithDuration = completedRepairs.filter((r: any) => r.started_at && r.completed_at);
      const averageRepairDays = repairsWithDuration.length > 0
        ? repairsWithDuration.reduce((sum: number, r: any) => {
            const days = differenceInDays(parseISO(r.completed_at), parseISO(r.started_at));
            return sum + Math.max(days, 1);
          }, 0) / repairsWithDuration.length
        : completedRepairs.length > 0 ? 1 : 0;

      // Average cost per repair
      const repairsWithCost = completedRepairs.filter((r: any) => r.cost_final && r.cost_final > 0);
      const averageCostPerRepair = repairsWithCost.length > 0
        ? repairsWithCost.reduce((sum: number, r: any) => sum + r.cost_final, 0) / repairsWithCost.length
        : 0;

      // Top workshops by cost (last 12 months)
      const workshopCosts: Record<string, WorkshopCost> = {};
      completedRepairs
        .filter((r: any) => r.created_at >= twelveMonthsAgo && r.workshop)
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

      // Top vehicles by cost (last 12 months)
      const vehicleCosts: Record<string, VehicleCost> = {};
      completedRepairs
        .filter((r: any) => r.created_at >= twelveMonthsAgo && r.vehicle)
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

      // Urgent repairs
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

      // Monthly data (last 12 months)
      const monthlyData: MonthlyData[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM');
        const monthFull = format(monthDate, 'MMMM yyyy');

        const monthExpenses = completedRepairs
          .filter((r: any) => r.created_at && r.created_at.startsWith(monthKey))
          .reduce((sum: number, r: any) => sum + (r.cost_final || 0), 0);

        const monthIncome = damageReportsWithCollection
          .filter((r: any) => r.collected_at && r.collected_at.startsWith(monthKey) && r.amount_collected)
          .reduce((sum: number, r: any) => sum + (r.amount_collected || 0), 0);

        const monthRepairCount = completedRepairs
          .filter((r: any) => r.created_at && r.created_at.startsWith(monthKey))
          .length;

        monthlyData.push({
          month: monthLabel,
          monthFull,
          income: monthIncome,
          expenses: monthExpenses,
          balance: monthIncome - monthExpenses,
          repairCount: monthRepairCount,
        });
      }

      // Accidents this month only
      const accidentsThisMonth = (accidentsRes.data || []).filter(
        (a: any) => a.accident_date >= monthStart
      ).length;

      const stats: GaratechStats = {
        activeRepairs: activeRepairs.length,
        totalRepairs: allRepairs.length,
        accidentsThisMonth,
        workshopsCount: workshopsRes.count || 0,
        damageReportsCount: reportsRes.data?.length || 0,
        repairsByStatus,
        totalCostThisMonth: expensesThisMonth,
        totalCostLastMonth: expensesLastMonth,
        costTrend: Math.round(costTrend),
        averageRepairDays: Math.round(averageRepairDays * 10) / 10,
        averageCostPerRepair: Math.round(averageCostPerRepair),
        urgentRepairs,
        repairsByType,
        topWorkshops,
        topVehiclesByCost,
        incomeThisMonth,
        expensesThisMonth,
        balanceThisMonth,
        monthlyData,
        // Legacy compat
        monthlyExpenses: monthlyData.slice(-6).map(d => ({ month: d.month, total: d.expenses })),
        monthlyBalance: monthlyData.slice(-6).map(d => ({
          month: d.month,
          income: d.income,
          expenses: d.expenses,
          balance: d.balance,
        })),
      };

      // Build activity feed
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
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const defaultStats: GaratechStats = {
    activeRepairs: 0,
    totalRepairs: 0,
    accidentsThisMonth: 0,
    workshopsCount: 0,
    damageReportsCount: 0,
    repairsByStatus: defaultRepairsByStatus,
    totalCostThisMonth: 0,
    totalCostLastMonth: 0,
    costTrend: 0,
    averageRepairDays: 0,
    averageCostPerRepair: 0,
    urgentRepairs: [],
    repairsByType: defaultRepairsByType,
    topWorkshops: [],
    topVehiclesByCost: [],
    incomeThisMonth: 0,
    expensesThisMonth: 0,
    balanceThisMonth: 0,
    monthlyData: [],
    monthlyExpenses: [],
    monthlyBalance: [],
  };

  return {
    stats: data?.stats || defaultStats,
    recentActivity: data?.recentActivity || [],
    isLoading,
  };
}
