/**
 * useStaleTransferAlerts
 *
 * Detects transfer requests that have been in "pendiente" status for more than 48 hours
 * without any activity, and creates in-app notifications for the CURRENT user.
 *
 * Activity is determined by the `updated_at` timestamp on the transfer_request.
 * If updated_at is more than 48h ago and status is still 'pendiente', the request is stale.
 *
 * Deduplication strategy (multi-layered):
 * 1. localStorage throttle: prevents running more than once per 6 hours (survives remounts & reloads)
 * 2. DB dedup: checks if a notification already exists for this transfer+user within the last 7 days
 * 3. In-memory guard: prevents concurrent executions within the same session
 *
 * Only creates notifications for the current user because RLS policies
 * prevent reading other users' notifications.
 *
 * Targets: owner, admin, manager roles (checked on the current user).
 */
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'StaleTransferAlerts' });

/** Hours after which a "pendiente" transfer is considered stale */
export const STALE_THRESHOLD_HOURS = 48;

/** Hours window for deduplication in DB (don't re-alert for the same transfer within this window) */
export const DEDUP_WINDOW_HOURS = 7 * 24; // 7 days - much longer window to prevent repeats

/** Minimum interval between full check cycles - 6 hours (in milliseconds) */
const MIN_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** localStorage key for persisting the last check timestamp */
const LAST_CHECK_KEY = 'planmint_stale_transfer_last_check';

/** Roles that should receive stale transfer alerts */
const ALERT_ROLES = ['owner', 'admin', 'manager'];

export interface StaleTransfer {
  id: string;
  request_number: string;
  broker_name: string;
  client_name: string;
  created_at: string;
  updated_at: string;
  hoursStale: number; // hours since last activity
}

