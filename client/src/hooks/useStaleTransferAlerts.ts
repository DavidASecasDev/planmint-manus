/**
 * useStaleTransferAlerts
 *
 * Detects transfer requests that have been in "pendiente" status for more than 48 hours
 * without any activity, and creates in-app notifications for the CURRENT user.
 *
 * Activity is determined by the `updated_at` timestamp on the transfer_request.
 * If updated_at is more than 48h ago and status is still 'pendiente', the request is stale.
 *
 * Deduplication: only one alert per transfer per user per 24h window.
 * The check only creates notifications for the current user because RLS policies
 * prevent reading other users' notifications, which would break dedup checks.
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

/** Hours window for deduplication (don't re-alert for the same transfer) */
export const DEDUP_WINDOW_HOURS = 24;

/** Minimum interval between full check cycles (in milliseconds) - 30 minutes */
const MIN_CHECK_INTERVAL_MS = 30 * 60 * 1000;

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

export function useStaleTransferAlerts() {
  const { profile } = useAuth();
  const lastCheckRef = useRef<number>(0); // timestamp of last check
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
   * Uses a single query instead of N queries for efficiency.
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
      // Return empty set - will allow creating alerts (safe fallback)
      return new Set();
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
   * Includes throttling to prevent running too frequently.
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

    // Throttle: don't run more than once every 30 minutes
    const now = Date.now();
    if (now - lastCheckRef.current < MIN_CHECK_INTERVAL_MS) {
      return 0;
    }

    // Prevent concurrent runs
    if (processingRef.current) {
      return 0;
    }

    processingRef.current = true;

    try {
      // 1. Find stale transfers
      const staleTransfers = await findStaleTransfers();
      if (staleTransfers.length === 0) {
        lastCheckRef.current = now;
        return 0;
      }

      log.info(`Found ${staleTransfers.length} stale transfer(s) (>48h pendiente)`);

      // 2. Batch check which ones already have recent alerts for this user
      const alreadyAlerted = await getAlreadyAlertedTransferIds(
        staleTransfers.map(t => t.id),
        userId
      );

      // 3. Filter out already-alerted transfers
      const newTransfers = staleTransfers.filter(t => !alreadyAlerted.has(t.id));

      if (newTransfers.length === 0) {
        log.info('All stale transfers already have recent alerts, skipping');
        lastCheckRef.current = now;
        return 0;
      }

      // 4. Batch create alerts for the current user only
      const alertsSent = await createStaleAlerts(newTransfers, userId, orgId);

      log.info(`Sent ${alertsSent} stale transfer alert(s) for current user`);
      lastCheckRef.current = now;
      return alertsSent;
    } catch (err) {
      log.error('Error in stale transfer alert check:', err);
      return 0;
    } finally {
      processingRef.current = false;
    }
  }, [profile?.organization_id, profile?.id, profile?.role, findStaleTransfers, getAlreadyAlertedTransferIds, createStaleAlerts]);

  return {
    checkAndAlert,
    findStaleTransfers,
    lastCheck: lastCheckRef.current,
  };
}
