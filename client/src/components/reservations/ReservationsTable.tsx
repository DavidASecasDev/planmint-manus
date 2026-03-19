import { useState, useMemo } from 'react';
import { format, isSameDay, parseISO, startOfDay, isAfter, isBefore, addDays } from 'date-fns';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { ArrowUpDown, Search, X, Filter, CalendarIcon, Archive, ArchiveX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Reservation, UpdateReservationData } from '@/types/reservations';
import { ChipSelect } from './ChipSelect';
import { AssigneeSelect } from './AssigneeSelect';
import { EditableCell } from './EditableCell';
import { EditableDateTimeCell } from './EditableDateTimeCell';
import { AddReservationDialog } from './AddReservationDialog';
import { ArchivedReservationsSheet } from './ArchivedReservationsSheet';
import { useReservations } from '@/hooks/useReservations';
import { useIntegrationFlags } from '@/hooks/useIntegrationFlags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Column {
  key: string;
  label: string;
  width: string;
  sticky?: boolean;
  type: 'text' | 'date' | 'datetime' | 'chip' | 'assignee' | 'number' | 'readonly' | 'checkbox' | 'actions';
  fieldName?: string;
  filterable?: boolean;
}

// Orden exacto del Excel
const COLUMNS: Column[] = [
  { key: 'completado', label: '✓', width: 'w-10', type: 'checkbox', filterable: false },
  { key: 'fecha_hora', label: 'Fecha/Hora', width: 'w-36', sticky: false, type: 'datetime', filterable: true },
  { key: 'tipo_actividad', label: 'Tipo Actividad', width: 'w-24', type: 'chip', fieldName: 'tipo_actividad', filterable: true },
  { key: 'external_reservation_id', label: 'Reserva', width: 'w-20', type: 'readonly', filterable: true },
  { key: 'lugar', label: 'Lugar', width: 'w-56', type: 'text', filterable: true },
  { key: 'cliente', label: 'Cliente', width: 'w-36', type: 'readonly', filterable: true },
  { key: 'modelo', label: 'Modelo', width: 'w-44', type: 'text', filterable: true },
  { key: 'auto', label: 'Auto', width: 'w-28', type: 'text', filterable: true },
  { key: 'estado', label: 'Estado', width: 'w-28', type: 'chip', fieldName: 'estado', filterable: true },
  { key: 'asignado_rental', label: 'Rental', width: 'w-28', type: 'assignee', filterable: false },
  { key: 'asignado_escoba', label: 'Escoba', width: 'w-28', type: 'assignee', filterable: false },
  { key: 'pagado', label: 'Pagado', width: 'w-20', type: 'chip', fieldName: 'pagado', filterable: true },
  { key: 'hosp', label: 'Hosp', width: 'w-16', type: 'chip', fieldName: 'hosp', filterable: true },
  { key: 'checkin', label: 'Check-in', width: 'w-20', type: 'chip', fieldName: 'checkin', filterable: true },
  { key: 'contacto', label: 'Contacto', width: 'w-20', type: 'chip', fieldName: 'contacto', filterable: true },
  { key: 'notas', label: 'Notas', width: 'w-[600px]', type: 'text', filterable: false },
  { key: 'actions', label: '', width: 'w-10', type: 'actions', filterable: false },
];

type TipoOperacion = 'Entrega' | 'Devolución' | 'Transfer';

// Fila virtual que representa una operación (Entrega, Devolución o Transfer)
interface OperationRow {
  id: string; // reservationId + tipo
  reservationId: string;
  reservation: Reservation;
  tipoOperacion: TipoOperacion;
  fechaHora: string | null;
  lugar: string | null;
  isCompleted: boolean;
}

type ColumnFilters = Record<string, string>;

