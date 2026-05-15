import { useCallback, useRef } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
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
 * Prevents spamming the same alert every sync cycle.
 */
const DEDUP_WINDOW_HOURS = 6;

/** Minimum interval between full check cycles - 2 hours (in milliseconds) */
const MIN_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;

/** localStorage key for persisting the last check timestamp */
const LAST_CHECK_KEY = 'planmint_vehicle_prep_last_check';

/** Roles that should receive prep alerts */
const ALERT_ROLES = ['owner', 'admin', 'manager'];

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
 * Get the last check timestamp from localStorage.
 */
function getLastCheckTimestamp(): number {
  try {
    const stored = localStorage.getItem(LAST_CHECK_KEY);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (!isNaN(ts) && ts > 0) return ts;
    }
  } catch {
    // localStorage might be unavailable
  }
  return 0;
}

/**
 * Save the last check timestamp to localStorage.
 */
function setLastCheckTimestamp(ts: number): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(ts));
  } catch {
    // localStorage might be unavailable
  }
}

/**
 * Hook that checks for vehicles needing preparation with imminent reservations
 * and creates notifications for the CURRENT user only.
 *
 * Multi-layered dedup:
 * 1. localStorage throttle (2h) - prevents running too often, survives remounts
 * 2. In-memory concurrent guard
 * 3. DB dedup query (6h window) - prevents duplicate notifications per vehicle
 * 4. On DB query error, assumes all are already alerted (safe fallback)
 */
