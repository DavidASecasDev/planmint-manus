import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, Filter, CalendarIcon, Archive, ArchiveX, Eye, AlertTriangle, LayoutGrid, Baby, Navigation, MapPinCheck, Play, Radio, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTransition } from '@/components/ui/skeleton-transition';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Reservation, UpdateReservationData, RentlyExtra } from '@/types/reservations';
import { ChipSelect } from './ChipSelect';
import { AssigneeSelect } from './AssigneeSelect';
import { EditableCell } from './EditableCell';
import { AddressAutocompleteCell } from './AddressAutocompleteCell';
import { apiInvoke } from '@/lib/apiClient';
import { EditableDateTimeCell } from './EditableDateTimeCell';
import { AddReservationDialog } from './AddReservationDialog';
import { ArchivedReservationsSheet } from './ArchivedReservationsSheet';
import { DailyTimeSlotSummary } from './DailyTimeSlotSummary';
import { StaffCapacityAlert } from '@/components/StaffCapacityAlert';
import { PunctualitySummary } from './PunctualitySummary';
import { useStaffCapacity } from '@/hooks/useStaffCapacity';
import { ReservationDetailSheet } from './ReservationDetailSheet';
import { useReservations } from '@/hooks/useReservations';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Column {
  key: string;
  label: string;
  width: string;
  sticky?: boolean;
  type: 'text' | 'date' | 'datetime' | 'chip' | 'assignee' | 'number' | 'readonly' | 'checkbox' | 'actions' | 'detail';
  fieldName?: string;
  filterable?: boolean;
}

