import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'VehiclePrepAlerts' });

/**
 * Threshold in hours: if a vehicle has a reservation starting within this
 * window and is still in 'sucio' or 'incompleto' status, an alert is sent.
 */
const ALERT_THRESHOLD_HOURS = 2;

/**
 * Minimum interval between duplicate alerts for the same vehicle (in hours).
 * Prevents spamming the same alert every 5 minutes.
 */
const DEDUP_WINDOW_HOURS = 2;

export interface UnpreparedVehicle {
  vehicleId: string;
  matricula: string;
  modelo: string | null;
  status: string; // sucio | incompleto
  reservationId: string;
  clienteNombre: string | null;
  reservationStart: string; // ISO date
  hoursUntilReservation: number;
}

/**
 * Hook that checks for vehicles needing preparation with imminent reservations
 * and creates notifications for all org members with relevant permissions.
 *
 * Designed to be called after each Rently sync cycle.
 */
export function useVehiclePrepAlerts() {
  const { profile } = useAuth();
  const lastCheckRef = useRef<string | null>(null);

  /**
   * Query vehicles in 'sucio' or 'incompleto' status that have a reservation
   * starting within the next ALERT_THRESHOLD_HOURS.
   */
  const findUnpreparedVehicles = useCallback(async (): Promise<UnpreparedVehicle[]> => {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() + ALERT_THRESHOLD_HOURS * 60 * 60 * 1000);

    // 1. Get all vehicles in dirty/incomplete status
    const { data: dirtyVehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, matricula, modelo, status')
      .in('status', ['sucio', 'incompleto'])
      .is('archived_at', null);

    if (vehicleError || !dirtyVehicles || dirtyVehicles.length === 0) {
      if (vehicleError) log.error('Error fetching dirty vehicles:', vehicleError);
      return [];
    }

    // 2. Get upcoming reservations (next 2 hours) that match these vehicles
    const matriculas = dirtyVehicles.map(v => v.matricula);

    const { data: upcomingReservations, error: resError } = await supabase
      .from('reservations')
      .select('id, auto, cliente_nombre, cliente_apellido, desde, estado')
      .in('auto', matriculas)
      .gte('desde', now.toISOString())
      .lte('desde', thresholdDate.toISOString())
      .in('estado', ['Pendiente', 'Confirmada', 'En curso'])
      .is('archived_at', null)
      .order('desde', { ascending: true });

    if (resError || !upcomingReservations || upcomingReservations.length === 0) {
      if (resError) log.error('Error fetching upcoming reservations:', resError);
      return [];
    }

    // 3. Cross-reference: find vehicles that are dirty AND have an imminent reservation
    const vehicleMap = new Map(dirtyVehicles.map(v => [v.matricula, v]));
    const results: UnpreparedVehicle[] = [];
    const seenVehicles = new Set<string>(); // Only one alert per vehicle

    for (const res of upcomingReservations) {
      if (!res.auto || seenVehicles.has(res.auto)) continue;
      const vehicle = vehicleMap.get(res.auto);
      if (!vehicle) continue;

      seenVehicles.add(res.auto);
      const resDate = new Date(res.desde!);
      const hoursUntil = (resDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      const clienteName = [res.cliente_nombre, res.cliente_apellido]
        .filter(Boolean)
        .join(' ') || 'Cliente desconocido';

      results.push({
        vehicleId: vehicle.id,
        matricula: vehicle.matricula,
        modelo: vehicle.modelo,
        status: vehicle.status,
        reservationId: res.id,
        clienteNombre: clienteName,
        reservationStart: res.desde!,
        hoursUntilReservation: Math.round(hoursUntil * 10) / 10,
      });
    }

    return results;
  }, []);

  /**
   * Get all organization members who should receive prep alerts.
   * Targets: owner, admin, manager roles (operations team).
   */
  const getOperationsTeamMembers = useCallback(async (orgId: string): Promise<string[]> => {
    try {
      const result = await apiInvoke<{ data: any[]; error: string | null }>('get-org-members', {
        body: { p_organization_id: orgId },
      });

      if (result.error || !result.data?.data) {
        log.error('Error fetching operations team:', result.error?.message);
        return [];
      }

      return result.data.data
        .filter((m: any) => ['owner', 'admin', 'manager'].includes(m.role))
        .map((m: any) => m.user_id);
    } catch (err) {
      log.error('Error fetching operations team:', err);
      return [];
    }
  }, []);

  /**
   * Check if a similar notification was already sent recently for this vehicle
   * to avoid spamming the same alert every sync cycle.
   */
  const hasRecentAlert = useCallback(async (
    vehicleId: string,
    userId: string
  ): Promise<boolean> => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - DEDUP_WINDOW_HOURS);

    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('entity_type', 'vehicle_prep')
      .eq('entity_id', vehicleId)
      .eq('user_id', userId)
      .gte('created_at', cutoff.toISOString())
      .limit(1);

    if (error) {
      log.error('Error checking recent alerts:', error);
      return false; // Allow sending if we can't check
    }

    return (data?.length || 0) > 0;
  }, []);

  /**
   * Create a notification for a specific user about an unprepared vehicle.
   */
  const createPrepAlert = useCallback(async (
    vehicle: UnpreparedVehicle,
    userId: string,
    orgId: string
  ): Promise<boolean> => {
    const statusLabel = vehicle.status === 'sucio' ? 'sucio' : 'preparación incompleta';
    const timeLabel = vehicle.hoursUntilReservation < 1
      ? `${Math.round(vehicle.hoursUntilReservation * 60)} minutos`
      : `${vehicle.hoursUntilReservation.toFixed(1)} horas`;

    const title = `🔴 ${vehicle.matricula} — Reserva en ${timeLabel}`;
    const body = `El vehículo ${vehicle.matricula}${vehicle.modelo ? ` (${vehicle.modelo})` : ''} está en estado "${statusLabel}" y tiene una reserva para ${vehicle.clienteNombre} en ${timeLabel}. Requiere preparación urgente.`;

    const { error } = await supabase
      .from('notifications')
      .insert({
        organization_id: orgId,
        user_id: userId,
        type: 'vehicle_prep_alert',
        title,
        body: body.substring(0, 500),
        entity_type: 'vehicle_prep',
        entity_id: vehicle.vehicleId,
        is_read: false,
      });

    if (error) {
      log.error(`Error creating prep alert for ${vehicle.matricula}:`, error);
      return false;
    }

    return true;
  }, []);

  /**
   * Main function: check for unprepared vehicles and send alerts.
   * Called after each sync cycle completes.
   *
   * Returns the number of alerts sent.
   */
  const checkAndAlert = useCallback(async (): Promise<number> => {
    const orgId = profile?.organization_id;
    if (!orgId) {
      log.warn('No organization ID, skipping prep alerts');
      return 0;
    }

    try {
      // 1. Find unprepared vehicles with imminent reservations
      const unprepared = await findUnpreparedVehicles();
      if (unprepared.length === 0) {
        log.info('No unprepared vehicles with imminent reservations');
        return 0;
      }

      log.info(`Found ${unprepared.length} unprepared vehicle(s) with imminent reservations`);

      // 2. Get operations team members
      const teamMembers = await getOperationsTeamMembers(orgId);
      if (teamMembers.length === 0) {
        log.warn('No operations team members found');
        return 0;
      }

      // 3. Send alerts (with deduplication)
      let alertsSent = 0;

      for (const vehicle of unprepared) {
        for (const userId of teamMembers) {
          // Check if we already sent an alert for this vehicle recently
          const alreadyAlerted = await hasRecentAlert(vehicle.vehicleId, userId);
          if (alreadyAlerted) {
            log.info(`Skipping duplicate alert for ${vehicle.matricula} to user ${userId}`);
            continue;
          }

          const sent = await createPrepAlert(vehicle, userId, orgId);
          if (sent) alertsSent++;
        }
      }

      log.info(`Sent ${alertsSent} prep alert(s) to ${teamMembers.length} team member(s)`);
      lastCheckRef.current = new Date().toISOString();
      return alertsSent;
    } catch (err) {
      log.error('Error in vehicle prep alert check:', err);
      return 0;
    }
  }, [profile?.organization_id, findUnpreparedVehicles, getOperationsTeamMembers, hasRecentAlert, createPrepAlert]);

  return {
    checkAndAlert,
    findUnpreparedVehicles,
    lastCheck: lastCheckRef.current,
  };
}
