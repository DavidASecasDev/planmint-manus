import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllVehiclesForSelect } from '@/hooks/useAllVehiclesForSelect';

interface VehicleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Vehicle selector that shows ALL vehicles (active + archived),
 * grouped into two sections for clarity.
 */
export function VehicleSelect({ value, onValueChange, placeholder = 'Seleccionar...' }: VehicleSelectProps) {
  const { activeVehicles, archivedVehicles, isLoading } = useAllVehiclesForSelect();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? 'Cargando...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {activeVehicles.length > 0 && (
          <SelectGroup>
            <SelectLabel>Activos ({activeVehicles.length})</SelectLabel>
            {activeVehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.matricula}{v.modelo ? ` - ${v.modelo}` : ''}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {archivedVehicles.length > 0 && (
          <SelectGroup>
            <SelectLabel>Archivados ({archivedVehicles.length})</SelectLabel>
            {archivedVehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.matricula}{v.modelo ? ` - ${v.modelo}` : ''}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {activeVehicles.length === 0 && archivedVehicles.length === 0 && !isLoading && (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No hay vehículos disponibles
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
