import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, MoreHorizontal, Eye, CheckCircle, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDamageReports } from '@/hooks/useDamageReports';
import { DAMAGE_REPORT_STATUS_COLORS, DAMAGE_REPORT_STATUS_LABELS, type DamageReport, type DamageReportStatus } from '@/types/garatech';

export default function GaratechDamageReports() {
  const navigate = useNavigate();
  const { reports, isLoading, deleteReport, finalizeReport, canView, canManage, permissionsLoading } = useDamageReports();
  const [deleteTarget, setDeleteTarget] = useState<DamageReport | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<DamageReport | null>(null);

  const handleView = (report: DamageReport) => {
    navigate(`/garatech/reports/${report.id}`);
  };

  const handleFinalizeRequest = (report: DamageReport) => setFinalizeTarget(report);
  const handleFinalizeConfirm = useCallback(async () => {
    if (!finalizeTarget) return;
    try { await finalizeReport.mutateAsync(finalizeTarget.id); } catch (error) {
      toast.error('Error al finalizar el parte');
      console.error('[DamageReports] Finalize failed:', error);
    }
    setFinalizeTarget(null);
  }, [finalizeTarget, finalizeReport]);

  const handleDeleteRequest = (report: DamageReport) => setDeleteTarget(report);
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try { await deleteReport.mutateAsync(deleteTarget.id); } catch (error) {
      toast.error('Error al eliminar el parte');
      console.error('[DamageReports] Delete failed:', error);
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteReport]);

  const getStatusBadgeStyle = (status: string | null) => {
    const key = (status || 'borrador') as DamageReportStatus;
    const colors = DAMAGE_REPORT_STATUS_COLORS[key] || DAMAGE_REPORT_STATUS_COLORS.borrador;
    return { backgroundColor: colors.bg, color: colors.text };
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '--';
    return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
  };

  if (permissionsLoading) {
    return (
      <AppLayout title="Informes de Daños">
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!canView) {
    return (
      <AppLayout title="Informes de Daños">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver informes de daños</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Informes de Daños">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <PageHeader title="Informes de Daños" description="Crea y gestiona informes de daños de vehículos" icon={FileText} />
          {canManage && (
            <Button onClick={() => navigate('/garatech/reports/new')}>
              <Plus className="h-4 w-4 mr-2" />Nuevo Informe
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">{[1, 2, 3].map(i => (<Skeleton key={i} className="h-12 w-full" />))}</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No hay informes de daños</p>
                <p className="text-sm mt-1">Los informes de daños de vehículos aparecerán aquí</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleView(report)}>
                      <TableCell className="font-medium font-mono">{report.report_number}</TableCell>
                      <TableCell>{format(new Date(report.damage_date), 'dd/MM/yyyy', { locale: es })}</TableCell>
                      <TableCell>
                        {report.vehicle ? (
                          <div>
                            <p className="font-medium">{report.vehicle.matricula}</p>
                            <p className="text-xs text-muted-foreground">{report.vehicle.modelo}</p>
                          </div>
                        ) : <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      <TableCell>{report.customer_name || '--'}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(report.total_amount)}</TableCell>
                      <TableCell>
                        <Badge style={getStatusBadgeStyle(report.status)} className="border-0">
                          {DAMAGE_REPORT_STATUS_LABELS[report.status as DamageReportStatus] || report.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(report)}>
                              <Eye className="h-4 w-4 mr-2" />Ver detalle
                            </DropdownMenuItem>
                            {canManage && (
                              <>
                                {report.status !== 'finalizado' && (
                                  <DropdownMenuItem onClick={() => handleFinalizeRequest(report)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />Finalizar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRequest(report)}>
                                  <Trash2 className="h-4 w-4 mr-2" />Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!finalizeTarget}
        onOpenChange={(open) => !open && setFinalizeTarget(null)}
        title="Finalizar informe"
        description="¿Finalizar este informe? No podrá modificarse después."
        confirmLabel="Finalizar"
        onConfirm={handleFinalizeConfirm}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar informe"
        description={`¿Eliminar el informe ${deleteTarget?.report_number || ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </AppLayout>
  );
}
