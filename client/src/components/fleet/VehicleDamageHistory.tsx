import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFleetDamages } from '@/hooks/useFleetDamages';
import { VehicleCroquis } from './VehicleCroquis';
import { DamageDetailSheet } from './DamageDetailSheet';
import { AddDamageDialog } from './AddDamageDialog';
import { FLEET_DAMAGE_STATUS_OPTIONS } from '@/types/fleet';
import type { FleetVehicleDamage } from '@/types/fleet';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface VehicleDamageHistoryProps {
  fleetVehicleId: string;
  organizationId: string;
  vehiclePlate?: string;
}

export function VehicleDamageHistory({ fleetVehicleId, organizationId, vehiclePlate }: VehicleDamageHistoryProps) {
  const { damages, isLoading, createDamage, deleteDamage, pendingCount } = useFleetDamages(fleetVehicleId);
  const [selectedDamage, setSelectedDamage] = useState<FleetVehicleDamage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const handleDamageClick = (damage: FleetVehicleDamage) => {
    setSelectedDamage(damage);
    setDetailOpen(true);
  };

  const handleAddDamage = async (damage: any) => {
    await createDamage.mutateAsync(damage);
  };

  const handleDelete = (id: string) => {
    deleteDamage.mutate(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Historial de Daños
        </h3>
        {pendingCount > 0 && (
          <Badge variant="outline" className="text-xs rounded-full border-0 bg-destructive/10 text-destructive">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Add damage button */}
      <Button
        onClick={() => setAddOpen(true)}
        variant="outline"
        className="w-full rounded-2xl h-12 text-base border-dashed"
      >
        <Plus className="h-5 w-5 mr-2" />
        Registrar Daño
      </Button>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : damages.length === 0 ? (
        <div className="text-center py-10 rounded-2xl bg-card border border-border/50">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sin daños registrados</p>
          <p className="text-xs text-muted-foreground/70 mt-1">El vehículo no tiene daños activos</p>
        </div>
      ) : (
        <>
          {/* Croquis */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4">
            <VehicleCroquis
              damages={damages}
              onDamageClick={handleDamageClick}
            />
          </div>

          {/* Damage list */}
          <div className="rounded-2xl bg-card border border-border/50 shadow-sm overflow-hidden">
            {damages.map((d, idx) => {
              const statusOpt = FLEET_DAMAGE_STATUS_OPTIONS.find(o => o.value === d.status);
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors ${
                    idx < damages.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                  onClick={() => handleDamageClick(d)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-muted/60">
                    {d.photo_url ? (
                      <img src={d.photo_url} alt="Daño" className="w-full h-full object-cover" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground capitalize">{d.zona.replace('_', ' ')}</span>
                      {d.pieza && <span className="text-xs text-muted-foreground">· {d.pieza}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(d.created_at), 'dd MMM yyyy', { locale: es })}
                      {' · '}
                      {d.origin_type === 'reserva' ? 'Reserva' : 'Empleado'}
                      {d.has_premium_coverage && ' · Premium ✓'}
                    </span>
                  </div>
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
                </div>
              );
            })}
          </div>
        </>
      )}

      <DamageDetailSheet
        damage={selectedDamage}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDelete={handleDelete}
      />

      <AddDamageDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        fleetVehicleId={fleetVehicleId}
        organizationId={organizationId}
        vehiclePlate={vehiclePlate}
        onSubmit={handleAddDamage}
      />
    </motion.div>
  );
}
