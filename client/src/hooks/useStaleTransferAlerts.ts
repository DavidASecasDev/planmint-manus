/**
 * useStaleTransferAlerts
 *
 * Detects transfer requests that have been in "pendiente" status for more than 48 hours
 * without any activity, and creates in-app notifications for the operations team.
 *
 * Activity is determined by the `updated_at` timestamp on the transfer_request.
 * If updated_at is more than 48h ago and status is still 'pendiente', the request is stale.
 *
 * Deduplication: only one alert per transfer per user per 24h window.
 * Targets: owner, admin, manager roles.
 */
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'StaleTransferAlerts' });

/** Hours after which a "pendiente" transfer is considered stale */
export const STALE_THRESHOLD_HOURS = 48;

/** Hours window for deduplication (don't re-alert for the same transfer) */
export const DEDUP_WINDOW_HOURS = 24;

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
  const lastCheckRef = useRef<string | null>(null);

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
   * Get all organization members who should receive stale transfer alerts.
   * Targets: owner, admin, manager roles (operations team).
   */
  const getOperationsTeamMembers = useCallback(async (orgId: string): Promise<string[]> => {
    try {
      const result = await apiInvoke<{ data: any[]; error: string | null }>('get-org-members', {
        body: { p_organization_id: orgId },
      });
      if (result.error || !result.data?.data) {
        log.error('Error fetching operations team:', result.error);
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
   * Check if a similar notification was already sent recently for this transfer
   * to avoid spamming the same alert every check cycle.
   */
  const hasRecentAlert = useCallback(async (
    transferId: string,
    userId: string
  ): Promise<boolean> => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - DEDUP_WINDOW_HOURS);

    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('entity_type', 'transfer_request')
      .eq('entity_id', transferId)
      .eq('user_id', userId)
      .eq('type', 'transfer_stale_alert')
      .gte('created_at', cutoff.toISOString())
      .limit(1);

    if (error) {
      log.error('Error checking recent alerts:', error);
      return false; // Allow sending if we can't check
    }
    return (data?.length || 0) > 0;
  }, []);

  /**
   * Create a notification for a specific user about a stale transfer.
   */
  const createStaleAlert = useCallback(async (
    transfer: StaleTransfer,
    userId: string,
    orgId: string
  ): Promise<boolean> => {
    const daysStale = Math.floor(transfer.hoursStale / 24);
    const hoursRemainder = transfer.hoursStale % 24;
    const timeLabel = daysStale > 0
      ? `${daysStale}d ${hoursRemainder}h`
      : `${transfer.hoursStale}h`;

    const title = `⏰ ${transfer.request_number} — Sin respuesta (${timeLabel})`;
    const body = `La solicitud ${transfer.request_number} de ${transfer.broker_name} para ${transfer.client_name} lleva ${timeLabel} en estado "Pendiente" sin actividad. Requiere atención.`;

    const { error } = await supabase
      .from('notifications')
      .insert({
        organization_id: orgId,
        user_id: userId,
        type: 'transfer_stale_alert',
        title,
        body: body.substring(0, 500),
        entity_type: 'transfer_request',
        entity_id: transfer.id,
        is_read: false,
      });

    if (error) {
      log.error(`Error creating stale alert for ${transfer.request_number}: ${error.message || error.code || JSON.stringify(error)}`);
      return false;
    }
    return true;
  }, []);

  /**
   * Main function: check for stale transfers and send alerts.
   * Can be called periodically (e.g., after each Rently sync cycle).
   *
   * Returns the number of alerts sent.
   */
  const checkAndAlert = useCallback(async (): Promise<number> => {
    const orgId = profile?.organization_id;
    if (!orgId) {
      log.warn('No organization ID, skipping stale transfer alerts');
      return 0;
    }

    try {
      // 1. Find stale transfers
      const staleTransfers = await findStaleTransfers();
      if (staleTransfers.length === 0) {
        log.info('No stale transfers found');
        return 0;
      }

      log.info(`Found ${staleTransfers.length} stale transfer(s) (>48h pendiente)`);

      // 2. Get operations team members
      const teamMembers = await getOperationsTeamMembers(orgId);
      if (teamMembers.length === 0) {
        log.warn('No operations team members found');
        return 0;
      }

      // 3. Send alerts (with deduplication)
      let alertsSent = 0;
      for (const transfer of staleTransfers) {
        for (const userId of teamMembers) {
          const alreadyAlerted = await hasRecentAlert(transfer.id, userId);
          if (alreadyAlerted) {
            log.info(`Skipping duplicate alert for ${transfer.request_number} to user ${userId}`);
            continue;
          }

          const sent = await createStaleAlert(transfer, userId, orgId);
          if (sent) alertsSent++;
        }
      }

      log.info(`Sent ${alertsSent} stale transfer alert(s) to ${teamMembers.length} team member(s)`);
      lastCheckRef.current = new Date().toISOString();
      return alertsSent;
    } catch (err) {
      log.error('Error in stale transfer alert check:', err);
      return 0;
    }
  }, [profile?.organization_id, findStaleTransfers, getOperationsTeamMembers, hasRecentAlert, createStaleAlert]);

  return {
    checkAndAlert,
    findStaleTransfers,
    lastCheck: lastCheckRef.current,
  };
}
