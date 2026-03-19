import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import type { TransferRequestStatus, TransferFilters } from '@/types/transfers';

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

export function TransferFilters({ filters, onFiltersChange, brokers }: TransferFiltersProps) {
  const hasActiveFilters = filters.search || filters.broker || (filters.status && filters.status !== 'all');

  const handleClear = () => {
    onFiltersChange({
      search: '',
      broker: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };

  return (
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

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5">
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
