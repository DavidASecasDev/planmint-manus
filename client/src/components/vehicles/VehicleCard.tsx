import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { VehicleWithTasks, CLEANING_TASKS, VehicleStatus, ServiceType } from '@/types/vehicles';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { User, MoreVertical, Archive, Wrench, CheckCircle, MapPin, Car, Lock, ShieldCheck, ShieldX, ClipboardCheck, ArrowRightLeft, Navigation } from 'lucide-react';
import { useVehicles } from '@/hooks/useVehicles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiInvoke } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { MoveToServiceDialog } from './MoveToServiceDialog';
import { VehicleAuditDialog } from './VehicleAuditDialog';
import { useVehicleAuditStatuses } from '@/hooks/useVehicleAudits';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'sucio', label: 'Sucio', color: 'hsl(0, 84%, 60%)' },
  { value: 'incompleto', label: 'En proceso', color: 'hsl(25, 95%, 53%)' },
  { value: 'limpio', label: 'Limpio', color: 'hsl(142, 76%, 36%)' },
  { value: 'alquilado', label: 'Entregado', color: 'hsl(217, 91%, 60%)' },
];

interface VehicleCardProps {
  vehicle: VehicleWithTasks;
  onSelect: (vehicleId: string) => void;
  /** Whether this card can be dragged (admin only) */
  canDrag?: boolean;
  /** Whether this card is being rendered inside DragOverlay */
  isDragOverlay?: boolean;
}

