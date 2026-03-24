import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, MapPin, FileText, CalendarDays } from 'lucide-react';
import type { TransferRequestStatus, TransferFilters, PricingMode } from '@/types/transfers';

interface TransferFiltersProps {
  filters: TransferFilters;
  onFiltersChange: (filters: TransferFilters) => void;
  brokers: string[];
}

const STATUS_OPTIONS: { value: TransferRequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_gestion', label: 'En gestión' },
  { value: 'presupuesto_enviado', label: 'Ppto. Enviado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PRICING_MODE_OPTIONS: { value: PricingMode | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los modos' },
  { value: 'zone_tariff', label: 'Tarifa por zona' },
  { value: 'provider_quote', label: 'Presupuesto proveedor' },
];

export function TransferFilters({ filters, onFiltersChange, brokers }: TransferFiltersProps) {
  const hasActiveFilters = filters.search 
    || filters.broker 
    || (filters.status && filters.status !== 'all') 
    || (filters.pricingMode && filters.pricingMode !== 'all')
    || filters.dateFrom
    || filters.dateTo;

  const handleClear = () => {
    onFiltersChange({
      search: '',
      broker: '',
      status: 'all',
      pricingMode: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Selects */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, broker o número..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.broker || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, broker: value === 'all' ? '' : value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Broker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los brokers</SelectItem>
            {brokers.map((broker) => (
              <SelectItem key={broker} value={broker}>
                {broker}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value as TransferRequestStatus | 'all' })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.pricingMode || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, pricingMode: value as PricingMode | 'all' })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Modo de precio" />
          </SelectTrigger>
          <SelectContent>
            {PRICING_MODE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-1.5">
                  {option.value === 'zone_tariff' && <MapPin className="h-3.5 w-3.5 text-blue-600" />}
                  {option.value === 'provider_quote' && <FileText className="h-3.5 w-3.5 text-amber-600" />}
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Date range + Clear */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">Fecha transfer:</span>
        </div>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          className="w-[160px]"
          placeholder="Desde"
        />
        <span className="text-sm text-muted-foreground">—</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          className="w-[160px]"
          placeholder="Hasta"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5">
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
