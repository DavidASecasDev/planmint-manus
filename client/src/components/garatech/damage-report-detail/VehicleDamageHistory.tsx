import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { History, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { DAMAGE_REPORT_STATUS_COLORS, DAMAGE_REPORT_STATUS_LABELS, type DamageReportStatus } from '@/types/garatech';

interface VehicleDamageHistoryProps {
  vehicleId: string;
  currentReportId: string;
}

export function VehicleDamageHistory({ vehicleId, currentReportId }: VehicleDamageHistoryProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['vehicle-damage-history', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('damage_reports')
        .select('id, report_number, damage_date, status, total_amount, amount_collected, customer_name')
        .eq('vehicle_id', vehicleId)
        .eq('organization_id', profile!.organization_id!)
        .order('damage_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId && !!profile?.organization_id,
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  const otherReports = (reports || []).filter(r => r.id !== currentReportId);

  if (otherReports.length === 0) {
    return null;
  }

  const getStatusBadgeStyle = (status: string | null) => {
    const key = (status || 'borrador') as DamageReportStatus;
    const colors = DAMAGE_REPORT_STATUS_COLORS[key] || DAMAGE_REPORT_STATUS_COLORS.borrador;
    return { backgroundColor: colors.bg, color: colors.text };
  };

  const pendientes = otherReports.filter(r => r.status === 'borrador' || (r.status === 'finalizado' && !r.amount_collected));
  const cobrados = otherReports.filter(r => r.amount_collected && r.amount_collected > 0);
  const totalHistorico = otherReports.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Historial de daños del vehículo</CardTitle>
          <Badge variant="secondary" className="ml-auto">{otherReports.length} informes</Badge>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{pendientes.length} pendientes</span>
          <span>{cobrados.length} cobrados</span>
          <span className="font-medium text-foreground">
            Total histórico: {totalHistorico.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {otherReports.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{r.report_number}</span>
                  <Badge style={getStatusBadgeStyle(r.status)} className="border-0 text-xs">
                    {DAMAGE_REPORT_STATUS_LABELS[(r.status || 'borrador') as DamageReportStatus]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(r.damage_date), 'dd/MM/yyyy', { locale: es })}</span>
                  {r.customer_name && <><span>·</span><span>{r.customer_name}</span></>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium">{(r.total_amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</p>
                {r.amount_collected != null && r.amount_collected > 0 && (
                  <p className="text-xs text-chart-2">Cobrado: {r.amount_collected.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/garatech/reports/${r.id}`)}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
