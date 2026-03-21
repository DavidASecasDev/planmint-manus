import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    type: 'checkin' | 'checkout';
  }>;
  // Vehicles needing preparation
  vehiclesNeedingPrep: Array<{
    id: string;
    matricula: string;
    modelo: string | null;
    status: string;
  }>;
}

export function useOperationalDashboard() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['operational-dashboard', orgId],
    queryFn: async (): Promise<OperationalStats> => {
      if (!orgId) throw new Error('No org');

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
        vehiclesNeedingPrepResult,
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
          .select('id, cliente_nombre, cliente_apellido, auto, modelo, desde, hasta, lugar_entrega, lugar_devolucion, estado')
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
          .select('id, cliente_nombre, cliente_apellido, auto, modelo, desde, hasta, lugar_entrega, lugar_devolucion, estado')
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
        // Vehicles needing preparation (sucio or incompleto)
        supabase
          .from('vehicles')
          .select('id, matricula, modelo, status')
          .eq('organization_id', orgId)
          .eq('is_archived', false)
          .in('status', ['sucio', 'incompleto'])
          .order('matricula', { ascending: true })
          .limit(10),
      ]);

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
      const todayReservations = [
        ...(todayCheckInsDetailResult.data || []).map(r => ({ ...r, type: 'checkin' as const })),
        ...(todayCheckOutsDetailResult.data || []).map(r => ({ ...r, type: 'checkout' as const })),
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
        vehiclesNeedingPrep: (vehiclesNeedingPrepResult.data || []) as OperationalStats['vehiclesNeedingPrep'],
      };
    },
    enabled: !!orgId,
    refetchInterval: 60_000, // Refresh every minute
  });

  return {
    stats: stats || null,
    isLoading,
    refetch,
  };
}
