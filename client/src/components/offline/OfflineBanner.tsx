import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface OfflineBannerProps {
  className?: string;
}

/** Auto-dismiss duration for the "reconnected" banner (ms) */
const RECONNECT_DISMISS_MS = 5000;

export const OfflineBanner = ({ className }: OfflineBannerProps) => {
  const { isOnline, wasOffline, clearWasOffline } = useOnlineStatus();
  const { pendingCount, failedCount } = useOfflineStorage();
  const { isSyncing, sync, lastSyncResult } = useSyncEngine();
  const queryClient = useQueryClient();

  // Track the "just reconnected, no pending changes" state with auto-dismiss
  const [showReconnected, setShowReconnected] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track when we went offline to avoid false positives from brief tab-switch events
  const wentOfflineAt = useRef<number>(0);

  // Record when we go offline
  useEffect(() => {
    if (!isOnline) {
      wentOfflineAt.current = Date.now();
    }
  }, [isOnline]);

  // When we come back online without pending changes, show the reconnected banner
  // BUT only if we were actually offline for at least 10 seconds (not a brief tab-switch glitch)
  useEffect(() => {
    if (wasOffline && isOnline && pendingCount === 0) {
      const offlineDuration = Date.now() - wentOfflineAt.current;
      // Some browsers fire offline/online events when switching tabs.
      // Only treat it as a real reconnection if offline for > 10 seconds.
      if (offlineDuration < 10_000) {
        console.log('[OfflineBanner] Ignoring brief offline blip (' + Math.round(offlineDuration / 1000) + 's)');
        clearWasOffline();
        return;
      }

      setShowReconnected(true);
      setIsSliding(false);

      // Invalidate only stale queries instead of ALL queries to avoid disrupting forms
      queryClient.invalidateQueries({ refetchType: 'active' });

      // Auto-dismiss after delay
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        setIsSliding(true);
        // Wait for slide-out animation to complete before hiding
        setTimeout(() => {
          setShowReconnected(false);
          setIsSliding(false);
          clearWasOffline();
        }, 300);
      }, RECONNECT_DISMISS_MS);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [wasOffline, isOnline, pendingCount, clearWasOffline, queryClient]);

  // When going offline, clear the reconnected banner
  useEffect(() => {
    if (!isOnline) {
      setShowReconnected(false);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    }
  }, [isOnline]);

  const handleSync = async () => {
    await sync();
    clearWasOffline();
  };

  const handleDismissReconnected = () => {
    setIsSliding(true);
    setTimeout(() => {
      setShowReconnected(false);
      setIsSliding(false);
      clearWasOffline();
    }, 300);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  };

  // ─── Offline state ───
  if (!isOnline) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 transition-all duration-300",
        className
      )}>
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-600 animate-pulse" />
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

  // ─── Just came back online with pending changes ───
  if (wasOffline && pendingCount > 0) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20 transition-all duration-300",
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

  // ─── Just reconnected, no pending changes — auto-dismiss banner ───
  if (showReconnected) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-2 border-b transition-all duration-300 overflow-hidden",
          "bg-green-500/10 border-green-500/20",
          isSliding ? "max-h-0 py-0 opacity-0" : "max-h-12 opacity-100",
          className
        )}
      >
        <Wifi className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          Conexión restaurada
        </span>
        <span className="text-xs text-green-600/70 dark:text-green-400/70">
          — actualizando datos
        </span>
        <RefreshCw className="h-3 w-3 text-green-600/50 animate-spin ml-1" />
        <button
          onClick={handleDismissReconnected}
          className="ml-2 text-green-600/50 hover:text-green-600 transition-colors text-xs"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    );
  }

  // ─── Has pending changes (online but not synced) ───
  if (pendingCount > 0 || failedCount > 0) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 border-b transition-all duration-300",
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

  // ─── Show success message briefly after sync ───
  if (lastSyncResult?.success && lastSyncResult.syncedCount > 0) {
    return (
      <div className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/20 transition-all duration-300",
        className
      )}>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700 dark:text-green-400">
          {lastSyncResult.syncedCount} cambio{lastSyncResult.syncedCount !== 1 ? 's' : ''} sincronizado{lastSyncResult.syncedCount !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return null;
};
