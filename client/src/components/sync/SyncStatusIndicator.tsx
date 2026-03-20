import { useState, useEffect } from 'react';
import { useRentlySyncContextSafe } from '@/contexts/RentlySyncContext';
import { Loader2, Car, RefreshCw, Timer, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function SyncStatusIndicator() {
  const ctx = useRentlySyncContextSafe();
  const [elapsed, setElapsed] = useState(0);
  const [minimized, setMinimized] = useState(false);

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
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSyncDialogOpen(true)}
          className="gap-2 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm rounded-full px-4"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <Car className="h-3.5 w-3.5" />
          <span className="text-xs">
            Sync Rently · Pág {progress.page} · {progress.totalInserted} nuevas · {timeStr}
          </span>
        </Button>
      </div>
    );
  }

  // When not syncing but auto-sync is configured, show the auto-sync status pill
  if (!isConfigured) return null;

  const countdownMins = Math.floor(autoSyncCountdown / 60);
  const countdownSecs = autoSyncCountdown % 60;
  const countdownStr = countdownMins > 0 ? `${countdownMins}:${String(countdownSecs).padStart(2, '0')}` : `${countdownSecs}s`;

  // Minimized mode: just a small icon button
  if (minimized) {
    return (
      <TooltipProvider>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shadow-sm bg-background/95 backdrop-blur-sm"
                onClick={() => setMinimized(false)}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${autoSyncEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {autoSyncEnabled ? `Próx. sync: ${countdownStr}` : 'Auto-sync pausado'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 animate-in slide-in-from-bottom-2">
        {autoSyncEnabled && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/95 backdrop-blur-sm border border-border/50 shadow-sm text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setMinimized(true)}
          >
            <Timer className="h-3 w-3" />
            <span>Próx. sync: {countdownStr}</span>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full shadow-sm bg-background/95 backdrop-blur-sm"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            >
              {autoSyncEnabled ? (
                <RefreshCw className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Pause className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {autoSyncEnabled ? 'Auto-sync activo (cada 5 min) — clic para pausar' : 'Auto-sync pausado — clic para activar'}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full shadow-sm bg-background/95 backdrop-blur-sm"
              onClick={() => ctx.syncRently(false)}
            >
              <Play className="h-3.5 w-3.5 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Sincronizar ahora
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
