import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ReportFilters } from '@/types/reports';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

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

export interface TransferBrokerStats {
  brokerId: string | null;
  brokerName: string;
  totalRequests: number;
  revenue: number;
  cost: number;
  margin: number;
  byStatus: Record<string, number>;
}

export interface PricingModeStats {
  mode: string;
  label: string;
  count: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
}

export interface TransferReportData {
  kpis: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    marginPercent: number;
  };
  byStatus: { status: string; count: number }[];
  byPricingMode: PricingModeStats[];
  dailyTrend: { date: string; count: number }[];
  brokerStats: TransferBrokerStats[];
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_gestion: 'En gestión',
  presupuesto_enviado: 'Ppto. enviado',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
  facturado: 'Facturado',
  borrador: 'Borrador',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  en_curso: 'En curso',
};

const PRICING_MODE_LABELS: Record<string, string> = {
  zone_tariff: 'Tarifa por zona',
  provider_quote: 'Presupuesto proveedor',
};

export function useTransferReports(filters: ReportFilters) {
  const { organization } = useAuth();

  const query = useQuery({
    queryKey: ['transfer-reports', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { start, end } = getDateRange(filters);

      const { data, error } = await supabase
        .from('transfer_requests')
        .select('id, status, broker_id, broker_name, client_total, provider_cost, internal_margin, pricing_mode, created_at')
        .eq('organization_id', organization.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  const report = useMemo<TransferReportData | null>(() => {
    if (!query.data) return null;
    const requests = query.data;

    let total = requests.length;
    let completed = 0, pending = 0, cancelled = 0;
    let totalRevenue = 0, totalCost = 0, totalMargin = 0;

    const statusMap = new Map<string, number>();
    const dailyMap = new Map<string, number>();
    const brokerMap = new Map<string, TransferBrokerStats>();
    const pricingModeMap = new Map<string, { count: number; revenue: number; cost: number; margin: number }>();

    for (const r of requests) {
      // Status counts
      if (r.status === 'completado' || r.status === 'facturado') completed++;
      else if (r.status === 'cancelado' || r.status === 'rechazado') cancelled++;
      else pending++;

      // Financials
      totalRevenue += r.client_total || 0;
      totalCost += r.provider_cost || 0;
      totalMargin += r.internal_margin || 0;

      // Status distribution
      statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);

      // Daily trend
      const day = format(new Date(r.created_at), 'yyyy-MM-dd');
      dailyMap.set(day, (dailyMap.get(day) || 0) + 1);

      // Pricing mode distribution
      const mode = r.pricing_mode || 'zone_tariff';
      if (!pricingModeMap.has(mode)) {
        pricingModeMap.set(mode, { count: 0, revenue: 0, cost: 0, margin: 0 });
      }
      const pm = pricingModeMap.get(mode)!;
      pm.count++;
      pm.revenue += r.client_total || 0;
      pm.cost += r.provider_cost || 0;
      pm.margin += r.internal_margin || 0;

      // Broker stats
      const bKey = r.broker_name || 'Sin broker';
      if (!brokerMap.has(bKey)) {
        brokerMap.set(bKey, {
          brokerId: r.broker_id,
          brokerName: bKey,
          totalRequests: 0,
          revenue: 0,
          cost: 0,
          margin: 0,
          byStatus: {},
        });
      }
      const b = brokerMap.get(bKey)!;
      b.totalRequests++;
      b.revenue += r.client_total || 0;
      b.cost += r.provider_cost || 0;
      b.margin += r.internal_margin || 0;
      b.byStatus[r.status] = (b.byStatus[r.status] || 0) + 1;
    }

    const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status: STATUS_LABELS[status] || status,
      count,
    }));

    const byPricingMode: PricingModeStats[] = Array.from(pricingModeMap.entries()).map(([mode, stats]) => ({
      mode,
      label: PRICING_MODE_LABELS[mode] || mode,
      count: stats.count,
      revenue: stats.revenue,
      cost: stats.cost,
      margin: stats.margin,
      marginPercent: stats.revenue > 0 ? (stats.margin / stats.revenue) * 100 : 0,
    }));

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const brokerStats = Array.from(brokerMap.values()).sort((a, b) => b.totalRequests - a.totalRequests);

    const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    return {
      kpis: { total, completed, pending, cancelled, totalRevenue, totalCost, totalMargin, marginPercent },
      byStatus,
      byPricingMode,
      dailyTrend,
      brokerStats,
    };
  }, [query.data]);

  return { data: report, isLoading: query.isLoading };
}
