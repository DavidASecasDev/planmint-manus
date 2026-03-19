import { useState, useEffect } from 'react';
import { useRentlySyncContextSafe } from '@/contexts/RentlySyncContext';
import { Loader2, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SyncStatusIndicator() {
  const ctx = useRentlySyncContextSafe();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!ctx?.syncing) return;
    const interval = setInterval(() => setElapsed(ctx.getElapsedTime()), 1000);
    return () => clearInterval(interval);
  }, [ctx?.syncing, ctx?.getElapsedTime]);

  if (!ctx || !ctx.syncing) return null;

  const { progress, setSyncDialogOpen } = ctx;
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
