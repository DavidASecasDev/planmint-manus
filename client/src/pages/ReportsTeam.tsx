import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { TeamTable } from '@/components/reports/TeamTable';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { AccessDeniedPage } from '@/components/permissions';
import { useTeamReports } from '@/hooks/useReportMetrics';
import { useSubscription } from '@/hooks/useSubscription';
import { usePermissions } from '@/hooks/usePermissions';
import { ReportFilters } from '@/types/reports';
import { Lock, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportsTeam() {
  const { isTeamPlan } = useSubscription();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '30d' });

  const { data: userReports, isLoading } = useTeamReports(filters);

  if (permissionsLoading) {
    return (
      <AppLayout title="Reportes de Equipo">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPermission('reports.view')) {
    return (
      <AppLayout title="Reportes de Equipo">
        <AccessDeniedPage 
          title="Sin acceso a reportes"
          description="No tienes permiso para ver los reportes. Contacta a tu administrador."
        />
      </AppLayout>
    );
  }

  if (!isTeamPlan) {
    return (
      <AppLayout title="Reportes de Equipo">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Reportes de equipo</h2>
          <p className="text-muted-foreground mb-6 max-w-md">Accede a métricas de rendimiento por miembro del equipo con el plan Team.</p>
          <Button onClick={() => setShowUpgrade(true)}>Actualizar a Team</Button>
          <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reportes de Equipo">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Reportes de Equipo</h1>
            <p className="text-sm text-muted-foreground">Rendimiento y productividad por miembro</p>
          </div>
        </div>
        <ReportFiltersBar filters={filters} onFiltersChange={setFilters} />
        <TeamTable users={userReports || []} isLoading={isLoading} />
      </div>
    </AppLayout>
  );
}
