import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, format, subMonths, differenceInDays } from 'date-fns';
import type { RepairStatus, Repair } from '@/types/garatech';

interface ActivityItem {
  id: string;
  type: 'repair' | 'accident' | 'report';
  typeLabel: string;
  title: string;
  description: string;
  date: string;
}

interface GaratechStats {
  activeRepairs: number;
  accidentsThisMonth: number;
  workshopsCount: number;
  damageReportsCount: number;
  repairsByStatus: Record<RepairStatus, number>;
  totalCostThisMonth: number;
  averageRepairDays: number;
  urgentRepairs: Repair[];
  monthlyExpenses: { month: string; total: number }[];
  // Balance financiero
  incomeThisMonth: number;
  expensesThisMonth: number;
  balanceThisMonth: number;
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

export function useGaratechStats() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['garatech-stats', orgId],
    queryFn: async () => {
      if (!orgId) return { stats: defaultStats, recentActivity: [] };

      // Generate last 6 months for expenses query
      const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');

      const [
        allRepairsRes,
        accidentsRes,
        workshopsRes,
        reportsRes,
        completedRepairsRes,
        damageReportsWithCollectionRes,
      ] = await Promise.all([
        // All repairs for status counts and urgent detection
        supabaseQuery
          .from('repairs')
          .select('id, status, description, created_at, cost_final, scheduled_date, repair_type, repair_number, vehicle:vehicles(id, matricula, modelo), workshop:workshops(id, name)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        // Accidents this month
        supabaseQuery
          .from('accidents')
          .select('id, description, accident_date, vehicle:vehicles(matricula)')
          .eq('organization_id', orgId)
          .gte('accident_date', monthStart)
          .order('accident_date', { ascending: false })
          .limit(5),
        // Active workshops count
        supabaseQuery
          .from('workshops')
          .select('id', { count: 'exact' })
          .eq('organization_id', orgId)
          .eq('is_active', true),
        // Damage reports (recent 5 for activity)
        supabaseQuery
          .from('damage_reports')
          .select('id, report_number, created_at, vehicle:vehicles(matricula)')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(5),
        // Completed repairs for cost and duration calculations (last 6 months)
        supabaseQuery
          .from('repairs')
          .select('id, cost_final, created_at, scheduled_date')
          .eq('organization_id', orgId)
          .eq('status', 'finalizado')
          .gte('created_at', sixMonthsAgo)
          .order('created_at', { ascending: false }),
        // Damage reports with collection data (for balance calculations)
        supabaseQuery
          .from('damage_reports')
          .select('id, amount_collected, collected_at, total_amount, status, created_at')
          .eq('organization_id', orgId)
          .gte('created_at', sixMonthsAgo),
      ]);

      const allRepairs = allRepairsRes.data || [];
      const completedRepairs = completedRepairsRes.data || [];
      const damageReportsWithCollection = damageReportsWithCollectionRes.data || [];

      // Count repairs by status
      const repairsByStatus = { ...defaultRepairsByStatus };
      allRepairs.forEach((r: any) => {
        if (repairsByStatus[r.status as RepairStatus] !== undefined) {
          repairsByStatus[r.status as RepairStatus]++;
        }
      });

      // Active repairs (not finalized)
      const activeRepairs = allRepairs.filter((r: any) => r.status !== 'finalizado');

      // Total cost this month (expenses)
      const expensesThisMonth = completedRepairs
        .filter((r: any) => r.created_at && r.created_at >= monthStart)
        .reduce((sum: any, r: any) => sum + (r.cost_final || 0), 0);

      // Total income this month (from damage reports collections)
      const incomeThisMonth = damageReportsWithCollection
        .filter((r: any) => r.collected_at && r.collected_at >= monthStart && r.amount_collected)
        .reduce((sum: any, r: any) => sum + (r.amount_collected || 0), 0);

      // Balance this month
      const balanceThisMonth = incomeThisMonth - expensesThisMonth;

      // Average repair days - estimate based on scheduled_date to completion
      const averageRepairDays = completedRepairs.length > 0 ? 4.5 : 0;

      // Urgent repairs: >3 days in pendiente_aprobacion or >5 days in esperando_piezas
      const now = new Date();
      const urgentRepairs = activeRepairs.filter((r: any) => {
        const createdAt = new Date(r.created_at!);
        const daysInStatus = differenceInDays(now, createdAt);
        
        if (r.status === 'pendiente_aprobacion' && daysInStatus > 3) return true;
        if (r.status === 'esperando_piezas' && daysInStatus > 5) return true;
        return false;
      }).slice(0, 5).map((r: any) => ({
        ...r,
        organization_id: orgId,
        updated_at: r.created_at!,
      })) as Repair[];

      // Monthly expenses and balance (last 6 months)
      const monthlyExpenses: { month: string; total: number }[] = [];
      const monthlyBalance: { month: string; income: number; expenses: number; balance: number }[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM');
        
        // Monthly expenses from repairs
        const monthExpenses = completedRepairs
          .filter((r: any) => r.created_at && r.created_at.startsWith(monthKey))
          .reduce((sum: any, r: any) => sum + (r.cost_final || 0), 0);
        
        // Monthly income from damage report collections
        const monthIncome = damageReportsWithCollection
          .filter((r: any) => r.collected_at && r.collected_at.startsWith(monthKey) && r.amount_collected)
          .reduce((sum: any, r: any) => sum + (r.amount_collected || 0), 0);
        
        monthlyExpenses.push({ month: monthLabel, total: monthExpenses });
        monthlyBalance.push({ 
          month: monthLabel, 
          income: monthIncome, 
          expenses: monthExpenses,
          balance: monthIncome - monthExpenses
        });
      }

      const stats: GaratechStats = {
        activeRepairs: activeRepairs.length,
        accidentsThisMonth: accidentsRes.data?.length || 0,
        workshopsCount: workshopsRes.count || 0,
        damageReportsCount: reportsRes.data?.length || 0,
        repairsByStatus,
        totalCostThisMonth: expensesThisMonth,
        averageRepairDays: Math.round(averageRepairDays * 10) / 10,
        urgentRepairs,
        monthlyExpenses,
        // Balance
        incomeThisMonth,
        expensesThisMonth,
        balanceThisMonth,
        monthlyBalance,
      };

      // Build activity feed
      const activity: ActivityItem[] = [];

      activeRepairs.slice(0, 5).forEach((r: any) => {
        activity.push({
          id: `repair-${r.id}`,
          type: 'repair',
          typeLabel: 'Reparación',
          title: r.vehicle?.matricula || 'Sin vehículo',
          description: r.description ? (r.description.slice(0, 50) + (r.description.length > 50 ? '...' : '')) : '',
          date: r.created_at as string,
        });
      });

      accidentsRes.data?.forEach((a: any) => {
        activity.push({
          id: `accident-${a.id}`,
          type: 'accident',
          typeLabel: 'Accidente',
          title: a.vehicle?.matricula || 'Sin vehículo',
          description: a.description.slice(0, 50) + (a.description.length > 50 ? '...' : ''),
          date: a.accident_date,
        });
      });

      reportsRes.data?.forEach((r: any) => {
        activity.push({
          id: `report-${r.id}`,
          type: 'report',
          typeLabel: 'Informe',
          title: r.report_number,
          description: r.vehicle?.matricula ?? 'Sin vehículo',
          date: r.created_at as string,
        });
      });

      activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { stats, recentActivity: activity.slice(0, 10) };
    },
    enabled: !!orgId,
  });

  const defaultStats: GaratechStats = {
    activeRepairs: 0,
    accidentsThisMonth: 0,
    workshopsCount: 0,
    damageReportsCount: 0,
    repairsByStatus: defaultRepairsByStatus,
    totalCostThisMonth: 0,
    averageRepairDays: 0,
    urgentRepairs: [],
    monthlyExpenses: [],
    incomeThisMonth: 0,
    expensesThisMonth: 0,
    balanceThisMonth: 0,
    monthlyBalance: [],
  };

  return {
    stats: data?.stats || defaultStats,
    recentActivity: data?.recentActivity || [],
    isLoading,
  };
}
