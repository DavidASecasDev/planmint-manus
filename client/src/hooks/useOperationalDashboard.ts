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
        upcomingReservationsResult,
        activeMovementsResult,
        activeRepairsResult,
        fleetResult,
        expiringContractsResult,
      ] = await Promise.all([
        // All non-archived vehicles with their status
        supabase
          .from('vehicles')
          .select('status')
          .eq('organization_id', orgId)
          .eq('is_archived', false),
        // Active reservations (confirmed or checked-in)
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .in('estado', ['confirmada', 'checked_in']),
        // Today's check-ins
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('fecha_inicio', `${todayStr}T00:00:00`)
          .lte('fecha_inicio', `${todayStr}T23:59:59`)
          .in('estado', ['confirmada', 'checked_in']),
        // Today's check-outs
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('fecha_fin', `${todayStr}T00:00:00`)
          .lte('fecha_fin', `${todayStr}T23:59:59`)
          .in('estado', ['checked_in', 'completada']),
        // Upcoming reservations (next 7 days)
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('fecha_inicio', `${todayStr}T00:00:00`)
          .lte('fecha_inicio', `${in7days}T23:59:59`)
          .eq('estado', 'confirmada'),
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
