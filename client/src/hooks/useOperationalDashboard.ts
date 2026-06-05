import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface VehiclePrepItem {
  id: string;
  matricula: string;
  modelo: string | null;
  status: string; // sucio | incompleto
  nextReservationAt: string | null; // ISO date of next reservation start
  nextReservationCliente: string | null;
  nextReservationEstado: string | null;
  urgency: 'critical' | 'high' | 'medium' | 'low'; // based on time until reservation
}

export type TodayOperationType = 'checkin' | 'checkout' | 'transfer';

export interface TodayOperationRow {
  id: string; // reservationId + '_entrega' | '_devolucion' | '_transfer'
  reservationId: string;
  cliente_nombre: string | null;
  cliente_apellido: string | null;
  auto: string | null;
  modelo: string | null;
  desde: string | null;
  hasta: string | null;
  lugar_entrega: string | null;
  lugar_devolucion: string | null;
  estado: string | null;
  confirmed_entrega_datetime: string | null;
  confirmed_devolucion_datetime: string | null;
  extras_contratados: string | null;
  tipo_actividad: string | null;
  entrega_completada: boolean;
  devolucion_completada: boolean;
  transfer_completado: boolean;
  type: TodayOperationType;
  // Derived fields for easy rendering (matching ReservationsTable OperationRow)
  fechaHora: string | null;
  confirmedDatetime: string | null;
  lugar: string | null;
  isCompleted: boolean;
}

export interface OperationalStats {
  // Vehicle status breakdown
  vehiclesByStatus: {
    sucio: number;
    incompleto: number;
    limpio: number;
    en_servicio: number;
    alquilado: number;
  };
  totalVehicles: number;
  // Reservations
  activeReservations: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  upcomingReservations: number;
  // Movements
  activeMovements: number;
  // Repairs
  activeRepairs: number;
  // Fleet
  fleetVehicles: number;
  contractsExpiringSoon: number;
  // Tasks
  pendingTasksHigh: number;
  pendingTasksTotal: number;
  // Today's operations (expanded into per-operation rows like ReservationsTable)
  todayReservations: TodayOperationRow[];
  // Progress tracking
  todayOperationsTotal: number;
  todayOperationsCompleted: number;
  // Vehicles needing preparation (dynamic, crossed with reservations)
  vehiclesNeedingPrep: VehiclePrepItem[];
  // Total dirty/incomplete vehicles (including those without reservations)
  totalDirtyVehicles: number;
}

function calculateUrgency(reservationDate: string | null): VehiclePrepItem['urgency'] {
  if (!reservationDate) return 'low';
  const now = new Date();
  const resDate = new Date(reservationDate);
  const hoursUntil = (resDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 4) return 'critical';   // Less than 4 hours
  if (hoursUntil <= 24) return 'high';       // Less than 24 hours
  if (hoursUntil <= 72) return 'medium';     // Less than 3 days
  return 'low';                               // More than 3 days
}

/**
 * Extract YYYY-MM-DD from an ISO string without timezone conversion.
 * The stored datetimes use +00:00 offset but represent local operational times
 * (Mallorca). Using Date parsing converts to the browser's local timezone, which
 * causes late-night operations to shift to the next calendar day.
 */
