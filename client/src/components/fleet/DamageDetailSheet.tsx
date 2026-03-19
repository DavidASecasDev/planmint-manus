import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Wrench, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { FleetVehicleDamage, FleetDamageStatus } from '@/types/fleet';
import { FLEET_DAMAGE_STATUS_OPTIONS } from '@/types/fleet';
import { usePermissions } from '@/hooks/usePermissions';

interface DamageDetailSheetProps {
  damage: FleetVehicleDamage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
  onCreateReport?: (damage: FleetVehicleDamage) => void;
  onStatusChange?: (id: string, status: FleetDamageStatus) => void;
}

export function DamageDetailSheet({ damage, open, onOpenChange, onDelete, onCreateReport, onStatusChange }: DamageDetailSheetProps) {
  const { isOwner } = usePermissions();
  if (!damage) return null;

  const statusOpt = FLEET_DAMAGE_STATUS_OPTIONS.find(o => o.value === damage.status);
  const canDelete = isOwner || damage.status === 'reparado';
  const canCreateReport = damage.origin_type === 'reserva' && !damage.has_premium_coverage && !damage.damage_report_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Detalle del Daño
            <Badge
              variant="outline"
              className="text-xs border-0 rounded-full"
              style={{
                backgroundColor: `${statusOpt?.color}15`,
                color: statusOpt?.color,
              }}
            >
              {statusOpt?.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Photo */}
          {damage.photo_url && (
            <div className="rounded-xl overflow-hidden border border-border">
              <img src={damage.photo_url} alt="Daño" className="w-full h-48 object-cover" />
            </div>
          )}

          {/* Info rows */}
          <div className="rounded-2xl bg-muted/30 border border-border/50 divide-y divide-border/50">
            <InfoRow label="Zona" value={damage.zona} />
            {damage.pieza && <InfoRow label="Pieza" value={damage.pieza} />}
            <InfoRow label="Severidad" value={damage.severidad} />
            <InfoRow label="Fecha" value={format(new Date(damage.created_at), "dd MMM yyyy · HH:mm", { locale: es })} />
            <InfoRow label="Origen" value={damage.origin_type === 'reserva' ? 'Reserva' : 'Movimiento empleado'} />
            {damage.origin_type === 'reserva' && (
              <InfoRow label="Cobertura Premium" value={damage.has_premium_coverage ? 'Sí' : 'No'} />
            )}
            {damage.descripcion && <InfoRow label="Descripción" value={damage.descripcion} />}
          </div>

          {/* Status change */}
          {onStatusChange && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cambiar estado</label>
              <Select
                value={damage.status}
                onValueChange={(val) => onStatusChange(damage.id, val as FleetDamageStatus)}
              >
                <SelectTrigger className="rounded-2xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLEET_DAMAGE_STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {canCreateReport && (
              <Button
                variant="outline"
                className="w-full rounded-2xl h-11"
                onClick={() => onCreateReport?.(damage)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Crear Informe de Cobro
              </Button>
            )}

            {damage.damage_report_id && (
              <div className="text-xs text-muted-foreground text-center py-2">
                <FileText className="h-3.5 w-3.5 inline mr-1" />
                Informe de cobro vinculado
              </div>
            )}

            {damage.repair_id && (
              <div className="text-xs text-muted-foreground text-center py-2">
                <Wrench className="h-3.5 w-3.5 inline mr-1" />
                Reparación vinculada
              </div>
            )}

            {canDelete && onDelete && (
              <Button
                variant="outline"
                className="w-full rounded-2xl h-11 border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={() => { onDelete(damage.id); onOpenChange(false); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Daño
              </Button>
            )}

            {!canDelete && !isOwner && (
              <p className="text-xs text-muted-foreground text-center">
                Solo se pueden eliminar daños con estado "Reparado"
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground capitalize">{value}</span>
    </div>
  );
}
