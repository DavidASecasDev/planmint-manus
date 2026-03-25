import { useState } from 'react';
import { VehicleWithTasks, CLEANING_TASKS, VehicleStatus, ServiceType } from '@/types/vehicles';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { User, MoreVertical, Archive, Wrench, CheckCircle, MapPin, Lock, ShieldCheck, ShieldX, ClipboardCheck } from 'lucide-react';
import { useVehicles } from '@/hooks/useVehicles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { MoveToServiceDialog } from './MoveToServiceDialog';
import { VehicleAuditDialog } from './VehicleAuditDialog';
import { useVehicleAuditStatuses } from '@/hooks/useVehicleAudits';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VehicleCardProps {
  vehicle: VehicleWithTasks;
  onSelect: (vehicleId: string) => void;
}

export function VehicleCard({ vehicle, onSelect }: VehicleCardProps) {
  const { archiveVehicle, isArchiving } = useVehicles();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [isMovingToService, setIsMovingToService] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const { data: auditStatuses } = useVehicleAuditStatuses();
  const auditInfo = auditStatuses?.get(vehicle.id);
  
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

  const handleCardClick = () => {
    onSelect(vehicle.id);
  };

  const ServiceIcon = vehicle.service_type === 'bloqueo' ? Lock : Wrench;
  const serviceLabel = vehicle.service_type === 'bloqueo' ? 'Bloqueo disponibilidad' : 'En reparación';

  return (
    <>
      <div className="relative group">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4" 
          style={{ borderLeftColor: getStatusColor(vehicle.status) }}
          onClick={handleCardClick}
        >
          <CardHeader className="p-3 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base tracking-wide">{vehicle.matricula}</h3>
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

        {/* Context Menu Button - visible on hover */}
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