function extractDatePart(isoStr: string | null): string | null {
  if (!isoStr) return null;
  const m = isoStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Parse a datetime string to a numeric timestamp for sorting.
 * Handles both 'T' and space separators and bare timezone offsets.
 */
function toTimestamp(s: string | null): number | null {
  if (!s) return null;
  let normalized = s.replace(' ', 'T');
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
  const t = new Date(normalized).getTime();
  return isNaN(t) ? null : t;
}

/** Shape of the server response from /api/get-operational-dashboard */
interface DashboardServerResponse {
  vehicles: Array<{ status: string }>;
  activeReservationsCount: number;
  todayReservationsDetail: Array<{
    id: string; cliente_nombre: string | null; cliente_apellido: string | null;
    auto: string | null; modelo: string | null; desde: string | null; hasta: string | null;
    lugar_entrega: string | null; lugar_devolucion: string | null; estado: string | null;
    confirmed_entrega_datetime: string | null; confirmed_devolucion_datetime: string | null;
    extras_contratados: string | null; tipo_actividad: string | null;
    entrega_completada: boolean; devolucion_completada: boolean; transfer_completado: boolean;
  }>;
  upcomingReservationsCount: number;
  activeMovementsCount: number;
  activeRepairsCount: number;
  fleetCount: number;
  expiringContractsCount: number;
  pendingTasksHighCount: number;
  pendingTasksTotalCount: number;
  dirtyVehicles: Array<{ id: string; matricula: string; modelo: string | null; status: string }>;
  upcomingReservationsDetail: Array<{
    auto: string | null; desde: string | null; cliente_nombre: string | null;
    cliente_apellido: string | null; estado: string | null;
  }>;
}

export function useOperationalDashboard() {
  const { profile, sessionReady } = useAuth();
  const orgId = profile?.organization_id;

  const { data: stats, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['operational-dashboard', orgId],
    queryFn: async (): Promise<OperationalStats> => {
      if (!orgId) throw new Error('No org');

      const todayStr = new Date().toISOString().split('T')[0];

      // Single server call replaces 12 individual Supabase queries
      const { data: serverData, error: apiError } = await apiInvoke<DashboardServerResponse>(
        'get-operational-dashboard',
        { body: { p_organization_id: orgId } }
      );

      if (apiError) throw new Error(apiError.message || 'Dashboard fetch failed');
      if (!serverData) throw new Error('No data returned from dashboard endpoint');

      // ─── Process vehicle status breakdown ───
      const vehiclesByStatus = {
        sucio: 0,
        incompleto: 0,
        limpio: 0,
        en_servicio: 0,
        alquilado: 0,
      };
      for (const v of serverData.vehicles) {
        const status = v.status as keyof typeof vehiclesByStatus;
        if (status in vehiclesByStatus) {
          vehiclesByStatus[status]++;
        }
      }

      // ─── Build today's operations list (matching ReservationsTable logic) ───
      const todayOperations: TodayOperationRow[] = [];

      for (const r of serverData.todayReservationsDetail) {
        if (r.tipo_actividad === 'Transfer') {
          const fechaHora = r.desde;
          const datePart = extractDatePart(fechaHora);
          if (datePart === todayStr) {
            todayOperations.push({
              id: `${r.id}_transfer`,
              reservationId: r.id,
              cliente_nombre: r.cliente_nombre,
              cliente_apellido: r.cliente_apellido,
              auto: r.auto,
              modelo: r.modelo,
              desde: r.desde,
              hasta: r.hasta,
              lugar_entrega: r.lugar_entrega,
              lugar_devolucion: r.lugar_devolucion,
              estado: r.estado,
              confirmed_entrega_datetime: r.confirmed_entrega_datetime,
              confirmed_devolucion_datetime: r.confirmed_devolucion_datetime,
              extras_contratados: r.extras_contratados,
              tipo_actividad: r.tipo_actividad,
              entrega_completada: r.entrega_completada,
              devolucion_completada: r.devolucion_completada,
              transfer_completado: r.transfer_completado,
              type: 'transfer',
              fechaHora,
              confirmedDatetime: r.confirmed_entrega_datetime,
              lugar: r.lugar_entrega || r.lugar_devolucion,
              isCompleted: r.transfer_completado,
            });
          }
        } else {
          // Entrega row: fechaHora = desde
          const entregaDate = extractDatePart(r.desde);
          if (entregaDate === todayStr) {
            todayOperations.push({
              id: `${r.id}_entrega`,
              reservationId: r.id,
              cliente_nombre: r.cliente_nombre,
              cliente_apellido: r.cliente_apellido,
              auto: r.auto,
              modelo: r.modelo,
              desde: r.desde,
              hasta: r.hasta,
              lugar_entrega: r.lugar_entrega,
              lugar_devolucion: r.lugar_devolucion,
              estado: r.estado,
              confirmed_entrega_datetime: r.confirmed_entrega_datetime,
              confirmed_devolucion_datetime: r.confirmed_devolucion_datetime,
              extras_contratados: r.extras_contratados,
              tipo_actividad: r.tipo_actividad,
              entrega_completada: r.entrega_completada,
              devolucion_completada: r.devolucion_completada,
              transfer_completado: r.transfer_completado,
              type: 'checkin',
              fechaHora: r.desde,
              confirmedDatetime: r.confirmed_entrega_datetime,
              lugar: r.lugar_entrega,
              isCompleted: r.entrega_completada,
            });
          }

          // Devolución row: fechaHora = hasta
          const devolucionDate = extractDatePart(r.hasta);
          if (devolucionDate === todayStr) {
            todayOperations.push({
              id: `${r.id}_devolucion`,
              reservationId: r.id,
              cliente_nombre: r.cliente_nombre,
              cliente_apellido: r.cliente_apellido,
              auto: r.auto,
              modelo: r.modelo,
              desde: r.desde,
              hasta: r.hasta,
              lugar_entrega: r.lugar_entrega,
              lugar_devolucion: r.lugar_devolucion,
              estado: r.estado,
              confirmed_entrega_datetime: r.confirmed_entrega_datetime,
              confirmed_devolucion_datetime: r.confirmed_devolucion_datetime,
              extras_contratados: r.extras_contratados,
              tipo_actividad: r.tipo_actividad,
              entrega_completada: r.entrega_completada,
              devolucion_completada: r.devolucion_completada,
              transfer_completado: r.transfer_completado,
              type: 'checkout',
              fechaHora: r.hasta,
              confirmedDatetime: r.confirmed_devolucion_datetime,
              lugar: r.lugar_devolucion,
              isCompleted: r.devolucion_completada,
            });
          }
        }
      }

      // Sort by confirmed datetime (matching ReservationsTable default sort: hora_confirmada ASC)
      todayOperations.sort((a, b) => {
        const aTs = toTimestamp(a.confirmedDatetime);
        const bTs = toTimestamp(b.confirmedDatetime);
        if (aTs === null && bTs === null) return 0;
        if (aTs === null) return 1;
        if (bTs === null) return -1;
        const cmp = aTs - bTs;
        if (cmp !== 0) return cmp;
        const aFh = toTimestamp(a.fechaHora);
        const bFh = toTimestamp(b.fechaHora);
        if (aFh !== null && bFh !== null) return aFh - bFh;
        return 0;
      });

      // Derive todayCheckIns / todayCheckOuts counts from the expanded operations
      const todayCheckIns = todayOperations.filter(op => op.type === 'checkin' || op.type === 'transfer').length;
      const todayCheckOuts = todayOperations.filter(op => op.type === 'checkout').length;

      // ─── Cross-reference dirty vehicles with upcoming reservations ───
      const dirtyVehicles = serverData.dirtyVehicles;
      const upcomingRes = serverData.upcomingReservationsDetail;

      // Build a map: matricula -> earliest upcoming reservation
      const nextReservationByPlate = new Map<string, {
        desde: string; cliente: string; estado: string | null;
      }>();
      for (const res of upcomingRes) {
        if (!res.auto || !res.desde) continue;
        const plate = res.auto.trim().toUpperCase();
        if (!nextReservationByPlate.has(plate)) {
          const cliente = [res.cliente_nombre, res.cliente_apellido].filter(Boolean).join(' ') || 'Sin nombre';
          nextReservationByPlate.set(plate, {
            desde: res.desde,
            cliente,
            estado: res.estado,
          });
        }
      }

      // Build the dynamic prep list: only vehicles with upcoming reservations, sorted by urgency
      const vehiclesWithReservations: VehiclePrepItem[] = [];
      const vehiclesWithoutReservations: VehiclePrepItem[] = [];

      for (const v of dirtyVehicles) {
        const plate = v.matricula.trim().toUpperCase();
        const nextRes = nextReservationByPlate.get(plate);

        const item: VehiclePrepItem = {
          id: v.id,
          matricula: v.matricula,
          modelo: v.modelo,
          status: v.status,
          nextReservationAt: nextRes?.desde || null,
          nextReservationCliente: nextRes?.cliente || null,
          nextReservationEstado: nextRes?.estado || null,
          urgency: calculateUrgency(nextRes?.desde || null),
        };

        if (nextRes) {
          vehiclesWithReservations.push(item);
        } else {
          vehiclesWithoutReservations.push(item);
        }
      }

      // Sort by urgency: critical first, then by reservation date
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      vehiclesWithReservations.sort((a, b) => {
        const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgDiff !== 0) return urgDiff;
        if (a.nextReservationAt && b.nextReservationAt) {
          return new Date(a.nextReservationAt).getTime() - new Date(b.nextReservationAt).getTime();
        }
        return 0;
      });

      // Combine: vehicles with reservations first, then without (limited)
      const vehiclesNeedingPrep = [
        ...vehiclesWithReservations,
        ...vehiclesWithoutReservations.slice(0, Math.max(0, 12 - vehiclesWithReservations.length)),
      ];

      // Filter out completed operations — dashboard only shows pending work
      const pendingOperations = todayOperations.filter(op => !op.isCompleted);
      const completedCount = todayOperations.filter(op => op.isCompleted).length;

      return {
        vehiclesByStatus,
        totalVehicles: serverData.vehicles.length,
        activeReservations: serverData.activeReservationsCount,
        todayCheckIns,
        todayCheckOuts,
        upcomingReservations: serverData.upcomingReservationsCount,
        activeMovements: serverData.activeMovementsCount,
        activeRepairs: serverData.activeRepairsCount,
        fleetVehicles: serverData.fleetCount,
        contractsExpiringSoon: serverData.expiringContractsCount,
        pendingTasksHigh: serverData.pendingTasksHighCount,
        pendingTasksTotal: serverData.pendingTasksTotalCount,
        todayReservations: pendingOperations,
        todayOperationsTotal: todayOperations.length,
        todayOperationsCompleted: completedCount,
        vehiclesNeedingPrep,
        totalDirtyVehicles: dirtyVehicles.length,
      };
    },
    // Gate on sessionReady to prevent queries from firing before
    // the Supabase token has been fully refreshed after a hard reload.
    enabled: !!orgId && sessionReady,
    refetchInterval: 5 * 60_000, // Refresh every 5 minutes (now just 1 server call instead of 12)
    retry: 1,
    retryDelay: 1000,
  });

  // When the query is disabled (orgId or sessionReady not ready), React Query v5
  // returns isPending=true but isFetching=false, so isLoading=false.
  // We must treat "waiting for auth" the same as "loading" to avoid
  // the SkeletonTransition getting stuck on !stats forever.
  const isWaitingForAuth = !orgId || !sessionReady;
  const isActuallyLoading = isLoading || isFetching || isWaitingForAuth;

  return {
    stats: stats || null,
    isLoading: isActuallyLoading,
    error,
    refetch,
  };
}
