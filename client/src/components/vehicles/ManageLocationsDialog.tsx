import { useState } from 'react';
import { MapPin, Plus, Trash2, Loader2, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useVehicleLocations } from '@/hooks/useVehicleLocations';

interface ManageLocationsDialogProps {
  trigger?: React.ReactNode;
}

export function ManageLocationsDialog({ trigger }: ManageLocationsDialogProps) {
  const { locations, isLoading, createLocation, isCreating, deleteLocation, isDeleting } = useVehicleLocations();
  const [open, setOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const handleCreate = async () => {
    if (!newLocationName.trim()) return;
    
    try {
      await createLocation(newLocationName);
      setNewLocationName('');
    } catch {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <MapPin className="h-4 w-4" />
            Ubicaciones
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Gestionar Ubicaciones
          </DialogTitle>
          <DialogDescription>
            Administra las ubicaciones disponibles para los vehículos de tu flota.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{location.name}</span>
                  </div>
                  {location.is_default ? (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Predeterminada
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteLocation(location.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Nueva ubicación..."
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <Button
              onClick={handleCreate}
              disabled={!newLocationName.trim() || isCreating}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
