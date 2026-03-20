import { useState, useEffect } from 'react';
import { useRentlySyncContextSafe } from '@/contexts/RentlySyncContext';
import { Loader2, Car, RefreshCw, Timer, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
        className="fixed bottom-4 right-4 z-50 gap-2 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm animate-in slide-in-from-bottom-2"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <Car className="h-3.5 w-3.5" />
        <span className="text-xs">
          Sync Rently · Pág {progress.page} · {progress.totalInserted} nuevas · {timeStr}
        </span>
      </Button>
    );
  }

  // When not syncing but auto-sync is configured, show the auto-sync status pill
  if (!isConfigured) return null;

  const countdownMins = Math.floor(autoSyncCountdown / 60);
  const countdownSecs = autoSyncCountdown % 60;
  const countdownStr = countdownMins > 0 ? `${countdownMins}:${String(countdownSecs).padStart(2, '0')}` : `${countdownSecs}s`;

  return (
    <TooltipProvider>
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5">
        {autoSyncEnabled && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/95 backdrop-blur-sm border border-border/50 shadow-sm text-xs text-muted-foreground">
            <Timer className="h-3 w-3" />
            <span>Próx. sync: {countdownStr}</span>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full shadow-sm"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            >
              {autoSyncEnabled ? (
                <RefreshCw className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Pause className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {autoSyncEnabled ? 'Auto-sync activo (cada 5 min) — clic para pausar' : 'Auto-sync pausado — clic para activar'}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full shadow-sm"
              onClick={() => ctx.syncRently(false)}
            >
              <Play className="h-3.5 w-3.5 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Sincronizar ahora
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
