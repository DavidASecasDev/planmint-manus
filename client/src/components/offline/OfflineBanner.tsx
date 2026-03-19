import { WifiOff, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
}

export const OfflineBanner = ({ className }: OfflineBannerProps) => {
  const { isOnline, wasOffline, clearWasOffline } = useOnlineStatus();
  const { pendingCount, failedCount } = useOfflineStorage();
  const { isSyncing, sync, lastSyncResult } = useSyncEngine();

  const handleSync = async () => {
    await sync();
    clearWasOffline();
  };

  // Offline state
  if (!isOnline) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20",
        className
      )}>
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Sin conexión
          </span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Los cambios se guardarán localmente
        </span>
      </div>
    );
  }

  // Just came back online with pending changes
  if (wasOffline && pendingCount > 0) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20",
        className
      )}>
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Conexión restaurada
          </span>
          <Badge variant="secondary">
            {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} por sincronizar
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={clearWasOffline}
          >
            Después
          </Button>
        </div>
      </div>
    );
  }

  // Has pending changes (online but not synced)
  if (pendingCount > 0 || failedCount > 0) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 border-b",
        failedCount > 0 
          ? "bg-destructive/10 border-destructive/20" 
          : "bg-muted/50 border-border/50",
        className
      )}>
        <div className="flex items-center gap-2">
          {failedCount > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {failedCount} cambio{failedCount !== 1 ? 's' : ''} con error
              </span>
            </>
          ) : (
            <>
              <CloudOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        <Button 
          size="sm" 
          variant={failedCount > 0 ? "destructive" : "outline"}
          onClick={handleSync}
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? 'Sincronizando...' : failedCount > 0 ? 'Reintentar' : 'Sincronizar'}
        </Button>
      </div>
    );
  }

  // Show success message briefly after sync
  if (lastSyncResult?.success && lastSyncResult.syncedCount > 0) {
    return (
      <div className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/20",
        className
      )}>
        <Cloud className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700 dark:text-green-400">
          {lastSyncResult.syncedCount} cambio{lastSyncResult.syncedCount !== 1 ? 's' : ''} sincronizado{lastSyncResult.syncedCount !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return null;
};
