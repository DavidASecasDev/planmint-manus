import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReportFiltersBar } from '@/components/reports/ReportFiltersBar';
import { AccessDeniedPage } from '@/components/permissions';
import { useReportMetrics } from '@/hooks/useReportMetrics';
import { useReportExports } from '@/hooks/useReportExports';
import { useSubscription } from '@/hooks/useSubscription';
import { usePermissions } from '@/hooks/usePermissions';
import { ReportFilters } from '@/types/reports';
import { Download, FileText, Lock, Loader2 } from 'lucide-react';

export default function ReportsExports() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: '30d' });
  const { kpis } = useReportMetrics(filters, 'org');
  const { isExporting, exportTasksCSV, exportKPIsCSV, exportReportPDF } = useReportExports();
  const { isProPlan, isTeamPlan } = useSubscription();

  // Gate by subscription plan
  const canExportCSV = isProPlan || isTeamPlan;
  const canExportPDF = isTeamPlan;

  if (permissionsLoading) {
    return (
      <AppLayout title="Exportar reportes">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPermission('reports.view')) {
    return (
      <AppLayout title="Exportar reportes">
        <AccessDeniedPage 
          title="Sin acceso a exportaciones"
          description="No tienes permiso para exportar reportes. Contacta a tu administrador."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Exportar reportes">
      <div className="space-y-6">
        <div className="flex items-center gap-3"><Download className="h-6 w-6" /><h1 className="text-2xl font-bold">Exportar reportes</h1></div>
        <ReportFiltersBar filters={filters} onFiltersChange={setFilters} />
        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardHeader><CardTitle className="text-base">Tareas (CSV)</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground mb-4">Lista de tareas con filtros.</p><Button onClick={() => exportTasksCSV(filters)} disabled={!canExportCSV || isExporting} className="w-full">{!canExportCSV && <Lock className="h-4 w-4 mr-2" />}<FileText className="h-4 w-4 mr-2" />CSV</Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">KPIs (CSV)</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground mb-4">Métricas agregadas.</p><Button onClick={() => exportKPIsCSV(kpis, filters)} disabled={!canExportCSV || isExporting} className="w-full">{!canExportCSV && <Lock className="h-4 w-4 mr-2" />}<FileText className="h-4 w-4 mr-2" />CSV</Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Reporte PDF</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground mb-4">Reporte ejecutivo.</p><Button onClick={() => exportReportPDF(kpis, filters)} disabled={!canExportPDF || isExporting} className="w-full">{!canExportPDF && <Lock className="h-4 w-4 mr-2" />}<FileText className="h-4 w-4 mr-2" />PDF</Button></CardContent></Card>
        </div>
      </div>
    </AppLayout>
  );
}
