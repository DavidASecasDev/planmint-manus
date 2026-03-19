import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Archive, RefreshCw, Upload } from 'lucide-react';
import { ManageLocationsDialog } from './ManageLocationsDialog';

interface VehicleToolbarProps {
  archivedCount: number;
  onOpenArchived: () => void;
  onSync: () => void;
  isSyncing: boolean;
  onOpenImport: () => void;
  canSync: boolean;
  canImport: boolean;
  canArchive: boolean;
  canManageLocations: boolean;
}

export function VehicleToolbar({ 
  archivedCount, 
  onOpenArchived, 
  onSync, 
  isSyncing,
  onOpenImport,
  canSync,
  canImport,
  canArchive,
  canManageLocations,
}: VehicleToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {canManageLocations && <ManageLocationsDialog />}
      
      {canArchive && archivedCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenArchived}
          className="gap-2"
        >
          <Archive className="h-4 w-4" />
          <span className="hidden sm:inline">Archivados</span>
          <Badge variant="secondary" className="ml-1">
            {archivedCount}
          </Badge>
        </Button>
      )}

      {canImport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenImport}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Importar</span>
        </Button>
      )}
      
      {canSync && (
        <Button
          variant="default"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
        </Button>
      )}
    </div>
  );
}
