import { useState } from 'react';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVehicleLocations } from '@/hooks/useVehicleLocations';

interface VehicleLocationSelectProps {
  vehicleId: string;
  currentLocationId: string | null;
}

export function VehicleLocationSelect({ vehicleId, currentLocationId }: VehicleLocationSelectProps) {
  const { locations, isLoading, createLocation, isCreating, updateVehicleLocation, isUpdatingLocation } = useVehicleLocations();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const handleLocationChange = (value: string) => {
    const locationId = value === 'none' ? null : value;
    updateVehicleLocation({ vehicleId, locationId });
  };

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return;
    
    try {
      const newLocation = await createLocation(newLocationName);
      setCreateDialogOpen(false);
      setNewLocationName('');
      // Automatically assign the new location to this vehicle
      updateVehicleLocation({ vehicleId, locationId: newLocation.id });
    } catch {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando ubicaciones...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Ubicación
        </label>
        <Select
          value={currentLocationId || 'none'}
          onValueChange={handleLocationChange}
          disabled={isUpdatingLocation}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sin ubicación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin ubicación</SelectItem>
            <SelectSeparator />
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
            <SelectSeparator />
            <Button
              variant="ghost"
              className="w-full justify-start px-2 py-1.5 h-auto font-normal"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir ubicación...
            </Button>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva ubicación</DialogTitle>
            <DialogDescription>
              Añade una nueva ubicación para los vehículos de tu flota.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nombre de la ubicación"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateLocation();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateLocation} 
              disabled={!newLocationName.trim() || isCreating}
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
