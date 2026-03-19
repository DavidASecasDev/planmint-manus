import { VehicleCard } from './VehicleCard';
import { VehicleWithTasks, VehicleStatus } from '@/types/vehicles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface VehicleKanbanColumnProps {
  status: VehicleStatus;
  label: string;
  color: string;
  vehicles: VehicleWithTasks[];
  onSelectVehicle: (vehicleId: string) => void;
}

export function VehicleKanbanColumn({ status, label, color, vehicles, onSelectVehicle }: VehicleKanbanColumnProps) {
  return (
    <div className="flex flex-col rounded-xl border bg-card">
      {/* Column Header */}
      <div 
        className="flex items-center justify-between p-3 border-b"
        style={{ borderTopColor: color, borderTopWidth: '3px', borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          <span 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-sm">{label}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {vehicles.length}
        </Badge>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1 p-3 max-h-[calc(100vh-280px)]">
        <div className="space-y-3">
          {vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay vehículos
            </div>
          ) : (
            vehicles.map((vehicle) => (
              <VehicleCard 
                key={vehicle.id} 
                vehicle={vehicle} 
                onSelect={onSelectVehicle}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
