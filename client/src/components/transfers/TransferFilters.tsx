import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, X, CalendarDays, Archive } from 'lucide-react';
import type { TransferRequestStatus, TransferFilters, ServiceType } from '@/types/transfers';

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

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
  };
}

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: firstDay.toISOString().split('T')[0],
    to: lastDay.toISOString().split('T')[0],
  };
}

export function TransferFilters({ filters, onFiltersChange, brokers }: TransferFiltersProps) {
  const hasActiveFilters = filters.search 
    || filters.broker 
    || (filters.status && filters.status !== 'all') 
    || (filters.serviceType && filters.serviceType !== 'all')
    || filters.dateFrom
    || filters.dateTo
    || filters.showArchived;

  const handleClear = () => {
    onFiltersChange({
      search: '',
      broker: '',
      status: 'all',
      serviceType: 'all',
      dateFrom: '',
      dateTo: '',
      showArchived: false,
    });
  };

  const handleQuickDate = (type: 'today' | 'week' | 'month') => {
    if (type === 'today') {
      const today = getToday();
      onFiltersChange({ ...filters, dateFrom: today, dateTo: today });
    } else if (type === 'week') {
      const { from, to } = getWeekRange();
      onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
    } else {
      const { from, to } = getMonthRange();
      onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
    }
  };

  // Determine which quick date button is active
  const today = getToday();
  const week = getWeekRange();
  const month = getMonthRange();
  const isToday = filters.dateFrom === today && filters.dateTo === today;
  const isWeek = filters.dateFrom === week.from && filters.dateTo === week.to;
  const isMonth = filters.dateFrom === month.from && filters.dateTo === month.to;

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
          value={filters.serviceType || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, serviceType: value as ServiceType | 'all' })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de servicio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los servicios</SelectItem>
            <SelectItem value="point_to_point">Punto a punto</SelectItem>
            <SelectItem value="pack">Pack por horas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Date range + Quick buttons + Clear */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">Fecha:</span>
        </div>

        {/* Quick date buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant={isToday ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => handleQuickDate('today')}
          >
            Hoy
          </Button>
          <Button
            variant={isWeek ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => handleQuickDate('week')}
          >
            Semana
          </Button>
          <Button
            variant={isMonth ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => handleQuickDate('month')}
          >
            Mes
          </Button>
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

        <div className="flex items-center gap-2 ml-auto">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
            Mostrar archivados
          </Label>
          <Switch
            id="show-archived"
            checked={filters.showArchived}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, showArchived: checked })}
          />
        </div>

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