export function ReservationsTable() {
  const { 
    reservations, 
    isLoading, 
    updateReservation,
    archivedReservations,
    restoreReservation,
    archiveReservation,
    isFullAccess,
  } = useReservations();
  const { reservationsArchiveDays } = useIntegrationFlags();
  const [urlFilters, setUrlFilters] = usePersistedFilters({
    search: '',
    sortKey: 'fecha_hora',
    sortDir: 'asc' as string,
    showCancelled: false,
    dateFrom: '',
    dateTo: '',
    cf_tipo_actividad: '',
    cf_estado: '',
    cf_pagado: '',
    cf_hosp: '',
    cf_checkin: '',
    cf_contacto: '',
    cf_external_reservation_id: '',
    cf_lugar: '',
    cf_cliente: '',
    cf_modelo: '',
    cf_auto: '',
  });
  const search = urlFilters.search;
  const setSearch = (v: string) => setUrlFilters(prev => ({ ...prev, search: v }));
  const sortKey = urlFilters.sortKey;
  const setSortKey = (v: string) => setUrlFilters(prev => ({ ...prev, sortKey: v }));
  const sortDir = urlFilters.sortDir as 'asc' | 'desc';
  const setSortDir = (v: 'asc' | 'desc') => setUrlFilters(prev => ({ ...prev, sortDir: v }));
  const showCancelled = urlFilters.showCancelled;
  const setShowCancelled = (v: boolean) => setUrlFilters(prev => ({ ...prev, showCancelled: v }));

  // Derive columnFilters from URL params (cf_ prefix)
  const columnFilters = useMemo<ColumnFilters>(() => {
    const cf: ColumnFilters = {};
    const cfKeys = ['tipo_actividad', 'estado', 'pagado', 'hosp', 'checkin', 'contacto', 'external_reservation_id', 'lugar', 'cliente', 'modelo', 'auto'] as const;
    for (const k of cfKeys) {
      const val = urlFilters[`cf_${k}` as keyof typeof urlFilters] as string;
      if (val) cf[k] = val;
    }
    return cf;
  }, [urlFilters]);

  const setColumnFilters = (updater: ColumnFilters | ((prev: ColumnFilters) => ColumnFilters)) => {
    setUrlFilters(prev => {
      const newCf = typeof updater === 'function' ? updater(columnFilters) : updater;
      const update: Record<string, any> = { ...prev };
      const cfKeys = ['tipo_actividad', 'estado', 'pagado', 'hosp', 'checkin', 'contacto', 'external_reservation_id', 'lugar', 'cliente', 'modelo', 'auto'];
      for (const k of cfKeys) {
        update[`cf_${k}`] = newCf[k] || '';
      }
      return update as typeof prev;
    });
  };

  // Derive dateRange from URL params
  const dateRange = useMemo<DateRange | undefined>(() => {
    if (!urlFilters.dateFrom) return undefined;
    return {
      from: parseISO(urlFilters.dateFrom),
      to: urlFilters.dateTo ? parseISO(urlFilters.dateTo) : undefined,
    };
  }, [urlFilters.dateFrom, urlFilters.dateTo]);

  const setDateRange = (range: DateRange | undefined) => {
    setUrlFilters(prev => ({
      ...prev,
      dateFrom: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      dateTo: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    }));
  };

  const [showFilters, setShowFilters] = useState(true);
  const [showArchivedSheet, setShowArchivedSheet] = useState(false);

  // Expandir reservas a filas de operación
  const operationRows = useMemo(() => {
    const rows: OperationRow[] = [];
    
    reservations.forEach(r => {
      // Si tiene tipo_actividad = Transfer, solo crear una fila
      if (r.tipo_actividad === 'Transfer') {
        rows.push({
          id: `${r.id}_transfer`,
          reservationId: r.id,
          reservation: r,
          tipoOperacion: 'Transfer',
          fechaHora: r.desde,
          lugar: r.lugar_entrega || r.lugar_devolucion,
          isCompleted: r.transfer_completado,
        });
      } else {
        // Fila de Entrega
        rows.push({
          id: `${r.id}_entrega`,
          reservationId: r.id,
          reservation: r,
          tipoOperacion: 'Entrega',
          fechaHora: r.desde,
          lugar: r.lugar_entrega,
          isCompleted: r.entrega_completada,
        });
        
        // Fila de Devolución
        rows.push({
          id: `${r.id}_devolucion`,
          reservationId: r.id,
          reservation: r,
          tipoOperacion: 'Devolución',
          fechaHora: r.hasta,
          lugar: r.lugar_devolucion,
          isCompleted: r.devolucion_completada,
        });
      }
    });
    
    return rows;
  }, [reservations]);

  // Helper para obtener valor de campo según operación (para filtros)
  const getRowFieldValue = (row: OperationRow, key: string): string | null => {
    const r = row.reservation;
    
    if (key === 'tipo_actividad') {
      return row.tipoOperacion;
    } else if (key === 'lugar') {
      return row.lugar;
    } else if (key === 'cliente') {
      return [r.cliente_nombre, r.cliente_apellido].filter(Boolean).join(' ') || null;
    }
    
    // Campos que deben ser específicos por operación
    const operationSpecificFields = ['estado', 'pagado', 'hosp', 'checkin', 'contacto', 'notas'];
    
    if (operationSpecificFields.includes(key)) {
      // Para Transfer, usar campos legacy
      if (row.tipoOperacion === 'Transfer') {
        return (r[key as keyof typeof r] as string) || null;
      }
      // Para Entrega y Devolución, usar campos específicos
      const suffix = row.tipoOperacion === 'Entrega' ? '_entrega' : '_devolucion';
      const specificField = `${key}${suffix}` as keyof typeof r;
       const specificValue = (r[specificField] as string) || null;
       
       // Para 'estado', si el campo específico está vacío, usar el principal
       // Esto asegura que si la reserva está Cancelada, todas las operaciones lo muestren
       if (key === 'estado' && !specificValue) {
         return (r.estado as string) || null;
       }
       
       return specificValue;
    }
    
    // Para otros campos, usar el valor directo
    return (r[key as keyof typeof r] as string) || null;
  };

  // Obtener valores únicos para filtros de selección
  const getUniqueValues = useMemo(() => {
    return (key: string): string[] => {
      const values = new Set<string>();
      operationRows.forEach(row => {
        const value = getRowFieldValue(row, key);
        if (value && value !== '—') {
          values.add(value);
        }
      });
      return Array.from(values).sort();
    };
  }, [operationRows]);

  const filteredAndSorted = useMemo(() => {
    let result = [...operationRows];

    // Filter cancelled reservations (hidden by default)
    if (!showCancelled) {
      result = result.filter(row => {
        const estado = getRowFieldValue(row, 'estado');
        return estado?.toLowerCase() !== 'cancelada';
      });
    }
    // Note: Old "terminadas" (>10 days) are now filtered at database level via archived_at

    // Date range filter
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      const toDate = dateRange.to ? startOfDay(dateRange.to) : fromDate;
      
      result = result.filter(row => {
        if (!row.fechaHora) return false;
        const rowDate = startOfDay(parseISO(row.fechaHora));
        
        // If only from date, filter for that single day
        if (!dateRange.to) {
          return isSameDay(rowDate, fromDate);
        }
        
        // If range, check if within interval
        return (isSameDay(rowDate, fromDate) || isAfter(rowDate, fromDate)) && 
               (isSameDay(rowDate, toDate) || isBefore(rowDate, toDate));
      });
    }

    // Search filter - note: email and telefono may be null for operational users
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(row => {
        const r = row.reservation;
        return (
          r.external_reservation_id?.toLowerCase().includes(searchLower) ||
          r.cliente_nombre?.toLowerCase().includes(searchLower) ||
          r.cliente_apellido?.toLowerCase().includes(searchLower) ||
          // Only search in PII fields if they exist (owner/admin only)
          (r.telefono && r.telefono.toLowerCase().includes(searchLower)) ||
          (r.email && r.email.toLowerCase().includes(searchLower)) ||
          r.auto?.toLowerCase().includes(searchLower) ||
          r.modelo?.toLowerCase().includes(searchLower) ||
          row.lugar?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Column filters
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      if (!filterValue) return;
      
      const filterLower = filterValue.toLowerCase();
      result = result.filter(row => {
        const cellValue = getRowFieldValue(row, key);
        if (!cellValue) return false;
        return cellValue.toLowerCase().includes(filterLower);
      });
    });

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      if (sortKey === 'fecha_hora') {
        aVal = a.fechaHora;
        bVal = b.fechaHora;
      } else if (sortKey === 'tipo_actividad') {
        aVal = a.tipoOperacion;
        bVal = b.tipoOperacion;
      } else if (sortKey === 'lugar') {
        aVal = a.lugar;
        bVal = b.lugar;
      } else {
        aVal = (a.reservation as unknown as Record<string, unknown>)[sortKey] as string | null;
        bVal = (b.reservation as unknown as Record<string, unknown>)[sortKey] as string | null;
      }
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }
      
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [operationRows, search, sortKey, sortDir, columnFilters, dateRange, showCancelled]);

  // Count cancelled reservations for info display
  const cancelledCount = useMemo(() => {
    return operationRows.filter(row => {
      const estado = getRowFieldValue(row, 'estado');
      return estado?.toLowerCase() === 'cancelada';
    }).length;
  }, [operationRows]);

  const activeFiltersCount = Object.values(columnFilters).filter(Boolean).length + (dateRange?.from ? 1 : 0);

  const clearAllFilters = () => {
    setUrlFilters(prev => {
      const reset: Record<string, any> = { ...prev, search: '', dateFrom: '', dateTo: '' };
      const cfKeys = ['tipo_actividad', 'estado', 'pagado', 'hosp', 'checkin', 'contacto', 'external_reservation_id', 'lugar', 'cliente', 'modelo', 'auto'];
      for (const k of cfKeys) reset[`cf_${k}`] = '';
      return reset as typeof prev;
    });
  };

  // Quick date range helpers
  const setQuickDateRange = (days: number) => {
    const today = new Date();
    setDateRange({
      from: today,
      to: addDays(today, days - 1)
    });
  };

  // Agrupar filas por día para cabeceras y colores alternados
  const rowsWithDayInfo = useMemo(() => {
    const dayColors = ['bg-background', 'bg-muted/30'];
    let currentDayIndex = 0;
    let lastDate: Date | null = null;

    return filteredAndSorted.map((row, idx) => {
      const rowDate = row.fechaHora ? parseISO(row.fechaHora) : null;
      let isFirstOfDay = false;
      let dayColor = dayColors[currentDayIndex % 2];

      if (rowDate && lastDate) {
        if (!isSameDay(rowDate, lastDate)) {
          currentDayIndex++;
          isFirstOfDay = true;
          dayColor = dayColors[currentDayIndex % 2];
        }
      } else if (rowDate && idx === 0) {
        isFirstOfDay = true;
      }

      if (rowDate) lastDate = rowDate;

      return {
        ...row,
        isFirstOfDay,
        dayColor,
        dayLabel: rowDate ? format(rowDate, "EEEE d 'de' MMMM", { locale: es }) : null,
      };
    });
  }, [filteredAndSorted]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleUpdate = (id: string, data: UpdateReservationData) => {
    updateReservation.mutate({ id, data });
  };

  // Función para actualizar fecha según tipo de operación
  const handleDateUpdate = (row: OperationRow, newValue: string | null) => {
    const field = row.tipoOperacion === 'Entrega' ? 'desde' : 'hasta';
    handleUpdate(row.reservationId, { [field]: newValue });
  };

  // Función para marcar operación como completada
  const handleToggleCompleted = (row: OperationRow, checked: boolean) => {
    const fieldMap: Record<TipoOperacion, keyof UpdateReservationData> = {
      'Entrega': 'entrega_completada',
      'Devolución': 'devolucion_completada',
      'Transfer': 'transfer_completado',
    };
    handleUpdate(row.reservationId, { [fieldMap[row.tipoOperacion]]: checked });
  };

  // Obtener el valor de un campo según el tipo de operación
  const getOperationFieldValue = (row: OperationRow, fieldKey: string): string | null => {
    const r = row.reservation;
    
    // Campos que son por reserva completa (no por operación)
    const reservationLevelFields = ['modelo', 'auto'];
    
    // Para lugar, es específico por operación
    if (fieldKey === 'lugar') {
      return row.lugar;
    }
    
    // Para modelo y auto, son campos de la reserva
    if (reservationLevelFields.includes(fieldKey)) {
      return (r[fieldKey as keyof typeof r] as string) || null;
    }
    
    // Para Transfer, usar los campos legacy
    if (row.tipoOperacion === 'Transfer') {
      return (r[fieldKey as keyof typeof r] as string) || null;
    }
    
    // Para Entrega y Devolución, usar campos específicos
    const suffix = row.tipoOperacion === 'Entrega' ? '_entrega' : '_devolucion';
    const specificField = `${fieldKey}${suffix}` as keyof typeof r;
    
     const specificValue = (r[specificField] as string) || null;
     
     // Para 'estado', fallback al campo principal
     if (fieldKey === 'estado' && !specificValue) {
       return (r.estado as string) || null;
     }
     
     return specificValue;
  };

  // Actualizar un campo según el tipo de operación
  const handleOperationFieldUpdate = (row: OperationRow, fieldKey: string, value: string | null) => {
    // Campos que son por reserva completa (no por operación)
    const reservationLevelFields = ['modelo', 'auto'];
    
    // Para lugar, es específico por operación
    if (fieldKey === 'lugar') {
      const lugarField = row.tipoOperacion === 'Entrega' ? 'lugar_entrega' : 'lugar_devolucion';
      handleUpdate(row.reservationId, { [lugarField]: value });
      return;
    }
    
    // Para modelo y auto, son campos de la reserva completa
    if (reservationLevelFields.includes(fieldKey)) {
      handleUpdate(row.reservationId, { [fieldKey]: value });
      return;
    }
    
    // Para Transfer, usar los campos legacy
    if (row.tipoOperacion === 'Transfer') {
      handleUpdate(row.reservationId, { [fieldKey]: value });
      return;
    }
    
    // Para Entrega y Devolución, usar campos específicos
    const suffix = row.tipoOperacion === 'Entrega' ? '_entrega' : '_devolucion';
    const specificField = `${fieldKey}${suffix}`;
    
    handleUpdate(row.reservationId, { [specificField]: value });
  };

  // Obtener ID de asignado según el tipo de operación
  const getOperationAssigneeId = (
    row: OperationRow, 
    assigneeType: 'rental' | 'escoba', 
    idType: 'user' | 'team'
  ): string | null => {
    const r = row.reservation;
    
    // Para Transfer, usar los campos legacy
    if (row.tipoOperacion === 'Transfer') {
      const legacyField = `asignado_${assigneeType}_${idType === 'user' ? 'id' : 'team_id'}` as keyof typeof r;
      return (r[legacyField] as string) || null;
    }
    
    // Para Entrega y Devolución, usar campos específicos
    const suffix = row.tipoOperacion === 'Entrega' ? '_entrega' : '_devolucion';
    const fieldSuffix = idType === 'user' ? '_id' : '_team_id';
    const specificField = `asignado_${assigneeType}${suffix}${fieldSuffix}` as keyof typeof r;
    
    return (r[specificField] as string) || null;
  };

  // Actualizar asignado según el tipo de operación
  const handleOperationAssigneeUpdate = (
    row: OperationRow, 
    assigneeType: 'rental' | 'escoba', 
    userId: string | null, 
    teamId: string | null
  ) => {
    // Para Transfer, usar los campos legacy
    if (row.tipoOperacion === 'Transfer') {
      handleUpdate(row.reservationId, {
        [`asignado_${assigneeType}_id`]: userId,
        [`asignado_${assigneeType}_team_id`]: teamId,
      });
      return;
    }
    
    // Para Entrega y Devolución, usar campos específicos
    const suffix = row.tipoOperacion === 'Entrega' ? '_entrega' : '_devolucion';
    handleUpdate(row.reservationId, {
      [`asignado_${assigneeType}${suffix}_id`]: userId,
      [`asignado_${assigneeType}${suffix}_team_id`]: teamId,
    });
  };

  const getClientName = (r: Reservation) => {
    const parts = [r.cliente_nombre, r.cliente_apellido].filter(Boolean);
    return parts.join(' ') || '—';
  };

  const getCellValue = (row: OperationRow, col: Column): string => {
    const r = row.reservation;
    
    switch (col.key) {
      case 'tipo_actividad':
        return row.tipoOperacion;
      case 'lugar':
        return row.lugar || '—';
      case 'cliente':
        return getClientName(r);
      case 'external_reservation_id':
      case 'modelo':
      case 'auto':
        return (r[col.key as keyof Reservation] as string) || '—';
      default:
        return (r[col.key as keyof Reservation] as string) || '—';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search and filter controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar reservas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <AddReservationDialog />
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-1"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        {(activeFiltersCount > 0 || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="gap-1 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
        <Badge variant="secondary" className="text-xs">
          {filteredAndSorted.length} operaciones ({reservations.length} reservas)
        </Badge>

        {/* Toggle para filtros de vista */}
        <div className="flex items-center gap-4 ml-auto border-l pl-4">
          {/* Botón Ver archivadas */}
          {isFullAccess && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchivedSheet(true)}
              className="gap-1 text-muted-foreground"
            >
              <Archive className="h-4 w-4" />
              Archivadas
              {archivedReservations.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs">
                  {archivedReservations.length}
                </Badge>
              )}
            </Button>
          )}

          {/* Toggle Mostrar canceladas */}
          <div className="flex items-center gap-2">
            <Switch 
              id="show-cancelled"
              checked={showCancelled}
              onCheckedChange={setShowCancelled}
            />
            <Label 
              htmlFor="show-cancelled" 
              className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
            >
              Canceladas
            </Label>
            {!showCancelled && cancelledCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {cancelledCount}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card flex-1 min-h-0 flex flex-col">
        <ScrollArea className="w-full flex-1">
          <div className="min-w-max">
            {/* Header */}
            <div className="flex border-b bg-muted sticky top-0 z-10">
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className={cn(
                    "flex items-center gap-1 px-2 py-2 text-xs font-medium text-muted-foreground",
                    col.width,
                    col.sticky && "sticky left-0 bg-muted z-20"
                  )}
                >
                  <button
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {col.label}
                    <ArrowUpDown className={cn(
                      "h-3 w-3",
                      sortKey === col.key && "text-primary"
                    )} />
                  </button>
                </div>
              ))}
            </div>

            {/* Filter row */}
            {showFilters && (
              <div className="flex border-b bg-muted sticky top-[33px] z-10">
                {COLUMNS.map((col) => (
                  <div
                    key={`filter-${col.key}`}
                    className={cn(
                      "px-1 py-1",
                      col.width,
                      col.sticky && "sticky left-0 bg-muted z-20"
                    )}
                  >
                    {/* Date range picker for fecha_hora */}
                    {col.key === 'fecha_hora' && col.filterable ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 w-full justify-start text-left text-xs font-normal",
                              !dateRange?.from && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                              ) : (
                                format(dateRange.from, "dd/MM/yyyy")
                              )
                            ) : "Fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 border-b flex gap-1 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6"
                              onClick={() => setDateRange({ from: new Date(), to: undefined })}
                            >
                              Hoy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6"
                              onClick={() => setQuickDateRange(3)}
                            >
                              3 días
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6"
                              onClick={() => setQuickDateRange(7)}
                            >
                              7 días
                            </Button>
                          </div>
                          <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={setDateRange}
                            locale={es}
                            numberOfMonths={1}
                            className="pointer-events-auto"
                          />
                          {dateRange?.from && (
                            <div className="p-2 border-t">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => setDateRange(undefined)}
                              >
                                <X className="mr-1 h-3 w-3" />
                                Limpiar fecha
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : col.filterable && (col.type === 'chip' || col.key === 'tipo_actividad') ? (
                      <Select
                        value={columnFilters[col.key] || ''}
                        onValueChange={(value) => 
                          setColumnFilters(prev => ({
                            ...prev,
                            [col.key]: value === '__all__' ? '' : value
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos</SelectItem>
                          {getUniqueValues(col.key).map((val) => (
                            <SelectItem key={val} value={val}>
                              {val}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col.filterable ? (
                      <Input
                        placeholder="Filtrar..."
                        value={columnFilters[col.key] || ''}
                        onChange={(e) =>
                          setColumnFilters(prev => ({
                            ...prev,
                            [col.key]: e.target.value
                          }))
                        }
                        className="h-7 text-xs"
                      />
                    ) : (
                      <div className="h-7" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Rows */}
            <div>
              {rowsWithDayInfo.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  {search ? 'Sin resultados' : 'Sin reservas. Importa un Excel para comenzar.'}
                </div>
              ) : (
                rowsWithDayInfo.map((row) => (
                  <>
                    {/* Day header */}
                    {row.isFirstOfDay && row.dayLabel && (
                      <div 
                        key={`day-${row.id}`}
                        className="flex items-center px-3 py-2 bg-primary/10 border-t-2 border-primary/30"
                      >
                        <span className="text-xs font-semibold text-primary capitalize">
                          {row.dayLabel}
                        </span>
                      </div>
                    )}
                    {/* Data row */}
                    <div
                      key={row.id}
                      className={cn(
                        "flex hover:bg-muted/50 transition-colors border-b border-border/50",
                        row.dayColor,
                        row.tipoOperacion === 'Entrega' && "border-l-2 border-l-green-500",
                        row.tipoOperacion === 'Devolución' && "border-l-2 border-l-orange-500",
                        row.tipoOperacion === 'Transfer' && "border-l-2 border-l-blue-500",
                        // Fondo verde si está completada
                        row.isCompleted && "bg-green-50 dark:bg-green-950/20",
                        // Estilo visual para canceladas
                        getRowFieldValue(row, 'estado')?.toLowerCase() === 'cancelada' && 
                          "opacity-60 bg-destructive/10 dark:bg-destructive/5"
                      )}
                    >
                      {COLUMNS.map((col) => (
                        <div
                          key={col.key}
                          className={cn(
                            "flex items-center px-1 py-1 overflow-hidden",
                            col.width,
                            col.sticky && "sticky left-0 z-10",
                            col.sticky && row.dayColor
                          )}
                        >
                          {col.type === 'checkbox' && (
                            <Checkbox
                              checked={row.isCompleted}
                              onCheckedChange={(checked) => handleToggleCompleted(row, checked as boolean)}
                              className="mx-auto"
                            />
                          )}
                          {col.type === 'readonly' && (
                            <span className={cn(
                              "text-xs px-1 truncate",
                              row.isCompleted && "line-through text-muted-foreground"
                            )}>
                              {getCellValue(row, col)}
                            </span>
                          )}
                          {col.type === 'datetime' && col.key === 'fecha_hora' && (
                            <div className={cn(
                              row.isCompleted && "line-through text-muted-foreground"
                            )}>
                              <EditableDateTimeCell
                                value={row.fechaHora}
                                onChange={(newValue) => handleDateUpdate(row, newValue)}
                              />
                            </div>
                          )}
                          {col.type === 'chip' && col.fieldName && (
                            col.key === 'tipo_actividad' ? (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  row.tipoOperacion === 'Entrega' && "border-green-500 text-green-600 bg-green-500/10",
                                  row.tipoOperacion === 'Devolución' && "border-orange-500 text-orange-600 bg-orange-500/10",
                                  row.tipoOperacion === 'Transfer' && "border-blue-500 text-blue-600 bg-blue-500/10",
                                  row.isCompleted && "line-through opacity-60"
                                )}
                              >
                                {row.tipoOperacion}
                              </Badge>
                            ) : (
                              <ChipSelect
                                fieldName={col.fieldName as 'estado' | 'tipo_actividad' | 'pagado' | 'hosp' | 'checkin' | 'contacto'}
                                value={getOperationFieldValue(row, col.key)}
                                onChange={(value) => handleOperationFieldUpdate(row, col.key, value)}
                              />
                            )
                          )}
                          {col.type === 'text' && (
                            <div className={cn(
                              row.isCompleted && "line-through text-muted-foreground"
                            )}>
                              <EditableCell
                                value={getOperationFieldValue(row, col.key)}
                                onChange={(value) => handleOperationFieldUpdate(row, col.key, value)}
                              />
                            </div>
                          )}
                          {col.type === 'assignee' && col.key === 'asignado_rental' && (
                            <AssigneeSelect
                              userId={getOperationAssigneeId(row, 'rental', 'user')}
                              teamId={getOperationAssigneeId(row, 'rental', 'team')}
                              onChange={(userId, teamId) => handleOperationAssigneeUpdate(row, 'rental', userId, teamId)}
                            />
                          )}
                          {col.type === 'assignee' && col.key === 'asignado_escoba' && (
                            <AssigneeSelect
                              userId={getOperationAssigneeId(row, 'escoba', 'user')}
                              teamId={getOperationAssigneeId(row, 'escoba', 'team')}
                              onChange={(userId, teamId) => handleOperationAssigneeUpdate(row, 'escoba', userId, teamId)}
                            />
                          )}
                          {col.type === 'actions' && isFullAccess && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => archiveReservation.mutate(row.reservationId)}
                              disabled={archiveReservation.isPending}
                              title="Archivar reserva"
                            >
                              <ArchiveX className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ))
              )}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Archived Reservations Sheet */}
      <ArchivedReservationsSheet
        open={showArchivedSheet}
        onOpenChange={setShowArchivedSheet}
        reservations={archivedReservations}
        onRestore={(id) => restoreReservation.mutate(id)}
        isRestoring={restoreReservation.isPending}
        archiveDays={reservationsArchiveDays}
      />
    </div>
  );
}
