import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDamageReports } from '@/hooks/useDamageReports';
import { useDamageReportPdf, type PdfLang } from '@/hooks/useDamageReportPdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Pencil, X, Plus, Trash2, CheckCircle, Banknote, CheckCheck, Car, Download, Image as ImageIcon } from 'lucide-react';
import { DamageReportItemDialog } from '@/components/garatech/DamageReportItemDialog';
import { CollectPaymentDialog } from '@/components/garatech/CollectPaymentDialog';
import { DamageReportEditForm } from '@/components/garatech/damage-report-detail/DamageReportEditForm';
import { VehicleDamageHistory } from '@/components/garatech/damage-report-detail/VehicleDamageHistory';
import { DAMAGE_REPORT_STATUS_COLORS, DAMAGE_REPORT_STATUS_LABELS, VEHICLE_LOCATIONS, type DamageReport, type DamageReportStatus } from '@/types/garatech';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function DamageReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canManage, removeReportItem, finalizeReport } = useDamageReports();
  const { generatePdf, isGenerating } = useDamageReportPdf();
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [pdfLang, setPdfLang] = useState<PdfLang>('es');
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false);
  const [removeItemTarget, setRemoveItemTarget] = useState<string | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const orgId = profile?.organization_id;

  const { data: report, isLoading } = useQuery({
    queryKey: ['damage-report', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('damage_reports')
        .select(`
          *,
          vehicle:vehicles(matricula, modelo),
          reported_by_profile:profiles!damage_reports_reported_by_fkey(name),
          items:damage_report_items(*, catalog_item:damage_catalog(*))
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as DamageReport;
    },
    enabled: !!id && !!orgId,
  });

  if (isLoading) {
    return (
      <AppLayout title="Informe de Daños">
        <div className="space-y-6 p-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout title="Informe no encontrado">
        <div className="container max-w-lg py-16">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FileText className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Informe de daños no disponible</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Este informe de daños fue eliminado o ya no existe. Es posible que haya sido borrado por un administrador.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button onClick={() => navigate('/garatech/damages?tab=informes')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a Informes
              </Button>
              <Button variant="outline" onClick={() => navigate('/notifications')} className="gap-2">
                Ver notificaciones
              </Button>
            </div>
            {id && (
              <p className="text-xs text-muted-foreground/60 font-mono">
                ID: {id}
              </p>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  const getStatusBadgeStyle = (status: string | null) => {
    const key = (status || 'borrador') as DamageReportStatus;
    const colors = DAMAGE_REPORT_STATUS_COLORS[key] || DAMAGE_REPORT_STATUS_COLORS.borrador;
    return { backgroundColor: colors.bg, color: colors.text };
  };

  const getLocationLabel = (loc: string | null | undefined) => {
    return VEHICLE_LOCATIONS.find((l: any) => l.value === loc)?.label || loc || '--';
  };

  const handleRemoveItemRequest = (itemId: string) => setRemoveItemTarget(itemId);
  const handleRemoveItemConfirm = async () => {
    if (!removeItemTarget) return;
    try {
      await removeReportItem.mutateAsync(removeItemTarget);
    } catch (error) {
      toast.error('Error al eliminar');
    }
    setRemoveItemTarget(null);
  };

  const handleFinalizeRequest = () => setShowFinalizeConfirm(true);
  const handleFinalizeConfirm = async () => {
    try {
      await finalizeReport.mutateAsync(report.id);
    } catch (error) {
      toast.error('Error al finalizar');
    }
    setShowFinalizeConfirm(false);
  };

  const isEditable = report.status !== 'finalizado';
  const isFinalized = report.status === 'finalizado';
  const isCollected = !!report.amount_collected;

  return (
    <AppLayout title={report.report_number}>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-3">
          {/* Row 1: Back + Title + Badges */}
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/damages?tab=informes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold font-mono">{report.report_number}</h1>
              </div>
              {report.vehicle && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Car className="h-4 w-4" />
                  <span className="font-medium">{report.vehicle.matricula}</span>
                  <span>·</span>
                  <span>{report.vehicle.modelo}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isCollected && (
                <Badge variant="outline" className="border-chart-2/50 text-chart-2 bg-chart-2/10">
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Cobrado
                </Badge>
              )}
              <Badge style={getStatusBadgeStyle(report.status)} className="border-0">
                {DAMAGE_REPORT_STATUS_LABELS[report.status || 'borrador']}
              </Badge>
            </div>
          </div>
          {/* Row 2: Action buttons */}
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <div className="flex items-center gap-1">
              <Select value={pdfLang} onValueChange={(v) => setPdfLang(v as PdfLang)}>
                <SelectTrigger className="h-9 w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generatePdf(report, pdfLang)}
                disabled={isGenerating}
              >
                <Download className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generando...' : 'Generar PDF'}
              </Button>
            </div>
            {canManage && isEditable && (
              <Button
                variant={isEditing ? "ghost" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <><X className="h-4 w-4 mr-2" />Cancelar</>
                ) : (
                  <><Pencil className="h-4 w-4 mr-2" />Editar</>
                )}
              </Button>
            )}
          </div>
        </div>

        {isEditing ? (
          <DamageReportEditForm
            report={report}
            onSave={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="space-y-6">
            {/* Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vehículo</p>
                    <p className="font-medium">{report.vehicle?.matricula || report.vehicle_plate || '--'}</p>
                    {(report.vehicle?.modelo || report.vehicle_model) && (
                      <p className="text-xs text-muted-foreground">{report.vehicle?.modelo || report.vehicle_model}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha del daño</p>
                    <p className="font-medium">{format(new Date(report.damage_date), 'dd/MM/yyyy', { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{report.customer_name || '--'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Documento</p>
                    <p className="font-medium">{report.customer_document || '--'}</p>
                  </div>
                </div>
                {(report.external_reservation_number || report.contract_start_date) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                    {report.external_reservation_number && (
                      <div>
                        <p className="text-sm text-muted-foreground">Nº Reserva</p>
                        <p className="font-medium">{report.external_reservation_number}</p>
                      </div>
                    )}
                    {report.contract_start_date && (
                      <div>
                        <p className="text-sm text-muted-foreground">Inicio contrato</p>
                        <p className="font-medium">{format(new Date(report.contract_start_date), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                    {report.contract_end_date && (
                      <div>
                        <p className="text-sm text-muted-foreground">Fin contrato</p>
                        <p className="font-medium">{format(new Date(report.contract_end_date), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                  </div>
                )}
                {report.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm">{report.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Items del informe</CardTitle>
                  {isEditable && canManage && (
                    <Button size="sm" onClick={() => setAddItemOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Añadir
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {report.items && report.items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead className="text-center">Fotos</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {isEditable && canManage && <TableHead className="w-[40px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.catalog_item?.name_es || item.custom_description || '--'}
                            {item.severity_level && (
                              <span className="text-xs text-muted-foreground ml-1">(Nivel {item.severity_level})</span>
                            )}
                          </TableCell>
                          <TableCell>{getLocationLabel(item.location_on_vehicle)}</TableCell>
                          <TableCell className="text-center">
                            {item.photo_urls && item.photo_urls.length > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs">{item.photo_urls.length}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{item.unit_price}€</TableCell>
                          <TableCell className="text-right font-mono font-medium">{item.total_price}€</TableCell>
                          {isEditable && canManage && (
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItemRequest(item.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay items en este informe</p>
                  </div>
                )}

                {/* Photo thumbnails section */}
                {report.items && report.items.some(i => i.photo_urls && i.photo_urls.length > 0) && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Fotografías de daños</p>
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {report.items.flatMap((item) =>
                        (item.photo_urls || []).map((url, idx) => (
                          <a
                            key={`${item.id}-${idx}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                          >
                            <img src={url} alt={`Daño ${idx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total & Collection */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-muted-foreground">Total del informe</p>
                    <p className="text-2xl font-bold">
                      {(report.total_amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                  {isCollected && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Cobrado</p>
                      <p className="text-2xl font-bold text-chart-2">
                        {(report.amount_collected || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                      </p>
                    </div>
                  )}
                </div>
                {isCollected && (
                  <div className="mt-4 p-3 bg-chart-2/10 rounded-lg border border-chart-2/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCheck className="h-4 w-4 text-chart-2" />
                      <span className="font-medium text-chart-2">Cobro registrado</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Fecha: </span>
                        <span>{report.collected_at ? format(new Date(report.collected_at), 'dd/MM/yyyy', { locale: es }) : '--'}</span>
                      </div>
                      {report.amount_collected !== report.total_amount && (
                        <div>
                          <span className="text-muted-foreground">Diferencia: </span>
                          <span className={report.amount_collected! < report.total_amount! ? 'text-chart-4' : 'text-chart-2'}>
                            {((report.amount_collected || 0) - (report.total_amount || 0)).toLocaleString('es-ES')}€
                          </span>
                        </div>
                      )}
                    </div>
                    {report.collection_notes && (
                      <p className="text-sm mt-2 text-muted-foreground">{report.collection_notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vehicle Damage History */}
            {report.vehicle_id && (
              <VehicleDamageHistory vehicleId={report.vehicle_id} currentReportId={report.id} />
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {isEditable && canManage && (
                <Button variant="outline" onClick={handleFinalizeRequest}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizar Informe
                </Button>
              )}
              {isFinalized && !isCollected && canManage && (
                <Button onClick={() => setCollectPaymentOpen(true)}>
                  <Banknote className="h-4 w-4 mr-2" />
                  Registrar Cobro
                </Button>
              )}
              {isFinalized && isCollected && canManage && (
                <Button variant="outline" onClick={() => setCollectPaymentOpen(true)}>
                  <Banknote className="h-4 w-4 mr-2" />
                  Editar Cobro
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <DamageReportItemDialog open={addItemOpen} onOpenChange={setAddItemOpen} reportId={report.id} />
      <CollectPaymentDialog open={collectPaymentOpen} onOpenChange={setCollectPaymentOpen} report={report} />

      <ConfirmDialog
        open={!!removeItemTarget}
        onOpenChange={(open) => !open && setRemoveItemTarget(null)}
        title="Eliminar item"
        description="¿Eliminar este item del informe? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleRemoveItemConfirm}
      />

      <ConfirmDialog
        open={showFinalizeConfirm}
        onOpenChange={setShowFinalizeConfirm}
        title="Finalizar informe"
        description="¿Finalizar este informe? No podrá modificarse después."
        confirmLabel="Finalizar"
        onConfirm={handleFinalizeConfirm}
      />
    </AppLayout>
  );
}
