import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { AreasTable } from '@/components/reports/AreasTable';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { AccessDeniedPage } from '@/components/permissions';
import { useAreaReports } from '@/hooks/useReportMetrics';
import { useSubscription } from '@/hooks/useSubscription';
import { usePermissions } from '@/hooks/usePermissions';
import { ReportFilters } from '@/types/reports';
import { Lock, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportsAreas() {
  const { isProPlan, isTeamPlan } = useSubscription();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '30d' });

  const hasPlanAccess = isProPlan || isTeamPlan;
  const { data: areaReports, isLoading } = useAreaReports(filters);

  if (permissionsLoading) {
    return (
      <AppLayout title="Reportes por Área">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPermission('reports.view')) {
    return (
      <AppLayout title="Reportes por Área">
        <AccessDeniedPage 
          title="Sin acceso a reportes"
          description="No tienes permiso para ver los reportes. Contacta a tu administrador."
        />
      </AppLayout>
    );
  }

  if (!hasPlanAccess) {
    return (
      <AppLayout title="Reportes por Área">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Reportes por área</h2>
          <p className="text-muted-foreground mb-6 max-w-md">Accede a métricas detalladas por área con el plan Pro o Team.</p>
          <Button onClick={() => setShowUpgrade(true)}>Actualizar plan</Button>
          <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reportes por Área">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Reportes por Área</h1>
            <p className="text-sm text-muted-foreground">Rendimiento y métricas por área de trabajo</p>
          </div>
        </div>
        <ReportFiltersBar filters={filters} onFiltersChange={setFilters} />
        <AreasTable areas={areaReports || []} isLoading={isLoading} />
      </div>
    </AppLayout>
  );
}
