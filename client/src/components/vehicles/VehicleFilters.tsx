import { Search, MapPin, X, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VehicleFilters as VehicleFiltersType, VehicleLocation } from '@/types/vehicles';

interface VehicleFiltersProps {
  filters: VehicleFiltersType;
  onFiltersChange: (filters: VehicleFiltersType) => void;
  locations: VehicleLocation[];
  totalCount: number;
  filteredCount: number;
}

export function VehicleFilters({ 
  filters, 
  onFiltersChange, 
  locations, 
  totalCount, 
  filteredCount 
}: VehicleFiltersProps) {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.locationId !== 'all' ||
    filters.cleaningStatus !== 'all';

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      locationId: 'all',
      cleaningStatus: 'all',
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar matrícula o modelo..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        {/* Filtro por ubicación */}
        <Select
          value={filters.locationId}
          onValueChange={(value) => onFiltersChange({ ...filters, locationId: value })}
        >
          <SelectTrigger className="w-[180px]">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Ubicación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            <SelectItem value="none">Sin ubicación</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro por estado de limpieza */}
        <Select
          value={filters.cleaningStatus}
          onValueChange={(value) => 
            onFiltersChange({ ...filters, cleaningStatus: value as VehicleFiltersType['cleaningStatus'] })
          }
        >
          <SelectTrigger className="w-[180px]">
            <CheckCircle className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Estado tareas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="none">Sin tareas hechas</SelectItem>
            <SelectItem value="partial">Tareas parciales</SelectItem>
            <SelectItem value="complete">Todas completadas</SelectItem>
          </SelectContent>
        </Select>

        {/* Botón limpiar filtros */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Contador de resultados */}
      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredCount} de {totalCount} vehículos
        </p>
      )}
    </div>
  );
}
