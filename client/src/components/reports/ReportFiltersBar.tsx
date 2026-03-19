import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReportFilters, DATE_RANGE_OPTIONS, TASK_STATUS_OPTIONS, TASK_TYPE_OPTIONS } from '@/types/reports';
import { useAreas } from '@/hooks/useAreas';
import { useTags } from '@/hooks/useTags';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

interface ReportFiltersBarProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  showAreaFilter?: boolean;
  showTagFilter?: boolean;
  showAssigneeFilter?: boolean;
  showStatusFilter?: boolean;
  showTypeFilter?: boolean;
}

export function ReportFiltersBar({
  filters,
  onFiltersChange,
  showAreaFilter = true,
  showTagFilter = true,
  showAssigneeFilter = true,
  showStatusFilter = true,
  showTypeFilter = true,
}: ReportFiltersBarProps) {
  const { areas } = useAreas();
  const { tags } = useTags();
  const { members } = useOrganizationMembers();
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = [
    filters.areaIds?.length,
    filters.tagIds?.length,
    filters.assigneeId && filters.assigneeId !== 'all',
    filters.status && filters.status !== 'all',
    filters.taskType && (filters.taskType as string) !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      areaIds: undefined,
      tagIds: undefined,
      assigneeId: undefined,
      status: undefined,
      taskType: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Range */}
        <Select
          value={filters.dateRange}
          onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value as ReportFilters['dateRange'] })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom date range picker */}
        {filters.dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.startDate ? format(filters.startDate, 'dd/MM/yyyy') : 'Inicio'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.startDate}
                  onSelect={(date) => onFiltersChange({ ...filters, startDate: date })}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">-</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.endDate ? format(filters.endDate, 'dd/MM/yyyy') : 'Fin'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.endDate}
                  onSelect={(date) => onFiltersChange({ ...filters, endDate: date })}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Toggle advanced filters */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-muted/30">
          {showStatusFilter && (
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => onFiltersChange({ ...filters, status: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showTypeFilter && (
            <Select
              value={filters.taskType || 'all'}
              onValueChange={(value) => onFiltersChange({ ...filters, taskType: value === 'all' ? undefined : value as ReportFilters['taskType'] })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showAssigneeFilter && (
            <Select
              value={filters.assigneeId || 'all'}
              onValueChange={(value) => onFiltersChange({ ...filters, assigneeId: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Asignado a" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id || member.id} value={member.user_id || member.id}>
                    {member.name || (member.user_id || member.id).slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showAreaFilter && (
            <Select
              value={filters.areaIds?.[0] || 'all'}
              onValueChange={(value) => onFiltersChange({ ...filters, areaIds: value === 'all' ? undefined : [value] })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showTagFilter && (
            <Select
              value={filters.tagIds?.[0] || 'all'}
              onValueChange={(value) => onFiltersChange({ ...filters, tagIds: value === 'all' ? undefined : [value] })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etiquetas</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
