import { useQuery } from '@tanstack/react-query';
import { supabase, waitForSession } from '@/integrations/supabase/client';
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
  // Today's reservation details
  todayReservations: Array<{
    id: string;
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
    type: 'checkin' | 'checkout';
  }>;
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

export function useOperationalDashboard() {
  const { profile, sessionReady } = useAuth();
  const orgId = profile?.organization_id;

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['operational-dashboard', orgId],
    queryFn: async (): Promise<OperationalStats> => {
      if (!orgId) throw new Error('No org');

      // Wait for the initial session to be fully validated/refreshed.
      // This prevents 401 errors when the token is being refreshed after hard reload.
      await waitForSession();

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Fetch all stats in parallel
      const [
        vehiclesResult,
        activeReservationsResult,
        todayCheckInsResult,
        todayCheckOutsResult,
        todayCheckInsDetailResult,
        todayCheckOutsDetailResult,
        upcomingReservationsResult,
        activeMovementsResult,
        activeRepairsResult,
        fleetResult,
        expiringContractsResult,
        pendingTasksHighResult,
        pendingTasksTotalResult,
        dirtyVehiclesResult,
        upcomingReservationsDetailResult,
      ] = await Promise.all([
        // All non-archived vehicles with their status
        supabase
          .from('vehicles')
          .select('status')
          .eq('organization_id', orgId)
          .eq('is_archived', false),
        // Active reservations (not cancelled, not terminated, not archived)
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .not('estado', 'ilike', '%cancelada%')
          .not('estado', 'ilike', '%terminada%'),
        // Today's check-ins (reservations starting today)
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .gte('desde', `${todayStr}T00:00:00`)
          .lte('desde', `${todayStr}T23:59:59`)
          .not('estado', 'ilike', '%cancelada%'),
        // Today's check-outs (reservations ending today)
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .gte('hasta', `${todayStr}T00:00:00`)
          .lte('hasta', `${todayStr}T23:59:59`)
          .not('estado', 'ilike', '%cancelada%'),
        // Today's check-ins detail
        supabase
          .from('reservations')
          .select('id, cliente_nombre, cliente_apellido, auto, modelo, desde, hasta, lugar_entrega, lugar_devolucion, estado, confirmed_entrega_datetime, confirmed_devolucion_datetime, extras_contratados')
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .gte('desde', `${todayStr}T00:00:00`)
          .lte('desde', `${todayStr}T23:59:59`)
          .not('estado', 'ilike', '%cancelada%')
          .order('desde', { ascending: true })
          .limit(20),
        // Today's check-outs detail
        supabase
          .from('reservations')
          .select('id, cliente_nombre, cliente_apellido, auto, modelo, desde, hasta, lugar_entrega, lugar_devolucion, estado, confirmed_entrega_datetime, confirmed_devolucion_datetime, extras_contratados')
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .gte('hasta', `${todayStr}T00:00:00`)
          .lte('hasta', `${todayStr}T23:59:59`)
          .not('estado', 'ilike', '%cancelada%')
          .order('hasta', { ascending: true })
          .limit(20),
        // Upcoming reservations (next 7 days)
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .gte('desde', `${todayStr}T00:00:00`)
          .lte('desde', `${in7days}T23:59:59`)
          .not('estado', 'ilike', '%cancelada%')
          .not('estado', 'ilike', '%terminada%'),
        // Active movements
        supabase
          .from('vehicle_movements')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'en_curso'),
        // Active repairs
        supabase
          .from('repairs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .in('status', ['pending', 'in_progress', 'waiting_parts']),
        // Fleet vehicles count
        supabase
          .from('fleet_vehicles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),
        // Contracts expiring in next 30 days
        supabase
          .from('fleet_vehicles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .lte('fecha_fin_contrato', new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .gte('fecha_fin_contrato', todayStr),
        // Pending tasks with urgent priority only
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_archived', false)
          .is('deleted_at', null)
          .in('status', ['pending', 'in_progress'])
          .eq('priority', 'urgent'),
        // All pending tasks
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_archived', false)
          .is('deleted_at', null)
          .in('status', ['pending', 'in_progress']),
        // All vehicles needing preparation (sucio or incompleto)
        supabase
          .from('vehicles')
          .select('id, matricula, modelo, status')
          .eq('organization_id', orgId)
          .eq('is_archived', false)
          .in('status', ['sucio', 'incompleto']),
        // Upcoming reservations with vehicle info (next 7 days) for cross-referencing
        supabase
          .from('reservations')
          .select('auto, desde, cliente_nombre, cliente_apellido, estado')
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .gte('desde', today.toISOString())
          .lte('desde', `${in7days}T23:59:59`)
          .not('estado', 'ilike', '%cancelada%')
          .not('estado', 'ilike', '%terminada%')
          .order('desde', { ascending: true }),
      ]);

      // Check for critical errors in any of the results
      const results = [
        vehiclesResult, activeReservationsResult, todayCheckInsResult,
        todayCheckOutsResult, todayCheckInsDetailResult, todayCheckOutsDetailResult,
        upcomingReservationsResult, activeMovementsResult, activeRepairsResult,
        fleetResult, expiringContractsResult, pendingTasksHighResult,
        pendingTasksTotalResult, dirtyVehiclesResult, upcomingReservationsDetailResult,
      ];
      
      // If any query returned a 401/403 error, throw to trigger retry
      for (const result of results) {
        if (result.error) {
          const code = (result.error as any)?.code;
          const status = (result.error as any)?.status;
          if (status === 401 || status === 403 || code === 'PGRST301') {
            console.error('[Dashboard] Auth error in query:', result.error.message);
            throw new Error(`Auth error: ${result.error.message}`);
          }
        }
      }

      // Count vehicles by status
      const vehicles = vehiclesResult.data || [];
      const vehiclesByStatus = {
        sucio: 0,
        incompleto: 0,
        limpio: 0,
        en_servicio: 0,
        alquilado: 0,
      };
      vehicles.forEach(v => {
        const status = v.status as keyof typeof vehiclesByStatus;
        if (status in vehiclesByStatus) {
          vehiclesByStatus[status]++;
        }
      });

      // Build today's reservations list
      type TodayResRow = {
        id: string; cliente_nombre: string | null; cliente_apellido: string | null;
        auto: string | null; modelo: string | null; desde: string | null; hasta: string | null;
        lugar_entrega: string | null; lugar_devolucion: string | null; estado: string | null;
        confirmed_entrega_datetime: string | null; confirmed_devolucion_datetime: string | null;
        extras_contratados: string | null;
      };
      const todayReservations = [
        ...((todayCheckInsDetailResult.data || []) as unknown as TodayResRow[]).map(r => ({ ...r, type: 'checkin' as const })),
        ...((todayCheckOutsDetailResult.data || []) as unknown as TodayResRow[]).map(r => ({ ...r, type: 'checkout' as const })),
      ];

      // ─── Cross-reference dirty vehicles with upcoming reservations ───
      const dirtyVehicles = (dirtyVehiclesResult.data || []) as Array<{
        id: string; matricula: string; modelo: string | null; status: string;
      }>;
      const upcomingRes = (upcomingReservationsDetailResult.data || []) as Array<{
        auto: string | null; desde: string | null; cliente_nombre: string | null;
        cliente_apellido: string | null; estado: string | null;
      }>;

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

      return {
        vehiclesByStatus,
        totalVehicles: vehicles.length,
        activeReservations: activeReservationsResult.count || 0,
        todayCheckIns: todayCheckInsResult.count || 0,
        todayCheckOuts: todayCheckOutsResult.count || 0,
        upcomingReservations: upcomingReservationsResult.count || 0,
        activeMovements: activeMovementsResult.count || 0,
        activeRepairs: activeRepairsResult.count || 0,
        fleetVehicles: fleetResult.count || 0,
        contractsExpiringSoon: expiringContractsResult.count || 0,
        pendingTasksHigh: pendingTasksHighResult.count || 0,
        pendingTasksTotal: pendingTasksTotalResult.count || 0,
        todayReservations,
        vehiclesNeedingPrep,
        totalDirtyVehicles: dirtyVehicles.length,
      };
    },
    // CRITICAL: Gate on sessionReady to prevent queries from firing before
    // the Supabase token has been fully refreshed after a hard reload.
    // Without this, queries fire with a stale/expired token → 401 → infinite skeleton.
    enabled: !!orgId && sessionReady,
    refetchInterval: 60_000, // Refresh every minute
    // Retry with increasing delay to handle token refresh timing
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  return {
    stats: stats || null,
    isLoading,
    error,
    refetch,
  };
}