// Orden exacto del Excel
const COLUMNS: Column[] = [
  { key: 'completado', label: '✓', width: 'w-10', type: 'checkbox', filterable: false },
  { key: 'fecha_hora', label: 'Fecha/Hora', width: 'w-36', sticky: false, type: 'datetime', filterable: true },
  { key: 'hora_confirmada', label: 'Hora Confirmada', width: 'w-36', sticky: false, type: 'datetime', filterable: true },
  { key: 'detail', label: '', width: 'w-8', type: 'detail', filterable: false },
  { key: 'tipo_actividad', label: 'Tipo Actividad', width: 'w-24', type: 'chip', fieldName: 'tipo_actividad', filterable: true },
  { key: 'external_reservation_id', label: 'Reserva', width: 'w-20', type: 'readonly', filterable: true },
  { key: 'lugar', label: 'Lugar', width: 'w-56', type: 'text', filterable: true },
  { key: 'direccion', label: 'Dirección', width: 'w-64', type: 'text', filterable: true },
  { key: 'acciones_ruta', label: '', width: 'w-20', type: 'actions', filterable: false },
  { key: 'tiempo_desplazamiento', label: 'Trayecto', width: 'w-24', type: 'readonly', filterable: false },
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
  confirmedDatetime: string | null;
  lugar: string | null;
  direccion: string | null;
  isCompleted: boolean;
  /** Travel time in minutes (one-way) from capacity calculation, null if not yet loaded */
  travelMinutes: number | null;
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
  const { profile } = useAuth();
  const { reservationsArchiveDays } = useIntegrationFlags();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [urlFilters, setUrlFilters] = usePersistedFilters({
    search: '',
    sortKey: 'hora_confirmada',
    sortDir: 'asc' as string,
    showCancelled: false,
    dateFrom: todayStr,
    dateTo: '',
    cf_tipo_actividad: '',
    cf_estado: '',
    cf_pagado: '',
    cf_hosp: '',
    cf_checkin: '',
    cf_contacto: '',
    cf_external_reservation_id: '',
    cf_lugar: '',
    cf_direccion: '',
    cf_cliente: '',
    cf_modelo: '',
    cf_auto: '',
    confirmedDateFrom: '',
    confirmedDateTo: '',
  });
  const search = urlFilters.search;
  const setSearch = (v: string) => setUrlFilters(prev => ({ ...prev, search: v }));
  const sortKey = urlFilters.sortKey;
  const setSortKey = (v: string) => setUrlFilters(prev => ({ ...prev, sortKey: v }));
  const sortDir = urlFilters.sortDir as 'asc' | 'desc';
  const setSortDir = (v: 'asc' | 'desc') => setUrlFilters(prev => ({ ...prev, sortDir: v }));
  const showCancelled = urlFilters.showCancelled;
  const setShowCancelled = (v: boolean) => setUrlFilters(prev => ({ ...prev, showCancelled: v }));

  // Staff capacity data for enriching rows with travel time
  const { data: capacityData } = useStaffCapacity(urlFilters.dateFrom || null);

  // Build a lookup map: reservationId+type -> travelMinutesOneWay
  const travelTimeLookup = useMemo(() => {
    const map = new Map<string, number>();
    if (!capacityData?.hourSlots) return map;
    for (const slot of capacityData.hourSlots) {
      for (const op of slot.operations) {
        const key = `${op.reservationId}_${op.type}`;
        if (!map.has(key)) {
          map.set(key, op.travelMinutesOneWay);
        }
      }
    }
    return map;
  }, [capacityData]);

  // Derive columnFilters from URL params (cf_ prefix)
  const columnFilters = useMemo<ColumnFilters>(() => {
    const cf: ColumnFilters = {};
    const cfKeys = ['tipo_actividad', 'estado', 'pagado', 'hosp', 'checkin', 'contacto', 'external_reservation_id', 'lugar', 'direccion', 'cliente', 'modelo', 'auto'] as const;
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
      const cfKeys = ['tipo_actividad', 'estado', 'pagado', 'hosp', 'checkin', 'contacto', 'external_reservation_id', 'lugar', 'direccion', 'cliente', 'modelo', 'auto'];
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

  // Derive confirmedDateRange from URL params
  const confirmedDateRange = useMemo<DateRange | undefined>(() => {
    if (!urlFilters.confirmedDateFrom) return undefined;
    return {
      from: parseISO(urlFilters.confirmedDateFrom),
      to: urlFilters.confirmedDateTo ? parseISO(urlFilters.confirmedDateTo) : undefined,
    };
  }, [urlFilters.confirmedDateFrom, urlFilters.confirmedDateTo]);

  const setConfirmedDateRange = (range: DateRange | undefined) => {
    setUrlFilters(prev => ({
      ...prev,
      confirmedDateFrom: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      confirmedDateTo: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    }));
  };

  const setQuickConfirmedDateRange = (days: number) => {
    const today = new Date();
    setConfirmedDateRange({
      from: today,
      to: addDays(today, days - 1)
    });
  };

  const [showFilters, setShowFilters] = useState(true);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [showArchivedSheet, setShowArchivedSheet] = useState(false);
  const [detailReservation, setDetailReservation] = useState<Reservation | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  // Track "Llegüé" state per operation (rowId -> { realMinutes, loading })
  const [llegoState, setLlegoState] = useState<Record<string, { realMinutes: number; estimatedMinutes: number | null }>>({});
  const [llegoLoading, setLlegoLoading] = useState<Record<string, boolean>>({});
  const [iniciarLoading, setIniciarLoading] = useState<Record<string, boolean>>({});
  // Track who started/arrived for each operation
  const [arrivalUsers, setArrivalUsers] = useState<Record<string, { startedBy: string | null; arrivedBy: string | null }>>({});

  // Location sharing state
  const [locationDialog, setLocationDialog] = useState<{ open: boolean; row: OperationRow | null }>({ open: false, row: null });
  const [sharingLocation, setSharingLocation] = useState<Record<string, boolean>>({});
  const locationWatchIds = useRef<Record<string, number>>({});

  // (arrival status loading moved below operationRows declaration)

  // Start sharing GPS location for an operation
  const startLocationSharing = useCallback((row: OperationRow) => {
    const rowId = row.id;
    const opType = row.tipoOperacion === 'Entrega' ? 'entrega' : 'devolucion';

    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        apiInvoke('en-camino-tracking/location', {
          body: {
            reservation_id: row.reservationId,
            operation_type: opType,
            lat: latitude,
            lng: longitude,
          },
        }).catch(err => console.warn('[location] Error sending:', err));
      },
      (error) => {
        console.warn('[location] Geolocation error:', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Permiso de ubicación denegado');
          stopLocationSharing(rowId, row.reservationId, opType);
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    locationWatchIds.current[rowId] = watchId;
    setSharingLocation(prev => ({ ...prev, [rowId]: true }));
    toast.success('Compartiendo ubicación en tiempo real');
  }, []);

  // Stop sharing GPS location
  const stopLocationSharing = useCallback((rowId: string, reservationId: string, opType: string) => {
    const watchId = locationWatchIds.current[rowId];
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      delete locationWatchIds.current[rowId];
    }
    setSharingLocation(prev => ({ ...prev, [rowId]: false }));
    apiInvoke('en-camino-tracking/location-stop', {
      body: { reservation_id: reservationId, operation_type: opType },
    }).catch(err => console.warn('[location-stop] Error:', err));
  }, []);

  // Cleanup all watchers on unmount
  useEffect(() => {
    return () => {
      Object.values(locationWatchIds.current).forEach(id => navigator.geolocation.clearWatch(id));
    };
  }, []);

  const handleIniciar = useCallback(async (row: OperationRow) => {
    const rowId = row.id;
    setIniciarLoading(prev => ({ ...prev, [rowId]: true }));
    try {
      // Mark operation as 'En camino'
      handleOperationFieldUpdate(row, 'estado', 'En camino');
      // Record timestamp in en_camino_tracking table
      const opType = row.tipoOperacion === 'Entrega' ? 'entrega' : 'devolucion';
      await apiInvoke('en-camino-tracking', {
        body: {
          reservation_id: row.reservationId,
          operation_type: opType,
          destination_address: getOperationFieldValue(row, 'direccion') || getOperationFieldValue(row, 'lugar') || '',
          assigned_user_name: profile?.name || getOperationFieldValue(row, 'asignado_rental') || '',
          estimated_minutes: row.travelMinutes ?? null,
        },
      });
      toast.success('Operación marcada como En camino');
      // Show location sharing dialog
      setLocationDialog({ open: true, row });
    } catch (err) {
      console.error('[iniciar] Error:', err);
      toast.error('Error al iniciar trayecto');
    } finally {
      setIniciarLoading(prev => ({ ...prev, [rowId]: false }));
    }
  }, []);

  const handleLlego = useCallback(async (row: OperationRow) => {
    const rowId = row.id;
    setLlegoLoading(prev => ({ ...prev, [rowId]: true }));
    try {
      const opType = row.tipoOperacion === 'Entrega' ? 'entrega' : 'devolucion';
      // Stop location sharing if active
      if (locationWatchIds.current[rowId] != null) {
        stopLocationSharing(rowId, row.reservationId, opType);
      }
      const resp = await apiInvoke<{ ok: boolean; real_minutes: number; estimated_minutes: number | null }>('en-camino-tracking/llego', {
        body: {
          reservation_id: row.reservationId,
          operation_type: opType,
          estimated_minutes: row.travelMinutes,
          llego_user_name: profile?.name || '',
        },
      });
      if (resp.data?.ok) {
        setLlegoState(prev => ({
          ...prev,
          [rowId]: { realMinutes: resp.data!.real_minutes, estimatedMinutes: resp.data!.estimated_minutes },
        }));
        // Update the reservation estado to 'Completada' so it persists across refreshes
        const estadoField = row.tipoOperacion === 'Entrega' ? 'estado_entrega' : 'estado_devolucion';
        handleUpdate(row.reservationId, { [estadoField]: 'Completada' } as any);
        const real = resp.data.real_minutes;
        const est = resp.data.estimated_minutes;
        const comparison = est != null ? ` (estimado: ${est} min)` : '';
        toast.success(`Llegada registrada: ${real} min${comparison}`);
      } else {
        toast.error('Error al registrar llegada');
      }
    } catch (err) {
      console.error('[llego] Error:', err);
      toast.error('Error al registrar llegada');
    } finally {
      setLlegoLoading(prev => ({ ...prev, [rowId]: false }));
    }
  }, [stopLocationSharing]);

  // Ref for the scroll container to enable arrow key navigation
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Arrow key scroll navigation — scrolls the table viewport when
  // no input/select/textarea is focused (so editable cells still work normally)
  const SCROLL_STEP_Y = 60; // px per arrow press (roughly one row height)
  const SCROLL_STEP_X = 120; // px per arrow press (roughly one column width)

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Don't intercept if user is typing in an input, textarea, select, or contenteditable
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.target as HTMLElement).isContentEditable) return;

    // Find the Radix ScrollArea viewport (the actual scrollable element)
    const container = scrollContainerRef.current;
    if (!container) return;
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;

    let handled = false;
    switch (e.key) {
      case 'ArrowDown':
        viewport.scrollBy({ top: SCROLL_STEP_Y, behavior: 'smooth' });
        handled = true;
        break;
      case 'ArrowUp':
        viewport.scrollBy({ top: -SCROLL_STEP_Y, behavior: 'smooth' });
        handled = true;
        break;
      case 'ArrowRight':
        viewport.scrollBy({ left: SCROLL_STEP_X, behavior: 'smooth' });
        handled = true;
        break;
      case 'ArrowLeft':
        viewport.scrollBy({ left: -SCROLL_STEP_X, behavior: 'smooth' });
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
    }
  }, []);

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
          confirmedDatetime: r.confirmed_entrega_datetime,
          lugar: r.lugar_entrega || r.lugar_devolucion,
          direccion: r.lugar_entrega_direccion || r.lugar_devolucion_direccion || null,
          isCompleted: r.transfer_completado,
          travelMinutes: null,
        });
      } else {
        // Fila de Entrega
        rows.push({
          id: `${r.id}_entrega`,
          reservationId: r.id,
          reservation: r,
          tipoOperacion: 'Entrega',
          fechaHora: r.desde,
          confirmedDatetime: r.confirmed_entrega_datetime,
          lugar: r.lugar_entrega,
          direccion: r.lugar_entrega_direccion || null,
          isCompleted: r.entrega_completada,
          travelMinutes: null,
        });
        
        // Fila de Devolución
        rows.push({
          id: `${r.id}_devolucion`,
          reservationId: r.id,
          reservation: r,
          tipoOperacion: 'Devolución',
          fechaHora: r.hasta,
          confirmedDatetime: r.confirmed_devolucion_datetime,
          lugar: r.lugar_devolucion,
          direccion: r.lugar_devolucion_direccion || null,
          isCompleted: r.devolucion_completada,
          travelMinutes: null,
        });
      }
    });
    
    return rows;
  }, [reservations]);

  // Enrich operation rows with travel time from capacity data
  const enrichedOperationRows = useMemo(() => {
    if (travelTimeLookup.size === 0) return operationRows;
    return operationRows.map(row => {
      const typeKey = row.tipoOperacion === 'Devolución' ? 'Devolución' : row.tipoOperacion;
      const lookupKey = `${row.reservationId}_${typeKey}`;
      const travel = travelTimeLookup.get(lookupKey);
      if (travel !== undefined && travel !== row.travelMinutes) {
        return { ...row, travelMinutes: travel };
      }
      return row;
    });
  }, [operationRows, travelTimeLookup]);

  // Load persisted arrival status from DB on mount / when rows change
  useEffect(() => {
    if (operationRows.length === 0) return;
    const reservationIds = Array.from(new Set(operationRows.map(r => r.reservationId)));
    if (reservationIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const resp = await apiInvoke<{
          ok: boolean;
          statuses: Record<string, {
            en_camino_at: string;
            llego_at: string | null;
            real_minutes: number | null;
            estimated_minutes: number | null;
            started_by: string | null;
            arrived_by: string | null;
          }>;
        }>('en-camino-tracking/status', {
          body: { reservation_ids: reservationIds },
        });
        if (cancelled || !resp.data?.ok) return;
        const newState: Record<string, { realMinutes: number; estimatedMinutes: number | null }> = {};
        const newArrivalUsers: Record<string, { startedBy: string | null; arrivedBy: string | null }> = {};
        for (const row of operationRows) {
          const opType = row.tipoOperacion === 'Entrega' ? 'entrega' : row.tipoOperacion === 'Devoluci\u00f3n' ? 'devolucion' : null;
          if (!opType) continue;
          const key = `${row.reservationId}:${opType}`;
          const status = resp.data.statuses[key];
          if (status) {
            if (status.llego_at && status.real_minutes != null) {
              newState[row.id] = {
                realMinutes: status.real_minutes,
                estimatedMinutes: status.estimated_minutes,
              };
            }
            if (status.started_by || status.arrived_by) {
              newArrivalUsers[row.id] = {
                startedBy: status.started_by,
                arrivedBy: status.arrived_by,
              };
            }
          }
        }
        if (Object.keys(newState).length > 0) {
          setLlegoState(prev => ({ ...prev, ...newState }));
        }
        if (Object.keys(newArrivalUsers).length > 0) {
          setArrivalUsers(prev => ({ ...prev, ...newArrivalUsers }));
        }
      } catch (err) {
        console.error('[en-camino-status] Error loading arrival status:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [operationRows]);

  // Helper para obtener valor de campo según operación (para filtros)
  const getRowFieldValue = (row: OperationRow, key: string): string | null => {
    const r = row.reservation;
    
    if (key === 'tipo_actividad') {
      return row.tipoOperacion;
    } else if (key === 'lugar') {
      return row.lugar;
    } else if (key === 'direccion') {
      return row.direccion;
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
      enrichedOperationRows.forEach(row => {
        const value = getRowFieldValue(row, key);
        if (value && value !== '—') {
          values.add(value);
        }
      });
      return Array.from(values).sort();
    };
  }, [enrichedOperationRows]);

  const filteredAndSorted = useMemo(() => {
    let result = [...enrichedOperationRows];

    // Filter cancelled reservations (hidden by default)
    if (!showCancelled) {
      result = result.filter(row => {
        const estado = getRowFieldValue(row, 'estado');
        return estado?.toLowerCase() !== 'cancelada';
      });
    }
    // Note: Old "terminadas" (>10 days) are now filtered at database level via archived_at

    // Helper: extract YYYY-MM-DD from an ISO string without timezone conversion.
    // The stored datetimes use +00:00 offset but represent local operational times
    // (Mallorca). Using parseISO converts to the browser's local timezone, which
    // causes late-night operations (e.g., 22:00 stored as UTC) to shift to the
    // next calendar day in UTC+2 timezones.
    const extractDateKey = (isoStr: string): string | null => {
      const m = isoStr.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    };

    const dateToKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Date range filter
    if (dateRange?.from) {
      const fromKey = dateToKey(dateRange.from);
      const toKey = dateRange.to ? dateToKey(dateRange.to) : fromKey;
      
      result = result.filter(row => {
        if (!row.fechaHora) return false;
        const rowKey = extractDateKey(row.fechaHora);
        if (!rowKey) return false;
        
        // If only from date, filter for that single day
        if (!dateRange.to) {
          return rowKey === fromKey;
        }
        
        // If range, check if within interval (string comparison works for YYYY-MM-DD)
        return rowKey >= fromKey && rowKey <= toKey;
      });
    }

    // Confirmed date range filter
    if (confirmedDateRange?.from) {
      const fromKey = dateToKey(confirmedDateRange.from);
      const toKey = confirmedDateRange.to ? dateToKey(confirmedDateRange.to) : fromKey;
      
      result = result.filter(row => {
        if (!row.confirmedDatetime) return false;
        const rowKey = extractDateKey(row.confirmedDatetime);
        if (!rowKey) return false;
        
        if (!confirmedDateRange.to) {
          return rowKey === fromKey;
        }
        
        return rowKey >= fromKey && rowKey <= toKey;
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
          row.lugar?.toLowerCase().includes(searchLower) ||
          row.direccion?.toLowerCase().includes(searchLower)
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

    // Helper to parse datetime string to timestamp for robust comparison
    const toTimestamp = (s: string | null): number | null => {
      if (!s) return null;
      // Handle both 'T' and space separators in ISO strings
      let normalized = s.replace(' ', 'T');
      // Ensure timezone offset has colon: +00 -> +00:00, -05 -> -05:00
      normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
      const t = new Date(normalized).getTime();
      return isNaN(t) ? null : t;
    };

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      if (sortKey === 'fecha_hora' || sortKey === 'hora_confirmada') {
        // Use numeric timestamp comparison for datetime columns
        const aRaw = sortKey === 'fecha_hora' ? a.fechaHora : a.confirmedDatetime;
        const bRaw = sortKey === 'fecha_hora' ? b.fechaHora : b.confirmedDatetime;
        const aTs = toTimestamp(aRaw);
        const bTs = toTimestamp(bRaw);
        
        if (aTs === null && bTs === null) return 0;
        if (aTs === null) return 1;
        if (bTs === null) return -1;
        
        comparison = aTs - bTs;
        
        // Secondary sort: if primary datetime is equal, sort by the other datetime
        if (comparison === 0) {
          const aSecondary = toTimestamp(sortKey === 'fecha_hora' ? a.confirmedDatetime : a.fechaHora);
          const bSecondary = toTimestamp(sortKey === 'fecha_hora' ? b.confirmedDatetime : b.fechaHora);
          if (aSecondary !== null && bSecondary !== null) {
            comparison = aSecondary - bSecondary;
          }
        }
      } else {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;

        if (sortKey === 'tipo_actividad') {
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
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        }
      }
      
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [enrichedOperationRows, search, sortKey, sortDir, columnFilters, dateRange, confirmedDateRange, showCancelled]);

  // Count cancelled reservations for info display
  const cancelledCount = useMemo(() => {
    return enrichedOperationRows.filter(row => {
      const estado = getRowFieldValue(row, 'estado');
      return estado?.toLowerCase() === 'cancelada';
    }).length;
  }, [enrichedOperationRows]);

  const activeFiltersCount = Object.values(columnFilters).filter(Boolean).length + (dateRange?.from ? 1 : 0) + (confirmedDateRange?.from ? 1 : 0);

  const clearAllFilters = () => {
    setUrlFilters(prev => {
      const reset: Record<string, any> = { ...prev, search: '', dateFrom: '', dateTo: '', confirmedDateFrom: '', confirmedDateTo: '' };
      const cfKeys = ['tipo_actividad', 'estado', 'pagado', 'hosp', 'checkin', 'contacto', 'external_reservation_id', 'lugar', 'direccion', 'cliente', 'modelo', 'auto'];
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
    let lastDayKey: string | null = null;
    // Usar confirmedDatetime para agrupar cuando se ordena por hora_confirmada
    const useConfirmedForGrouping = sortKey === 'hora_confirmada';

    // Extract the date part (YYYY-MM-DD) directly from the ISO string
    // to avoid timezone conversion issues. The stored times use +00:00 offset
    // but represent local operational times (Mallorca). Using parseISO + isSameDay
    // would convert to the browser's local timezone, causing late-night operations
    // (e.g., 22:00 UTC) to appear under the next day in UTC+2 timezones.
    const extractDatePart = (dateStr: string): string | null => {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? match[0] : null;
    };

    // Create a Date from just the date part (noon to avoid DST edge cases)
    // for formatting the day label with the correct day name
    const dateLabelFromKey = (dayKey: string): string => {
      const [year, month, day] = dayKey.split('-').map(Number);
      const d = new Date(year, month - 1, day, 12, 0, 0);
      return format(d, "EEEE d 'de' MMMM", { locale: es });
    };

    return filteredAndSorted.map((row, idx) => {
      const dateStr = useConfirmedForGrouping ? (row.confirmedDatetime || row.fechaHora) : row.fechaHora;
      const dayKey = dateStr ? extractDatePart(dateStr) : null;
      let isFirstOfDay = false;
      let dayColor = dayColors[currentDayIndex % 2];

      if (dayKey && lastDayKey) {
        if (dayKey !== lastDayKey) {
          currentDayIndex++;
          isFirstOfDay = true;
          dayColor = dayColors[currentDayIndex % 2];
        }
      } else if (dayKey && idx === 0) {
        isFirstOfDay = true;
      }

      if (dayKey) lastDayKey = dayKey;

      return {
        ...row,
        isFirstOfDay,
        dayColor,
        dayLabel: dayKey ? dateLabelFromKey(dayKey) : null,
      };
    });
  }, [filteredAndSorted, sortKey]);

  const handleSort = (key: string) => {
    // IMPORTANT: Must update sortKey and sortDir in a SINGLE setUrlFilters call.
    // Calling setSortKey and setSortDir separately causes a race condition where
    // the second call reads stale URL params and overwrites the first change.
    if (sortKey === key) {
      setUrlFilters(prev => ({ ...prev, sortDir: sortDir === 'asc' ? 'desc' : 'asc' }));
    } else {
      setUrlFilters(prev => ({ ...prev, sortKey: key, sortDir: 'asc' }));
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

  // Función para actualizar la hora confirmada
  const handleConfirmedDateUpdate = (row: OperationRow, newValue: string | null) => {
    const field = row.tipoOperacion === 'Devolución' ? 'confirmed_devolucion_datetime' : 'confirmed_entrega_datetime';
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
    
    // Para direccion, es específico por operación
    if (fieldKey === 'direccion') {
      return row.direccion;
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
      const oldLugar = row.lugar;
      handleUpdate(row.reservationId, { [lugarField]: value });
      // Invalidate travel time cache for old and new lugar, then refresh capacity
      setTimeout(async () => {
        await apiInvoke('travel-time-cache/invalidate', {
          body: { oldDestination: oldLugar || undefined, newDestination: value || undefined },
        });
        window.dispatchEvent(new Event('capacity-refresh-needed'));
      }, 1500);
      return;
    }
    
    // Para direccion, es específico por operación
    if (fieldKey === 'direccion') {
      const dirField = row.tipoOperacion === 'Entrega' ? 'lugar_entrega_direccion' : 'lugar_devolucion_direccion';
      const oldDireccion = row.direccion;
      handleUpdate(row.reservationId, { [dirField]: value });
      // Invalidate travel time cache for old and new address, then refresh capacity
      setTimeout(async () => {
        await apiInvoke('travel-time-cache/invalidate', {
          body: { oldDestination: oldDireccion || undefined, newDestination: value || undefined },
        });
        window.dispatchEvent(new Event('capacity-refresh-needed'));
      }, 1500);
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

  // Detect baby/child seat extras in a reservation
  const BABY_SEAT_KEYWORDS = ['silla', 'sillita', 'baby', 'child', 'booster', 'infant', 'bebé', 'bebe', 'infante', 'elevador', 'recién nacido', 'recien nacido', 'newborn', 'niño', 'nino'];
  const getBabySeats = (r: Reservation): RentlyExtra[] => {
    let extras: RentlyExtra[] = [];
    try {
      const raw = r.extras_contratados;
      if (!raw) return [];
      extras = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
    } catch { return []; }
    return extras.filter(e => {
      const name = (e.nombre || e.name || '').toLowerCase();
      return BABY_SEAT_KEYWORDS.some(kw => name.includes(kw));
    });
  };

  const getCellValue = (row: OperationRow, col: Column): string => {
    const r = row.reservation;
    
    switch (col.key) {
      case 'tipo_actividad':
        return row.tipoOperacion;
      case 'hora_confirmada':
        return row.confirmedDatetime || '—';
      case 'lugar':
        return row.lugar || '—';
      case 'direccion':
        return row.direccion || '—';
      case 'tiempo_desplazamiento':
        if (row.travelMinutes === null) return '—';
        if (row.travelMinutes === 0) return 'Base';
        return `${row.travelMinutes} min`;
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

  const reservationsTableSkeleton = (
    <div className="flex flex-col h-full gap-4">
      {/* Search bar skeleton */}
      <div className="flex items-center gap-2 flex-wrap">
        <Skeleton className="h-9 flex-1 max-w-sm rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border/50">
          <Skeleton className="h-4 w-4 rounded" />
          {[80, 60, 100, 130, 100, 80, 80, 60, 50, 50, 50, 200].map((w, i) => (
            <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${w}px` }} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 12 }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex items-center gap-2 px-3 py-3 border-b border-border/30 last:border-b-0"
            style={{ opacity: 1 - rowIdx * 0.06 }}
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-14 rounded" />
            <Skeleton className="h-3.5 flex-1 max-w-[120px] rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3.5 w-16 rounded" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded" />
            <Skeleton className="h-6 w-20 rounded" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <SkeletonTransition isLoading={isLoading} skeleton={reservationsTableSkeleton}>
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

          {/* Toggle Vista Franjas Horarias */}
          <div className="flex items-center gap-2">
            <Switch
              id="show-time-slots"
              checked={showTimeSlots}
              onCheckedChange={setShowTimeSlots}
            />
            <Label
              htmlFor="show-time-slots"
              className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Franjas
            </Label>
          </div>

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

      {/* Staff Capacity Alert */}
      <StaffCapacityAlert date={urlFilters.dateFrom || null} />

      {/* Daily Punctuality Summary */}
      <PunctualitySummary date={urlFilters.dateFrom || null} />

      {/* Time Slot Summary View */}
      {showTimeSlots ? (
        <div className="border rounded-lg overflow-hidden bg-card flex-1 min-h-0 overflow-y-auto p-4">
          <DailyTimeSlotSummary operations={filteredAndSorted} />
        </div>
      ) : (
      /* Table */
      <div
        ref={scrollContainerRef}
        className="border rounded-lg overflow-hidden bg-card flex-1 min-h-0 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1"
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
        role="grid"
        aria-label="Tabla de reservas — usa las flechas del teclado para desplazarte"
      >
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
                    className={cn(
                      "flex items-center gap-1 hover:text-foreground transition-colors",
                      sortKey === col.key && "text-primary font-semibold"
                    )}
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-primary" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
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
                    ) : col.key === 'hora_confirmada' && col.filterable ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 w-full justify-start text-left text-xs font-normal",
                              !confirmedDateRange?.from && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {confirmedDateRange?.from ? (
                              confirmedDateRange.to ? (
                                `${format(confirmedDateRange.from, "dd/MM")} - ${format(confirmedDateRange.to, "dd/MM")}`
                              ) : (
                                format(confirmedDateRange.from, "dd/MM/yyyy")
                              )
                            ) : "Confirmada"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 border-b flex gap-1 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6"
                              onClick={() => setConfirmedDateRange({ from: new Date(), to: undefined })}
                            >
                              Hoy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6"
                              onClick={() => setQuickConfirmedDateRange(3)}
                            >
                              3 días
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6"
                              onClick={() => setQuickConfirmedDateRange(7)}
                            >
                              7 días
                            </Button>
                          </div>
                          <Calendar
                            mode="range"
                            selected={confirmedDateRange}
                            onSelect={setConfirmedDateRange}
                            locale={es}
                            numberOfMonths={1}
                            className="pointer-events-auto"
                          />
                          {confirmedDateRange?.from && (
                            <div className="p-2 border-t">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => setConfirmedDateRange(undefined)}
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
                  <React.Fragment key={row.id}>
                    {/* Day header */}
                    {row.isFirstOfDay && row.dayLabel && (
                      <div 
                        className="flex items-center px-3 py-2 bg-primary/10 border-t-2 border-primary/30"
                      >
                        <span className="text-xs font-semibold text-primary capitalize">
                          {row.dayLabel}
                        </span>
                      </div>
                    )}
                    {/* Data row */}
                    <div
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
                            "flex items-center px-1 py-1",
                            'overflow-hidden',
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
                          {col.type === 'readonly' && col.key !== 'cliente' && col.key !== 'tiempo_desplazamiento' && (
                            <span className={cn(
                              "text-xs px-1 truncate",
                              row.isCompleted && "line-through text-muted-foreground"
                            )}>
                              {getCellValue(row, col)}
                            </span>
                          )}
                          {col.key === 'tiempo_desplazamiento' && (() => {
                            const mins = row.travelMinutes;
                            const arrived = llegoState[row.id];

                            // Already arrived — show real travel time with comparison
                            if (arrived) {
                              const diff = arrived.estimatedMinutes != null ? arrived.realMinutes - arrived.estimatedMinutes : null;
                              const diffColor = diff == null ? '' : diff <= 0 ? 'text-emerald-600' : diff <= 5 ? 'text-amber-600' : 'text-red-600';
                              return (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-xs px-1 font-medium tabular-nums flex items-center gap-0.5">
                                        <MapPinCheck className="h-3 w-3 text-emerald-500" />
                                        <span className={diffColor}>{arrived.realMinutes} min</span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      <p>Tiempo real: {arrived.realMinutes} min</p>
                                      {arrived.estimatedMinutes != null && <p>Estimado Maps: {arrived.estimatedMinutes} min</p>}
                                      {diff != null && <p className={diffColor}>{diff > 0 ? `+${diff}` : diff} min diferencia</p>}
                                      {arrivalUsers[row.id]?.startedBy && (
                                        <p className="text-muted-foreground mt-1">Inició: {arrivalUsers[row.id].startedBy}</p>
                                      )}
                                      {arrivalUsers[row.id]?.arrivedBy && (
                                        <p className="text-muted-foreground">Llegó: {arrivalUsers[row.id].arrivedBy}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }

                            // Normal state — show estimated travel time
                            if (mins === null) return <span className="text-xs px-1 text-muted-foreground/50">—</span>;
                            if (mins === 0) return (
                              <span className="text-xs px-1 font-medium text-emerald-600 dark:text-emerald-400">Base</span>
                            );
                            const color = mins <= 15
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : mins <= 30
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400';
                            return (
                              <span className={cn("text-xs px-1 font-medium tabular-nums", color, row.isCompleted && "line-through opacity-60")}>
                                {mins} min
                              </span>
                            );
                          })()}
                          {col.type === 'readonly' && col.key === 'cliente' && (() => {
                            const babySeats = getBabySeats(row.reservation);
                            const totalSeats = babySeats.reduce((sum, s) => sum + (s.cantidad ?? s.quantity ?? 1), 0);
                            return (
                              <span className={cn(
                                "text-xs px-1 truncate flex items-center gap-1",
                                row.isCompleted && "line-through text-muted-foreground"
                              )}>
                                <span className="truncate">{getCellValue(row, col)}</span>
                                {babySeats.length > 0 && (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-0.5 shrink-0 text-pink-500">
                                          <Baby className="h-3.5 w-3.5" />
                                          {totalSeats > 1 && <span className="text-[10px] font-semibold">{totalSeats}</span>}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs max-w-[220px]">
                                        {babySeats.map((s, i) => (
                                          <p key={i}>{s.nombre || s.name}{(s.cantidad ?? s.quantity ?? 1) > 1 ? ` x${s.cantidad ?? s.quantity}` : ''}</p>
                                        ))}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </span>
                            );
                          })()}
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
                          {col.type === 'datetime' && col.key === 'hora_confirmada' && (() => {
                            // Comparar hora confirmada con fecha/hora original (solo hora:minuto)
                            const confirmed = row.confirmedDatetime;
                            const original = row.fechaHora;
                            const isDifferent = confirmed && original && confirmed !== original;
                            
                            return (
                              <div className={cn(
                                "flex items-center gap-0.5",
                                row.isCompleted && "line-through text-muted-foreground",
                                isDifferent && "bg-amber-50 dark:bg-amber-950/30 rounded px-0.5 -mx-0.5"
                              )}>
                                <EditableDateTimeCell
                                  value={confirmed}
                                  onChange={(newValue) => handleConfirmedDateUpdate(row, newValue)}
                                  className={cn(isDifferent && "font-semibold text-amber-700 dark:text-amber-400")}
                                />
                                {isDifferent && (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                                        <p>Hora ajustada manualmente.</p>
                                        <p className="text-muted-foreground">Original Rently: {original ? format(parseISO(original), 'dd/MM/yyyy HH:mm') : '—'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            );
                          })()}
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
                          {col.type === 'text' && col.key === 'direccion' && (
                            <div className={cn(
                              row.isCompleted && "line-through text-muted-foreground"
                            )}>
                              <AddressAutocompleteCell
                                value={getOperationFieldValue(row, col.key)}
                                onChange={(value) => handleOperationFieldUpdate(row, col.key, value)}
                              />
                            </div>
                          )}
                          {col.type === 'actions' && col.key === 'acciones_ruta' && (() => {
                            const currentEstado = getOperationFieldValue(row, 'estado');
                            const isEnCamino = currentEstado === 'En camino';
                            const isCompletada = currentEstado === 'Completada';
                            const hasAddress = !!getOperationFieldValue(row, 'direccion');
                            const arrived = llegoState[row.id];
                            const isLlegoLoading = llegoLoading[row.id];
                            const isIniciarLoading = iniciarLoading[row.id];
                            const address = getOperationFieldValue(row, 'direccion') || '';

                            if (!hasAddress || row.isCompleted) return null;

                            return (
                              <div className="flex items-center gap-0 justify-center">
                                {/* 1. Navegación — Abrir Google Maps */}
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-md text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                                  title="Abrir ruta en Google Maps"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Navigation className="h-3.5 w-3.5" />
                                </a>

                                {/* 2. Iniciar — Marcar En camino (only if not already en camino, not arrived, and not completada) */}
                                {!isEnCamino && !isCompletada && !arrived && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleIniciar(row); }}
                                    disabled={isIniciarLoading}
                                    className={cn(
                                      "p-1 rounded-md transition-colors",
                                      "text-sky-500 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950",
                                      isIniciarLoading && "opacity-50 cursor-wait"
                                    )}
                                    title="Iniciar trayecto (marcar En camino)"
                                  >
                                    <Play className={cn("h-3.5 w-3.5", isIniciarLoading && "animate-pulse")} />
                                  </button>
                                )}

                                {/* 2b. Location sharing indicator */}
                                {isEnCamino && sharingLocation[row.id] && (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const opType = row.tipoOperacion === 'Entrega' ? 'entrega' : 'devolucion';
                                            stopLocationSharing(row.id, row.reservationId, opType);
                                            toast.info('Ubicación dejada de compartir');
                                          }}
                                          className="p-1 rounded-md text-emerald-500 hover:text-red-500 transition-colors"
                                          title="Compartiendo ubicación (clic para detener)"
                                        >
                                          <Radio className="h-3.5 w-3.5 animate-pulse" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        <p>Compartiendo ubicación en vivo</p>
                                        <p className="text-muted-foreground">Clic para detener</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}

                                {/* 3. Llegué — Confirmar llegada */}
                                {isEnCamino && !arrived && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleLlego(row); }}
                                    disabled={isLlegoLoading}
                                    className={cn(
                                      "p-1 rounded-md transition-colors",
                                      "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950",
                                      isLlegoLoading && "opacity-50 cursor-wait"
                                    )}
                                    title="Confirmar llegada al destino"
                                  >
                                    <MapPinCheck className={cn("h-3.5 w-3.5", isLlegoLoading && "animate-pulse")} />
                                  </button>
                                )}

                                {/* Static completion indicator while llegoState is loading from DB */}
                                {isCompletada && !arrived && (
                                  <span className="p-1 flex items-center gap-0.5" title="Trayecto completado">
                                    <MapPinCheck className="h-3.5 w-3.5 text-emerald-500" />
                                  </span>
                                )}

                                {/* Indicador de llegada confirmada */}
                                {arrived && (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="p-1 flex items-center gap-0.5">
                                          <MapPinCheck className="h-3.5 w-3.5 text-emerald-500" />
                                          <span className={cn(
                                            "text-[10px] font-medium tabular-nums",
                                            arrived.estimatedMinutes != null && arrived.realMinutes > arrived.estimatedMinutes + 5
                                              ? 'text-red-600'
                                              : arrived.estimatedMinutes != null && arrived.realMinutes > arrived.estimatedMinutes
                                                ? 'text-amber-600'
                                                : 'text-emerald-600'
                                          )}>
                                            {arrived.realMinutes}'
                                          </span>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        <p>Tiempo real: {arrived.realMinutes} min</p>
                                        {arrived.estimatedMinutes != null && <p>Estimado Maps: {arrived.estimatedMinutes} min</p>}
                                        {arrived.estimatedMinutes != null && (
                                          <p className={arrived.realMinutes - arrived.estimatedMinutes <= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                                            Diferencia: {arrived.realMinutes - arrived.estimatedMinutes > 0 ? '+' : ''}{arrived.realMinutes - arrived.estimatedMinutes} min
                                          </p>
                                        )}
                                        {arrivalUsers[row.id]?.startedBy && (
                                          <p className="text-muted-foreground mt-1">Inició: {arrivalUsers[row.id].startedBy}</p>
                                        )}
                                        {arrivalUsers[row.id]?.arrivedBy && (
                                          <p className="text-muted-foreground">Llegó: {arrivalUsers[row.id].arrivedBy}</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            );
                          })()}
                          {col.type === 'text' && col.key !== 'direccion' && (
                            <div className={cn(
                              row.isCompleted && "line-through text-muted-foreground"
                            )}>
                              <EditableCell
                                value={getOperationFieldValue(row, col.key)}
                                onChange={(value) => handleOperationFieldUpdate(row, col.key, value)}
                              />
                            </div>
                          )}
                          {col.type === 'assignee' && col.key === 'asignado_rental' && (() => {
                            const refDatetime = row.confirmedDatetime || row.fechaHora;
                            const refDate = refDatetime ? refDatetime.substring(0, 10) : null;
                            const refTime = refDatetime && refDatetime.length >= 16 ? refDatetime.substring(11, 16) : null;
                            return (
                              <AssigneeSelect
                                userId={getOperationAssigneeId(row, 'rental', 'user')}
                                teamId={getOperationAssigneeId(row, 'rental', 'team')}
                                onChange={(userId, teamId) => handleOperationAssigneeUpdate(row, 'rental', userId, teamId)}
                                date={refDate}
                                reservationTime={refTime}
                                assignmentRole="rental"
                              />
                            );
                          })()}
                          {col.type === 'assignee' && col.key === 'asignado_escoba' && (() => {
                            const refDatetime = row.confirmedDatetime || row.fechaHora;
                            const refDate = refDatetime ? refDatetime.substring(0, 10) : null;
                            const refTime = refDatetime && refDatetime.length >= 16 ? refDatetime.substring(11, 16) : null;
                            return (
                              <AssigneeSelect
                                userId={getOperationAssigneeId(row, 'escoba', 'user')}
                                teamId={getOperationAssigneeId(row, 'escoba', 'team')}
                                onChange={(userId, teamId) => handleOperationAssigneeUpdate(row, 'escoba', userId, teamId)}
                                date={refDate}
                                reservationTime={refTime}
                                assignmentRole="escoba"
                              />
                            );
                          })()}
                          {col.type === 'detail' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setDetailReservation(row.reservation);
                                setShowDetailSheet(true);
                              }}
                              title="Ver ficha completa"
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                            </Button>
                          )}
                          {col.type === 'actions' && col.key === 'actions' && (
                            <div className="flex items-center gap-0.5">
                              {isFullAccess && (
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
                          )}
                        </div>
                      ))}
                    </div>
                  </React.Fragment>
                ))
              )}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      )}

      {/* Reservation Detail Sheet */}
      <ReservationDetailSheet
        reservation={detailReservation}
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
      />

      {/* Archived Reservations Sheet */}
      <ArchivedReservationsSheet
        open={showArchivedSheet}
        onOpenChange={setShowArchivedSheet}
        reservations={archivedReservations}
        onRestore={(id) => restoreReservation.mutate(id)}
        isRestoring={restoreReservation.isPending}
        archiveDays={reservationsArchiveDays}
      />

      {/* Location Sharing Dialog */}
      <Dialog open={locationDialog.open} onOpenChange={(open) => setLocationDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-500" />
              Compartir ubicación
            </DialogTitle>
            <DialogDescription>
              ¿Quieres compartir tu ubicación en tiempo real durante este trayecto? El manager podrá ver tu posición en el mapa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Radio className="h-8 w-8 text-emerald-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Tracking GPS en vivo</p>
              <p className="text-muted-foreground">Tu ubicación se actualizará cada 15 segundos. Se detendrá automáticamente al pulsar "Llegué".</p>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setLocationDialog({ open: false, row: null })}
            >
              No, gracias
            </Button>
            <Button
              onClick={() => {
                if (locationDialog.row) {
                  startLocationSharing(locationDialog.row);
                }
                setLocationDialog({ open: false, row: null });
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Radio className="h-4 w-4 mr-2" />
              Sí, compartir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SkeletonTransition>
  );
}