export function VehicleCard({ vehicle, onSelect, canDrag = false, isDragOverlay = false }: VehicleCardProps) {
  const { archiveVehicle, isArchiving } = useVehicles();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [isMovingToService, setIsMovingToService] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const { data: auditStatuses } = useVehicleAuditStatuses();
  const auditInfo = auditStatuses?.get(vehicle.id);
  
  const canChangeStatus = isAdmin && hasPermission('vehicles.change_status');

  // Sortable hook for drag & drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: vehicle.id,
    data: { vehicle },
    disabled: !canDrag || isDragOverlay,
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const completedTasks = (vehicle.cleaning_tasks || []).filter(t => t.completed).length;
  const totalTasks = CLEANING_TASKS.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const clientName = vehicle.current_reservation
    ? [vehicle.current_reservation.cliente_nombre, vehicle.current_reservation.cliente_apellido]
        .filter(Boolean)
        .join(' ')
    : null;

  const cleanerName = vehicle.cleaned_by_profile?.name;

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    archiveVehicle(vehicle.id);
  };

  const handleOpenServiceDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    setServiceDialogOpen(true);
  };

  const handleMoveToService = async (serviceType: ServiceType, notes: string) => {
    setIsMovingToService(true);
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ 
          status: 'en_servicio',
          service_type: serviceType,
          service_notes: notes || null,
          last_status_change: new Date().toISOString(),
        })
        .eq('id', vehicle.id);

      if (error) throw error;
      
      setServiceDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['vehicles', profile?.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-for-preparation'] });
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
      toast({
        title: serviceType === 'reparacion' ? 'Vehículo en reparación' : 'Disponibilidad bloqueada',
        description: `${vehicle.matricula} movido a servicio.`,
      });
    } catch (err) {
      console.error('[VehicleCard] Move to service error:', err);
      toast({
        title: 'Error',
        description: 'No se pudo mover el vehículo.',
        variant: 'destructive',
      });
    } finally {
      setIsMovingToService(false);
    }
  };

  const handleReturnFromService = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      queryClient.invalidateQueries({ queryKey: ['vehicles-for-preparation'] });
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
      toast({
        title: 'Vehículo de vuelta al ciclo',
        description: `${vehicle.matricula} listo para limpieza.`,
      });
    } catch (err) {
      console.error('[VehicleCard] Return from service error:', err);
      toast({
        title: 'Error',
        description: 'No se pudo sacar el vehículo del taller.',
        variant: 'destructive',
      });
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (newStatus === vehicle.status || isChangingStatus) return;
    setIsChangingStatus(true);
    try {
      const { data, error } = await apiInvoke<{ success: boolean; from_status: string; to_status: string }>('change-vehicle-status', {
        body: {
          vehicle_id: vehicle.id,
          new_status: newStatus,
          reason: 'Cambio manual desde Kanban',
        },
      });

      if (error) throw new Error(error.message);

      queryClient.invalidateQueries({ queryKey: ['vehicles', profile?.organization_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-for-preparation'] });
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
      toast({
        title: 'Estado actualizado',
        description: `${vehicle.matricula} cambiado a ${STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus}.`,
      });
    } catch (err: any) {
      console.error('[VehicleCard] Change status error:', err);
      toast({
        title: 'Error',
        description: err?.message || 'No se pudo cambiar el estado.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleCardClick = () => {
    onSelect(vehicle.id);
  };

  const ServiceIcon = vehicle.service_type === 'bloqueo' ? Lock : Wrench;
  const serviceLabel = vehicle.service_type === 'bloqueo' ? 'Bloqueo disponibilidad' : 'En reparación';

  return (
    <>
      <div
        ref={setNodeRef}
        style={sortableStyle}
        className={cn(
          'relative group',
          isDragging && 'opacity-50 z-50',
        )}
      >
        <Card 
          className={cn(
            'cursor-pointer hover:shadow-md transition-shadow border-l-4',
            canDrag && 'cursor-grab active:cursor-grabbing',
            isDragging && 'shadow-lg ring-2 ring-primary/50',
          )}
          style={{ borderLeftColor: getStatusColor(vehicle.status) }}
          onClick={handleCardClick}
          {...(canDrag ? listeners : {})}
          {...(canDrag ? attributes : {})}
        >
          <CardHeader className="p-3 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base tracking-wide">{vehicle.matricula}</h3>
                  {(vehicle.fleet_info?.xexun_imei || vehicle.fleet_info?.traccar_device_id) && (
                    <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {vehicle.modelo || 'Sin modelo'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {/* Location indicator */}
            {vehicle.location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{vehicle.location.name}</span>
              </div>
            )}

            {/* Client info for rented vehicles */}
            {vehicle.status === 'alquilado' && clientName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{clientName}</span>
              </div>
            )}

            {/* Progress for cleaning vehicles only */}
            {vehicle.status !== 'alquilado' && vehicle.status !== 'en_servicio' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Tareas</span>
                  <span className="font-medium">{completedTasks}/{totalTasks}</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
              </div>
            )}

            {/* Parking spot badge for clean vehicles */}
            {vehicle.status === 'limpio' && vehicle.parking_spot && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 rounded-md px-2 py-0.5 -mx-1 w-fit">
                <Car className="h-3 w-3" />
                <span className="font-medium">
                  {vehicle.parking_spot.zone_name.replace('Zona ', 'Z')}-{vehicle.parking_spot.spot_number}
                </span>
              </div>
            )}

            {/* Cleaner info for clean vehicles */}
            {vehicle.status === 'limpio' && cleanerName && (
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <User className="h-3 w-3" />
                <span className="truncate">{cleanerName}</span>
              </div>
            )}

            {/* Audit badge for clean vehicles */}
            {vehicle.status === 'limpio' && (
              <div
                className={`flex items-center gap-1.5 text-xs cursor-pointer rounded-md px-2 py-1 -mx-1 transition-colors ${
                  auditInfo?.status === 'approved'
                    ? 'text-green-700 bg-green-50 hover:bg-green-100'
                    : auditInfo?.status === 'rejected'
                    ? 'text-red-700 bg-red-50 hover:bg-red-100'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setAuditDialogOpen(true);
                }}
              >
                {auditInfo?.status === 'approved' ? (
                  <><ShieldCheck className="h-3 w-3" /><span>Auditado {auditInfo.score}%</span></>
                ) : auditInfo?.status === 'rejected' ? (
                  <><ShieldX className="h-3 w-3" /><span>Rechazado</span></>
                ) : (
                  <><ClipboardCheck className="h-3 w-3" /><span>Pendiente auditoría</span></>
                )}
              </div>
            )}

            {/* Service indicator - show different icon based on service_type */}
            {vehicle.status === 'en_servicio' && (
              <div className={`flex items-center gap-1.5 text-xs ${vehicle.service_type === 'bloqueo' ? 'text-orange-600' : 'text-purple-600'}`}>
                <ServiceIcon className="h-3 w-3" />
                <span>{serviceLabel}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Context Menu Button - visible on hover (hidden during drag overlay) */}
        {!isDragOverlay && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Manual status change submenu - admin/owner only */}
                {canChangeStatus && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={isChangingStatus}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Cambiar estado
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {STATUS_OPTIONS.filter(s => s.value !== vehicle.status).map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChangeStatus(opt.value);
                            }}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full mr-2 inline-block"
                              style={{ backgroundColor: opt.color }}
                            />
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
                )}

                {vehicle.status !== 'en_servicio' && vehicle.status !== 'alquilado' && (
                  <DropdownMenuItem onClick={handleOpenServiceDialog}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Mover a En Servicio
                  </DropdownMenuItem>
                )}
                {vehicle.status === 'en_servicio' && (
                  <DropdownMenuItem onClick={handleReturnFromService}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Servicio
                  </DropdownMenuItem>
                )}
                {vehicle.status === 'limpio' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAuditDialogOpen(true); }}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Auditar calidad
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive} disabled={isArchiving}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archivar vehículo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <MoveToServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        onConfirm={handleMoveToService}
        matricula={vehicle.matricula}
        isLoading={isMovingToService}
      />

      <VehicleAuditDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
        vehicle={vehicle}
      />
    </>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'sucio': return 'hsl(0, 84%, 60%)';
    case 'incompleto': return 'hsl(25, 95%, 53%)';
    case 'limpio': return 'hsl(142, 76%, 36%)';
    case 'en_servicio': return 'hsl(280, 65%, 60%)';
    case 'alquilado': return 'hsl(217, 91%, 60%)';
    default: return 'hsl(var(--muted))';
  }
}
