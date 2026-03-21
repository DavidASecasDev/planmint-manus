import { useState, useEffect, useMemo } from 'react';
import { VehicleWithTasks, ServiceType } from '@/types/vehicles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { User, Wrench, CheckCircle, Lock, History } from 'lucide-react';
import { VehicleCleaningChecklist } from './VehicleCleaningChecklist';
import { VehicleLocationSelect } from './VehicleLocationSelect';
import { VehicleCleaningHistory } from './VehicleCleaningHistory';
import { VehicleRepairSummary } from './VehicleRepairSummary';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface VehicleDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleWithTasks | null;
}

export function VehicleDetailsSheet({ open, onOpenChange, vehicle }: VehicleDetailsSheetProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canManageVehicles = !permissionsLoading && hasPermission('vehicles.manage');
  const [notes, setNotes] = useState(vehicle?.service_notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Sync notes when vehicle changes
  useEffect(() => {
    setNotes(vehicle?.service_notes || '');
  }, [vehicle?.service_notes]);

  const clientName = useMemo(() => {
    if (!vehicle?.current_reservation) return null;
    return [vehicle.current_reservation.cliente_nombre, vehicle.current_reservation.cliente_apellido]
      .filter(Boolean)
      .join(' ');
  }, [vehicle?.current_reservation]);

  const cleanerName = vehicle?.cleaned_by_profile?.name;

  const handleSaveNotes = async () => {
    if (!vehicle) return;
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ service_notes: notes || null })
        .eq('id', vehicle.id);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['vehicles', profile?.organization_id] });
      toast({ title: 'Notas guardadas' });
    } catch (err) {
      console.error('[VehicleDetailsSheet] Save notes error:', err);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las notas.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleReturnFromService = async () => {
    if (!vehicle) return;
    
    try {
      // 1. Reset cleaning tasks
      await supabase
        .from('vehicle_cleaning_tasks')
        .update({
          completed: false,
          completed_at: null,
          completed_by: null,
        })
        .eq('vehicle_id', vehicle.id);

      // 2. Update vehicle status and clear service data
      const { error } = await supabase
        .from('vehicles')
        .update({ 
          status: 'sucio',
          service_type: null,
          service_notes: null,
          last_status_change: new Date().toISOString(),
        })
        .eq('id', vehicle.id);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['vehicles', profile?.organization_id] });
      toast({
        title: 'Vehículo de vuelta al ciclo',
        description: `${vehicle.matricula} listo para limpieza.`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('[VehicleDetailsSheet] Return from service error:', err);
      toast({
        title: 'Error',
        description: 'No se pudo sacar el vehículo del taller.',
        variant: 'destructive',
      });
    }
  };

  if (!vehicle) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-xl font-bold">{vehicle.matricula}</span>
            <Badge variant="outline">{getStatusLabel(vehicle.status)}</Badge>
          </SheetTitle>
          <SheetDescription>
            {vehicle.modelo || 'Sin modelo'} {vehicle.categoria ? `• ${vehicle.categoria}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 overflow-y-auto max-h-[calc(100vh-8rem)] pb-6">
          {vehicle.status === 'alquilado' ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Vehículo alquilado</p>
              {clientName && <p className="text-sm">Cliente: {clientName}</p>}
              <p className="text-xs mt-2">Las tareas se reiniciarán cuando termine el alquiler</p>
            </div>
          ) : vehicle.status === 'en_servicio' ? (
            <div className="space-y-6">
              {/* Service type indicator */}
              <div className="text-center py-4">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                  vehicle.service_type === 'bloqueo' 
                    ? 'bg-orange-100 dark:bg-orange-950' 
                    : 'bg-purple-100 dark:bg-purple-950'
                }`}>
                  {vehicle.service_type === 'bloqueo' ? (
                    <Lock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Wrench className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
                <p className="font-medium text-lg mt-3">
                  {vehicle.service_type === 'bloqueo' ? 'Bloqueo Disponibilidad' : 'En Reparación'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {vehicle.service_type === 'bloqueo' 
                    ? 'Este vehículo no está disponible temporalmente.' 
                    : 'Este vehículo está en el taller para mantenimiento o reparación.'}
                </p>
              </div>

              {/* Notes section */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas del servicio</label>
                <Textarea
                  placeholder="Añade notas sobre el motivo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
                {notes !== (vehicle.service_notes || '') && (
                  <Button 
                    onClick={handleSaveNotes} 
                    size="sm" 
                    variant="secondary"
                    disabled={isSavingNotes}
                    className="w-full"
                  >
                    {isSavingNotes ? 'Guardando...' : 'Guardar notas'}
                  </Button>
                )}
              </div>

              <Separator />

              {/* Finalize button */}
              <div className="space-y-2">
                <Button 
                  onClick={handleReturnFromService}
                  className="w-full"
                  size="lg"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Finalizar Servicio
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  El vehículo volverá a "Sucio" para iniciar el proceso de limpieza
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <VehicleLocationSelect 
                vehicleId={vehicle.id} 
                currentLocationId={vehicle.location_id} 
              />
              <Separator />
              <VehicleCleaningChecklist vehicle={vehicle} />
              {canManageVehicles && (
                <>
                  <Separator />
                  <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                        <History className="h-4 w-4" />
                        Histórico de limpiezas
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <VehicleCleaningHistory vehicleId={vehicle.id} />
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {/* Garatech: Repair & Accident History */}
              <Separator />
              <VehicleRepairSummary vehicleId={vehicle.id} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'sucio': return 'Sucio';
    case 'incompleto': return 'Incompleto';
    case 'limpio': return 'Limpio';
    case 'en_servicio': return 'En Servicio';
    case 'alquilado': return 'Alquilado';
    default: return status;
  }
}
