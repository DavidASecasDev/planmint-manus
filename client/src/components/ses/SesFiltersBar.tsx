import { Cloud, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SesDraftFilters } from '@/lib/sesFilterPreferences';

interface SesFiltersBarProps {
  filters: SesDraftFilters;
  onChange: (filters: SesDraftFilters) => void;
  saving: boolean;
}

export function SesFiltersBar({ filters, onChange, saving }: SesFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Reserva o matrícula exacta..."
          className="pl-9"
          aria-label="Buscar coincidencia exacta por reserva o matrícula"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })} className="w-40" aria-label="Fecha inicial" />
        <span className="text-xs text-slate-400">a</span>
        <Input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => onChange({ ...filters, dateTo: event.target.value })} className="w-40" aria-label="Fecha final, máximo 93 días" />
        <Select value={filters.status} onValueChange={(status) => onChange({ ...filters, status })}>
          <SelectTrigger className="w-44"><SlidersHorizontal className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="incomplete">Incompletos</SelectItem>
            <SelectItem value="ready">Listos</SelectItem>
            <SelectItem value="xml_generated">XML generado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500" title="Estas preferencias pertenecen únicamente a tu cuenta">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5 text-emerald-600" />}
        <span>{saving ? 'Guardando filtros…' : 'Filtros guardados en tu cuenta'}</span>
      </div>
    </div>
  );
}
