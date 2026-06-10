import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Unlink, AlertTriangle, CheckCircle2, Clock, Wrench } from 'lucide-react';
import { useRepairDamages } from '@/hooks/useRepairDamages';
import { FLEET_DAMAGE_STATUS_OPTIONS } from '@/types/fleet';
import type { FleetVehicleDamage } from '@/types/fleet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RepairDamagesTabProps {
  repairId: string;
  vehicleId: string | null | undefined;
  repairStatus: string;
  canManage: boolean;
}

export function RepairDamagesTab({ repairId, vehicleId, repairStatus, canManage }: RepairDamagesTabProps) {
  const { damages, linkedDamages, availableDamages, isLoading, hasFleetVehicle, linkDamage, unlinkDamage } = useRepairDamages(vehicleId, repairId);
  const [confirmLink, setConfirmLink] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

  const isFinalized = repairStatus === 'finalizado';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasFleetVehicle) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Este vehículo no tiene un registro de flota vinculado.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              El historial de daños solo está disponible para vehículos con ficha de flota.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reparado': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'en_reparacion': return <Wrench className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-red-500" />;
    }
  };

  const DamageRow = ({ damage, isLinked }: { damage: FleetVehicleDamage; isLinked: boolean }) => {
    const statusOpt = FLEET_DAMAGE_STATUS_OPTIONS.find(o => o.value === damage.status);
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isLinked ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
        {/* Photo/Icon */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-muted/60">
          {damage.photo_url ? (
            <img src={damage.photo_url} alt="Daño" className="w-full h-full object-cover" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getStatusIcon(damage.status)}
            <span className="text-sm font-medium capitalize">{damage.zona.replace(/_/g, ' ')}</span>
            {damage.pieza && <span className="text-xs text-muted-foreground">· {damage.pieza}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {format(new Date(damage.created_at), 'dd MMM yyyy', { locale: es })}
            </span>
            {damage.descripcion && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">· {damage.descripcion}</span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <Badge
          variant="outline"
          className="text-[10px] px-2 py-0 h-5 rounded-full font-medium border-0 shrink-0"
          style={{
            backgroundColor: `${statusOpt?.color}15`,
            color: statusOpt?.color,
          }}
        >
          {statusOpt?.label}
        </Badge>

        {/* Action button */}
        {canManage && !isFinalized && (
          isLinked ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmUnlink(damage.id)}
            >
              <Unlink className="h-4 w-4" />
            </Button>
          ) : (
            damage.status !== 'reparado' && (!damage.repair_id || damage.repair_id === repairId) && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => setConfirmLink(damage.id)}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            )
          )
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Linked damages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Daños vinculados a esta reparación
            {linkedDamages.length > 0 && (
              <Badge variant="secondary" className="ml-auto">{linkedDamages.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {linkedDamages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay daños vinculados a esta reparación.
              {canManage && !isFinalized && ' Selecciona uno del historial de abajo.'}
            </p>
          ) : (
            <div className="space-y-2">
              {linkedDamages.map(d => (
                <DamageRow key={d.id} damage={d} isLinked />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available damages (full history) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Historial de daños del vehículo
            <Badge variant="outline" className="ml-auto">{damages.length} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {damages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este vehículo no tiene daños registrados.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {damages.filter(d => !linkedDamages.some(ld => ld.id === d.id)).map(d => (
                <DamageRow key={d.id} damage={d} isLinked={false} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm link dialog */}
      <AlertDialog open={!!confirmLink} onOpenChange={() => setConfirmLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vincular daño a esta reparación</AlertDialogTitle>
            <AlertDialogDescription>
              El daño se marcará como "En reparación" y quedará asociado a esta reparación.
              Cuando la reparación se finalice, el daño se marcará automáticamente como "Reparado".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmLink) linkDamage.mutate(confirmLink);
                setConfirmLink(null);
              }}
            >
              Vincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm unlink dialog */}
      <AlertDialog open={!!confirmUnlink} onOpenChange={() => setConfirmUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular daño</AlertDialogTitle>
            <AlertDialogDescription>
              El daño volverá a estado "Pendiente" y se desvinculará de esta reparación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmUnlink) unlinkDamage.mutate(confirmUnlink);
                setConfirmUnlink(null);
              }}
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
