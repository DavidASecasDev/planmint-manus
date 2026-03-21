import { useState, useEffect } from 'react';
import { useRentlySyncContextSafe } from '@/contexts/RentlySyncContext';
import { Loader2, Car, RefreshCw, Timer, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * SyncStatusIndicator — now rendered INLINE inside the AppHeader,
 * no longer uses fixed positioning. It sits naturally in the header's
 * right-side action bar, next to notifications and user avatar.
 */
export function SyncStatusIndicator() {
  const ctx = useRentlySyncContextSafe();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!ctx?.syncing) return;
    const interval = setInterval(() => setElapsed(ctx.getElapsedTime()), 1000);
    return () => clearInterval(interval);
  }, [ctx?.syncing, ctx?.getElapsedTime]);

  if (!ctx) return null;

  const { progress, setSyncDialogOpen, syncing, autoSyncEnabled, setAutoSyncEnabled, autoSyncCountdown, isConfigured } = ctx;

  // When actively syncing, show the active sync indicator
  if (syncing) {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSyncDialogOpen(true)}
        className="gap-1.5 h-8 shadow-none border-primary/20 bg-primary/5 rounded-full px-3 text-xs"
      >
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <Car className="h-3 w-3" />
        <span className="hidden sm:inline">Sync · Pág {progress.page} · {progress.totalInserted} nuevas · {timeStr}</span>
        <span className="sm:hidden">{timeStr}</span>
      </Button>
    );
  }

  // When not syncing but auto-sync is configured, show the auto-sync status
  if (!isConfigured) return null;

  const countdownMins = Math.floor(autoSyncCountdown / 60);
  const countdownSecs = autoSyncCountdown % 60;
  const countdownStr = countdownMins > 0 ? `${countdownMins}:${String(countdownSecs).padStart(2, '0')}` : `${countdownSecs}s`;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Countdown pill */}
        {autoSyncEnabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 text-[11px] text-muted-foreground cursor-default select-none">
                <Timer className="h-3 w-3" />
                <span>{countdownStr}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">Próxima sincronización Rently</TooltipContent>
          </Tooltip>
        )}

        {/* Toggle auto-sync */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            >
              {autoSyncEnabled ? (
                <RefreshCw className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Pause className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {autoSyncEnabled ? 'Auto-sync activo — clic para pausar' : 'Auto-sync pausado — clic para activar'}
          </TooltipContent>
        </Tooltip>

        {/* Manual sync button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => ctx.syncRently(false)}
            >
              <Play className="h-3.5 w-3.5 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Sincronizar ahora</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