export function useVehiclePrepAlerts() {
  const { profile } = useAuth();
  const processingRef = useRef<boolean>(false);

  /**
   * Query vehicles in 'sucio' or 'incompleto' status that have a reservation
   * starting within the next ALERT_THRESHOLD_HOURS.
   */
  const findUnpreparedVehicles = useCallback(async (): Promise<UnpreparedVehicle[]> => {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() + ALERT_THRESHOLD_HOURS * 60 * 60 * 1000);

    // 1. Get all vehicles in dirty/incomplete status
    const { data: dirtyVehicles, error: vehicleError } = await supabaseQuery
      .from('vehicles')
      .select('id, matricula, modelo, status')
      .in('status', ['sucio', 'incompleto'])
      .is('archived_at', null);

    if (vehicleError || !dirtyVehicles || dirtyVehicles.length === 0) {
      if (vehicleError) log.error('Error fetching dirty vehicles:', vehicleError);
      return [];
    }

    // 2. Get upcoming reservations within the threshold window
    // Note: reservations table uses 'auto' (matricula) to link to vehicles, not vehicle_id
    const matriculas = dirtyVehicles.map((v: any) => v.matricula);
    const { data: reservations, error: resError } = await supabaseQuery
      .from('reservations')
      .select('id, auto, desde, cliente_nombre')
      .in('auto', matriculas)
      .gte('desde', now.toISOString())
      .lte('desde', thresholdDate.toISOString())
      .order('desde', { ascending: true });

    if (resError || !reservations || reservations.length === 0) {
      if (resError) log.error('Error fetching upcoming reservations:', resError);
      return [];
    }

    // 3. Match vehicles with their imminent reservations by matricula
    const results: UnpreparedVehicle[] = [];
    const vehicleByMatricula: Map<string, any> = new Map(dirtyVehicles.map((v: any) => [v.matricula, v]));

    for (const res of reservations) {
      const vehicle = vehicleByMatricula.get(res.auto ?? '');
      if (!vehicle) continue;

      const hoursUntil = (new Date(res.desde!).getTime() - now.getTime()) / (1000 * 60 * 60);
      const clienteName = res.cliente_nombre || 'Cliente desconocido';

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
   * Batch check which vehicles already have recent alerts for the current user.
   * Returns a Set of vehicle IDs that already have alerts.
   */
  const getAlreadyAlertedVehicleIds = useCallback(async (
    vehicleIds: string[],
    userId: string
  ): Promise<Set<string>> => {
    if (vehicleIds.length === 0) return new Set();

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - DEDUP_WINDOW_HOURS);

    const { data, error } = await supabaseQuery
      .from('notifications')
      .select('entity_id')
      .eq('user_id', userId)
      .eq('type', 'vehicle_prep_alert')
      .eq('entity_type', 'vehicle_prep')
      .in('entity_id', vehicleIds)
      .gte('created_at', cutoff.toISOString());

    if (error) {
      log.error('Error checking recent prep alerts:', error.message || (error as any).code || JSON.stringify(error));
      // On error, return ALL vehicle IDs as "already alerted" to prevent spam
      return new Set(vehicleIds);
    }

    return new Set((data || []).map((n: any) => n.entity_id));
  }, []);

  /**
   * Create a notification for the current user about an unprepared vehicle.
   */
  const createPrepAlert = useCallback(async (
    vehicle: UnpreparedVehicle,
    userId: string,
    orgId: string
  ): Promise<boolean> => {
    const statusLabel = vehicle.status === 'sucio' ? '🧹 Sucio' : '⚠️ Incompleto';
    const timeLabel = vehicle.hoursUntilReservation < 1
      ? `${Math.round(vehicle.hoursUntilReservation * 60)}min`
      : `${vehicle.hoursUntilReservation}h`;

    const title = `${statusLabel}: ${vehicle.matricula} — Reserva en ${timeLabel}`;
    const body = `El vehículo ${vehicle.matricula} (${vehicle.modelo || 'N/A'}) está en estado "${vehicle.status}" y tiene una reserva para ${vehicle.clienteNombre} en ${timeLabel}. Requiere preparación urgente.`;

    const { error } = await supabaseQuery
      .from('notifications')
      .insert({
        organization_id: orgId,
        user_id: userId,
        type: 'vehicle_prep_alert' as any,
        title,
        body: body.substring(0, 500),
        entity_type: 'vehicle_prep' as any,
        entity_id: vehicle.vehicleId,
        is_read: false,
      });

    if (error) {
      log.error(`Error creating prep alert for ${vehicle.matricula}: ${error.message || (error as any).code || JSON.stringify(error)}`);
      return false;
    }

    return true;
  }, []);

  /**
   * Main function: check for unprepared vehicles and send alerts to the CURRENT user.
   *
   * Multi-layered dedup:
   * 1. localStorage throttle (2h)
   * 2. In-memory concurrent guard
   * 3. DB dedup query (6h window)
   * 4. On error, assumes already alerted (safe fallback)
   *
   * Returns the number of alerts sent.
   */
  const checkAndAlert = useCallback(async (): Promise<number> => {
    const orgId = profile?.organization_id;
    const userId = profile?.id;
    const userRole = profile?.role;

    if (!orgId || !userId) {
      return 0;
    }

    // Only alert users with operations roles
    if (!userRole || !ALERT_ROLES.includes(userRole)) {
      return 0;
    }

    // Layer 1: Persistent throttle using localStorage
    const now = Date.now();
    const lastCheck = getLastCheckTimestamp();
    if (now - lastCheck < MIN_CHECK_INTERVAL_MS) {
      log.info(`Throttled: last check was ${Math.round((now - lastCheck) / 60000)}min ago`);
      return 0;
    }

    // Layer 2: Prevent concurrent runs
    if (processingRef.current) {
      log.info('Skipped: already processing');
      return 0;
    }

    processingRef.current = true;

    try {
      // 1. Find unprepared vehicles with imminent reservations
      const unprepared = await findUnpreparedVehicles();
      if (unprepared.length === 0) {
        log.info('No unprepared vehicles with imminent reservations');
        setLastCheckTimestamp(now);
        return 0;
      }

      log.info(`Found ${unprepared.length} unprepared vehicle(s) with imminent reservations`);

      // 2. Layer 3: Batch check which ones already have recent alerts for this user
      const vehicleIds = unprepared.map(v => v.vehicleId);
      const alreadyAlerted = await getAlreadyAlertedVehicleIds(vehicleIds, userId);

      // 3. Filter out already-alerted vehicles
      const newVehicles = unprepared.filter(v => !alreadyAlerted.has(v.vehicleId));

      if (newVehicles.length === 0) {
        log.info('All unprepared vehicles already have recent alerts, skipping');
        setLastCheckTimestamp(now);
        return 0;
      }

      // 4. Create alerts for the current user only
      let alertsSent = 0;
      for (const vehicle of newVehicles) {
        const sent = await createPrepAlert(vehicle, userId, orgId);
        if (sent) alertsSent++;
      }

      log.info(`Sent ${alertsSent} prep alert(s) for current user`);
      setLastCheckTimestamp(now);
      return alertsSent;
    } catch (err) {
      log.error('Error in vehicle prep alert check:', err);
      setLastCheckTimestamp(now);
      return 0;
    } finally {
      processingRef.current = false;
    }
  }, [profile?.organization_id, profile?.id, profile?.role, findUnpreparedVehicles, getAlreadyAlertedVehicleIds, createPrepAlert]);

  return {
    checkAndAlert,
    findUnpreparedVehicles,
  };
}