/**
 * Get the last check timestamp from localStorage (persists across remounts and page reloads).
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

export function useStaleTransferAlerts() {
  const { profile } = useAuth();
  const processingRef = useRef<boolean>(false); // prevent concurrent runs

  /**
   * Find transfer requests in "pendiente" status where updated_at is older than 48h.
   */
  const findStaleTransfers = useCallback(async (): Promise<StaleTransfer[]> => {
    const orgId = profile?.organization_id;
    if (!orgId) return [];

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - STALE_THRESHOLD_HOURS);

    const { data, error } = await supabase
      .from('transfer_requests')
      .select('id, request_number, broker_name, client_name, created_at, updated_at, status')
      .eq('organization_id', orgId)
      .eq('status', 'pendiente')
      .lte('updated_at', cutoff.toISOString())
      .order('updated_at', { ascending: true });

    if (error) {
      log.error('Error fetching stale transfers:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    const now = new Date();
    return data.map(tr => ({
      id: tr.id,
      request_number: tr.request_number,
      broker_name: tr.broker_name,
      client_name: tr.client_name,
      created_at: tr.created_at,
      updated_at: tr.updated_at,
      hoursStale: Math.round((now.getTime() - new Date(tr.updated_at).getTime()) / (1000 * 60 * 60)),
    }));
  }, [profile?.organization_id]);

  /**
   * Batch check which transfers already have recent alerts for the current user.
   * Returns a Set of transfer IDs that already have alerts.
   * Uses a single query with a 7-day window for robust deduplication.
   */
  const getAlreadyAlertedTransferIds = useCallback(async (
    transferIds: string[],
    userId: string
  ): Promise<Set<string>> => {
    if (transferIds.length === 0) return new Set();

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - DEDUP_WINDOW_HOURS);

    const { data, error } = await supabase
      .from('notifications')
      .select('entity_id')
      .eq('user_id', userId)
      .eq('type', 'transfer_stale_alert')
      .eq('entity_type', 'transfer_request')
      .in('entity_id', transferIds)
      .gte('created_at', cutoff.toISOString());

    if (error) {
      log.error('Error checking recent alerts:', error.message || error.code || JSON.stringify(error));
      // On error, return ALL transfer IDs as "already alerted" to prevent duplicates
      // This is the SAFE fallback - better to miss an alert than spam the user
      return new Set(transferIds);
    }

    return new Set((data || []).map(n => n.entity_id));
  }, []);

  /**
   * Create notifications for the current user about stale transfers (batch insert).
   */
  const createStaleAlerts = useCallback(async (
    transfers: StaleTransfer[],
    userId: string,
    orgId: string
  ): Promise<number> => {
    if (transfers.length === 0) return 0;

    const notifications = transfers.map(transfer => {
      const daysStale = Math.floor(transfer.hoursStale / 24);
      const hoursRemainder = transfer.hoursStale % 24;
      const timeLabel = daysStale > 0
        ? `${daysStale}d ${hoursRemainder}h`
        : `${transfer.hoursStale}h`;

      const title = `⏰ ${transfer.request_number} — Sin respuesta (${timeLabel})`;
      const body = `La solicitud ${transfer.request_number} de ${transfer.broker_name} para ${transfer.client_name} lleva ${timeLabel} en estado "Pendiente" sin actividad. Requiere atención.`;

      return {
        organization_id: orgId,
        user_id: userId,
        type: 'transfer_stale_alert' as const,
        title,
        body: body.substring(0, 500),
        entity_type: 'transfer_request' as const,
        entity_id: transfer.id,
        is_read: false,
      };
    });

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      log.error(`Error creating stale alerts: ${error.message || error.code || JSON.stringify(error)}`);
      return 0;
    }

    return notifications.length;
  }, []);

  /**
   * Main function: check for stale transfers and send alerts to the CURRENT user.
   *
   * Multi-layered dedup:
   * 1. localStorage throttle (6h) - prevents running too often, survives remounts
   * 2. In-memory concurrent guard - prevents overlapping executions
   * 3. DB dedup query (7-day window) - prevents duplicate notifications per transfer
   * 4. On DB query error, assumes all are already alerted (safe fallback)
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

    // Layer 1: Persistent throttle using localStorage (survives remounts and page reloads)
    const now = Date.now();
    const lastCheck = getLastCheckTimestamp();
    if (now - lastCheck < MIN_CHECK_INTERVAL_MS) {
      log.info(`Throttled: last check was ${Math.round((now - lastCheck) / 60000)}min ago, need ${Math.round(MIN_CHECK_INTERVAL_MS / 60000)}min`);
      return 0;
    }

    // Layer 2: Prevent concurrent runs within the same session
    if (processingRef.current) {
      log.info('Skipped: already processing');
      return 0;
    }

    processingRef.current = true;

    try {
      // 1. Find stale transfers
      const staleTransfers = await findStaleTransfers();
      if (staleTransfers.length === 0) {
        setLastCheckTimestamp(now);
        return 0;
      }

      log.info(`Found ${staleTransfers.length} stale transfer(s) (>48h pendiente)`);

      // 2. Layer 3: Batch check which ones already have recent alerts for this user (7-day window)
      const alreadyAlerted = await getAlreadyAlertedTransferIds(
        staleTransfers.map(t => t.id),
        userId
      );

      // 3. Filter out already-alerted transfers
      const newTransfers = staleTransfers.filter(t => !alreadyAlerted.has(t.id));

      if (newTransfers.length === 0) {
        log.info('All stale transfers already have recent alerts, skipping');
        setLastCheckTimestamp(now);
        return 0;
      }

      // 4. Batch create alerts for the current user only
      const alertsSent = await createStaleAlerts(newTransfers, userId, orgId);

      log.info(`Sent ${alertsSent} stale transfer alert(s) for current user`);
      setLastCheckTimestamp(now);
      return alertsSent;
    } catch (err) {
      log.error('Error in stale transfer alert check:', err);
      // Still update the timestamp to prevent retrying immediately on error
      setLastCheckTimestamp(now);
      return 0;
    } finally {
      processingRef.current = false;
    }
  }, [profile?.organization_id, profile?.id, profile?.role, findStaleTransfers, getAlreadyAlertedTransferIds, createStaleAlerts]);

  return {
    checkAndAlert,
    findStaleTransfers,
  };
}
