import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, CheckCircle, Banknote, CheckCheck } from 'lucide-react';
import { useDamageReports } from '@/hooks/useDamageReports';
import { DamageReportItemDialog } from './DamageReportItemDialog';
import { CollectPaymentDialog } from './CollectPaymentDialog';
import { DAMAGE_REPORT_STATUS_COLORS, DAMAGE_REPORT_STATUS_LABELS, VEHICLE_LOCATIONS, type DamageReport, type DamageReportStatus } from '@/types/garatech';
import { toast } from 'sonner';

interface DamageReportDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DamageReport | null;
}

export function DamageReportDetail({ open, onOpenChange, report }: DamageReportDetailProps) {
  const { removeReportItem, finalizeReport } = useDamageReports();
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false);

  if (!report) return null;

  const getStatusBadgeStyle = (status: string | null) => {
    const key = (status || 'borrador') as DamageReportStatus;
    const colors = DAMAGE_REPORT_STATUS_COLORS[key] || DAMAGE_REPORT_STATUS_COLORS.borrador;
    return { backgroundColor: colors.bg, color: colors.text };
  };

  const getLocationLabel = (loc: string | null | undefined) => {
    return VEHICLE_LOCATIONS.find(l => l.value === loc)?.label || loc || '--';
  };

  const handleRemoveItem = async (itemId: string) => {
    if (confirm('¿Eliminar este item del informe?')) {
      try {
        await removeReportItem.mutateAsync(itemId);
      } catch (error) {
        toast.error('Error al eliminar');
      }
    }
  };

  const handleFinalize = async () => {
    if (confirm('¿Finalizar este informe? No podrá modificarse después.')) {
      try {
        await finalizeReport.mutateAsync(report.id);
      } catch (error) {
        toast.error('Error al finalizar');
      }
    }
  };

  const isEditable = report.status !== 'finalizado';
  const isFinalized = report.status === 'finalizado';
  const isCollected = !!report.amount_collected;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="font-mono">{report.report_number}</SheetTitle>
              <div className="flex items-center gap-2">
                {isCollected && (
                  <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                    <CheckCheck className="h-3 w-3 mr-1" />
                    Cobrado
                  </Badge>
                )}
                <Badge style={getStatusBadgeStyle(report.status)} className="border-0">
                  {DAMAGE_REPORT_STATUS_LABELS[report.status || 'borrador']}
                </Badge>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Vehicle & Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vehículo</p>
                <p className="font-medium">
                  {report.vehicle?.matricula || '--'}
                </p>
                {report.vehicle?.modelo && (
                  <p className="text-sm text-muted-foreground">{report.vehicle.modelo}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha del daño</p>
                <p className="font-medium">
                  {format(new Date(report.damage_date), 'dd/MM/yyyy', { locale: es })}
                </p>
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

            {report.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm">{report.notes}</p>
              </div>
            )}

            <Separator />

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Items del informe</h3>
                {isEditable && (
                  <Button size="sm" onClick={() => setAddItemOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir
                  </Button>
                )}
              </div>

              {report.items && report.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {isEditable && <TableHead className="w-[40px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.catalog_item?.name_es || item.custom_description || '--'}
                          {item.severity_level && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (Nivel {item.severity_level})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getLocationLabel(item.location_on_vehicle)}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{item.unit_price}€</TableCell>
                        <TableCell className="text-right font-mono font-medium">{item.total_price}€</TableCell>
                        {isEditable && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
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
            </div>

            <Separator />

            {/* Total & Collection Info */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-muted-foreground">Total del informe</p>
                  <p className="text-2xl font-bold">
                    {(report.total_amount || 0).toLocaleString('es-ES', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}€
                  </p>
                </div>
                
                {isCollected && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Cobrado</p>
                    <p className="text-2xl font-bold text-green-600">
                      {(report.amount_collected || 0).toLocaleString('es-ES', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}€
                    </p>
                  </div>
                )}
              </div>

              {/* Collection details */}
              {isCollected && (
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCheck className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-600">Cobro registrado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fecha: </span>
                      <span>{report.collected_at ? format(new Date(report.collected_at), 'dd/MM/yyyy', { locale: es }) : '--'}</span>
                    </div>
                    {report.amount_collected !== report.total_amount && (
                      <div>
                        <span className="text-muted-foreground">Diferencia: </span>
                        <span className={report.amount_collected! < report.total_amount! ? 'text-amber-600' : 'text-green-600'}>
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
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              {isEditable && (
                <Button variant="outline" onClick={handleFinalize}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizar Informe
                </Button>
              )}
              
              {isFinalized && !isCollected && (
                <Button onClick={() => setCollectPaymentOpen(true)}>
                  <Banknote className="h-4 w-4 mr-2" />
                  Registrar Cobro
                </Button>
              )}
              
              {isFinalized && isCollected && (
                <Button variant="outline" onClick={() => setCollectPaymentOpen(true)}>
                  <Banknote className="h-4 w-4 mr-2" />
                  Editar Cobro
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DamageReportItemDialog
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        reportId={report.id}
      />

      <CollectPaymentDialog
        open={collectPaymentOpen}
        onOpenChange={setCollectPaymentOpen}
        report={report}
      />
    </>
  );
}
