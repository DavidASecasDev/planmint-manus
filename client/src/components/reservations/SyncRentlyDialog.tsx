import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, Car, Loader2, Settings, Clock, Pause, X, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRentlySync } from '@/hooks/useRentlySync';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface SyncRentlyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete?: () => void;
}

export function SyncRentlyDialog({ open, onOpenChange, onSyncComplete }: SyncRentlyDialogProps) {
  const { 
    syncing, 
    isConfigured, 
    settingsLoading, 
    syncRently, 
    testConnection, 
    testing, 
    progress,
    pauseSync,
    cancelSync,
    getElapsedTime,
  } = useRentlySync();

  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState<{
    inserted: number;
    duplicates: number;
    filtered: number;
    total_fetched: number;
    archived: number;
    date_range_in_data?: { oldest: string; newest: string } | null;
  } | null>(null);
  const [vehicleSyncStatus, setVehicleSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [vehicleSyncResult, setVehicleSyncResult] = useState<{ vehicles_created: number; vehicles_updated: number } | null>(null);

  // Track elapsed time while syncing
  useEffect(() => {
    if (!progress.isRunning) {
      return;
    }
    
    const interval = setInterval(() => {
      setElapsedTime(getElapsedTime());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [progress.isRunning, getElapsedTime]);

  const handleSync = async () => {
    setResult(null);
    setElapsedTime(0);
    setVehicleSyncStatus('idle');
    setVehicleSyncResult(null);
    
    const syncResult = await syncRently(true); // Always reset for new sync

    if (syncResult.success) {
      // Step 2: auto-sync vehicle statuses
      setVehicleSyncStatus('syncing');
      try {
        const { data: vehicleData, error: vehicleError } = await supabase.rpc('sync_vehicles_from_reservations');
        if (!vehicleError) {
          const vResult = vehicleData as { vehicles_created: number; vehicles_updated: number } | null;
          setVehicleSyncResult(vResult || { vehicles_created: 0, vehicles_updated: 0 });
          setVehicleSyncStatus('done');
          queryClient.invalidateQueries({ queryKey: ['vehicles', orgId] });
        } else {
          setVehicleSyncStatus('error');
        }
      } catch {
        setVehicleSyncStatus('error');
      }

      setResult({
        inserted: syncResult.inserted,
        duplicates: syncResult.duplicates,
        filtered: syncResult.filtered,
        total_fetched: syncResult.total_fetched,
        archived: syncResult.archived || 0,
        date_range_in_data: syncResult.date_range_in_data,
      });
      const archivedMsg = syncResult.archived && syncResult.archived > 0 ? `, ${syncResult.archived} archivadas` : '';
      toast.success(`Sincronización completada: ${syncResult.inserted} nuevas reservas${archivedMsg}`);
      onSyncComplete?.();
    } else {
      const errorMsg = syncResult.errors[0]?.error || 'Error desconocido';
      toast.error(`Error de sincronización: ${errorMsg}`);
    }
  };

  const handleTestConnection = async () => {
    const testResult = await testConnection();
    if (testResult.success) {
      toast.success('Conexión exitosa con Rently');
    } else {
      toast.error(testResult.error || 'Error de conexión');
    }
  };

  const handleClose = () => {
    // Sync continues in background via global context — just close dialog
    setResult(null);
    onOpenChange(false);
  };

  const handlePause = () => {
    pauseSync();
    toast.info('Sincronización pausada. Puedes reanudarla más tarde.');
  };

  const handleCancel = () => {
    cancelSync();
    toast.info('Sincronización cancelada.');
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Estimate total pages (assuming ~100 records per page and ~3500 total in typical case)
  const estimatedTotalPages = 35;
  const progressPercentage = progress.page > 0 
    ? Math.min(Math.round((progress.page / estimatedTotalPages) * 100), 99)
    : 0;

  if (settingsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Sincronizar con Rently
          </DialogTitle>
          <DialogDescription>
            Importa reservas desde tu cuenta de Rently
          </DialogDescription>
        </DialogHeader>

        {!isConfigured ? (
          <div className="py-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <div>
              <p className="font-medium">Rently no está configurado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Configura tus credenciales de Rently en Ajustes → Integraciones
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/settings" onClick={() => onOpenChange(false)}>
                <Settings className="h-4 w-4 mr-2" />
                Ir a Configuración
              </Link>
            </Button>
          </div>
        ) : syncing ? (
          // Syncing in progress view
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
              <p className="font-semibold">Sincronizando...</p>
              <p className="text-sm text-muted-foreground">
                Página {progress.page} de ~{estimatedTotalPages}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {progressPercentage}% completado
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="p-2 rounded-lg bg-muted text-center">
                <p className="font-medium">{progress.totalFetched}</p>
                <p className="text-xs text-muted-foreground">Obtenidas</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10 text-center">
                <p className="font-medium text-green-600">{progress.totalInserted}</p>
                <p className="text-xs text-muted-foreground">Nuevas</p>
              </div>
              <div className="p-2 rounded-lg bg-muted text-center">
                <p className="font-medium">{progress.totalDuplicates}</p>
                <p className="text-xs text-muted-foreground">Duplicadas</p>
              </div>
            </div>

            {/* Elapsed time */}
            <div className="flex items-center justify-center gap-2 py-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Tiempo: {formatElapsedTime(elapsedTime)}
              </span>
            </div>

            {/* Info message */}
            <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground text-center">
              Si cierras esta ventana, la sincronización continuará y podrás reanudarla más tarde.
            </div>

            {/* Control buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handlePause}
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancel}
                size="icon"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : result ? (
          // Results view
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Sincronización completada</p>
              {elapsedTime > 0 && (
                <p className="text-sm text-muted-foreground">
                  Duración: {formatElapsedTime(elapsedTime)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-green-600 font-medium text-lg">{result.inserted}</p>
                <p className="text-muted-foreground">Nuevas reservas</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-lg">{result.duplicates}</p>
                <p className="text-muted-foreground">Ya existentes</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-lg">{result.filtered}</p>
                <p className="text-muted-foreground">Filtradas</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-lg">{result.total_fetched}</p>
                <p className="text-muted-foreground">Total obtenidas</p>
              </div>
            </div>
            
            {/* Archived count */}
            {result.archived > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                <p className="font-medium text-amber-700">
                  {result.archived} reserva{result.archived !== 1 ? 's' : ''} archivada{result.archived !== 1 ? 's' : ''} automáticamente
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Reservas terminadas hace más tiempo del configurado.
                </p>
              </div>
            )}
            
            {/* Diagnostic message when no insertions */}
            {result.total_fetched > 0 && result.inserted === 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                <p className="font-medium text-amber-600">
                  Se obtuvieron {result.total_fetched} reservas pero ninguna se insertó
                </p>
                <p className="text-muted-foreground mt-1">
                  Esto puede deberse a que todas las reservas ya existen en el sistema (duplicadas).
                </p>
              </div>
            )}
            
            {/* Show date range in data if available */}
            {result.date_range_in_data && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <p className="font-medium">Rango de fechas en Rently:</p>
                <p className="text-muted-foreground">
                  {format(new Date(result.date_range_in_data.oldest), "dd/MM/yyyy", { locale: es })} - {format(new Date(result.date_range_in_data.newest), "dd/MM/yyyy", { locale: es })}
                </p>
              </div>
            )}

            {/* Vehicle sync results */}
            <div className="p-3 rounded-lg border bg-muted/50 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>Estados de vehículos</span>
                {vehicleSyncStatus === 'syncing' && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
                )}
                {vehicleSyncStatus === 'done' && (
                  <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                )}
                {vehicleSyncStatus === 'error' && (
                  <AlertCircle className="h-3 w-3 text-destructive ml-auto" />
                )}
              </div>
              {vehicleSyncStatus === 'syncing' && (
                <p className="text-xs text-muted-foreground">Actualizando estados...</p>
              )}
              {vehicleSyncStatus === 'done' && vehicleSyncResult && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="font-medium">{vehicleSyncResult.vehicles_created}</p>
                    <p className="text-xs text-muted-foreground">Creados</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{vehicleSyncResult.vehicles_updated}</p>
                    <p className="text-xs text-muted-foreground">Actualizados</p>
                  </div>
                </div>
              )}
              {vehicleSyncStatus === 'error' && (
                <p className="text-xs text-destructive">No se pudo actualizar los estados de vehículos.</p>
              )}
            </div>
            
            <Button onClick={handleClose} className="w-full">
              Cerrar
            </Button>
          </div>
        ) : (
          // Initial sync form
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <p className="font-medium text-sm">Sincronización automática</p>
              <p className="text-xs text-muted-foreground">
                Se importarán todas las reservas de Rently. El proceso es resumible: si se interrumpe, continuará desde donde se quedó.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Las reservas con estado "Cancelada" o "Cotizado" se excluyen automáticamente.
              Las reservas duplicadas se ignoran.
            </p>

            <div className="flex gap-2">
              <Button 
                onClick={handleSync} 
                disabled={syncing || testing}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Sincronización
              </Button>
              <Button 
                variant="outline"
                onClick={handleTestConnection}
                disabled={syncing || testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Probar'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
