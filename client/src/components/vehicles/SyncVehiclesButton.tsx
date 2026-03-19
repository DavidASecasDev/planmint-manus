import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncVehiclesButtonProps {
  onSync: () => void;
  isSyncing: boolean;
}

export function SyncVehiclesButton({ onSync, isSyncing }: SyncVehiclesButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={() => onSync()}
      disabled={isSyncing}
      className="gap-2"
    >
      <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
      {isSyncing ? 'Sincronizando...' : 'Sincronizar vehículos'}
    </Button>
  );
}
