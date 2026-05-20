/**
 * useTransferAutomation — Hook to fire transfer automation events
 * 
 * Calls the backend /api/fire-transfer-automation endpoint after
 * transfer creation or status changes to trigger automation rules.
 */
import { useCallback } from 'react';
import { apiInvoke } from '@/lib/apiClient';

type TransferTriggerType =
  | 'transfer_created'
  | 'transfer_status_changed'
  | 'transfer_due_soon'
  | 'transfer_completed'
  | 'transfer_cancelled';

interface FireAutomationParams {
  request_id: string;
  trigger_type: TransferTriggerType;
  status?: string;
  previous_status?: string | null;
  broker_id?: string | null;
  broker_name?: string;
  client_name?: string;
  service_type?: string;
  request_number?: string;
}

export function useTransferAutomation() {
  const fireAutomation = useCallback(async (params: FireAutomationParams) => {
    try {
      await apiInvoke('/api/fire-transfer-automation', { body: params as unknown as Record<string, unknown> });
    } catch (err) {
      // Automation failures should not block the user flow
      console.warn('[TransferAutomation] Failed to fire automation:', err);
    }
  }, []);

  const onTransferCreated = useCallback((params: {
    request_id: string;
    status: string;
    broker_id?: string | null;
    broker_name?: string;
    client_name?: string;
    service_type?: string;
    request_number?: string;
  }) => {
    return fireAutomation({
      ...params,
      trigger_type: 'transfer_created',
    });
  }, [fireAutomation]);

  const onTransferStatusChanged = useCallback((params: {
    request_id: string;
    status: string;
    previous_status?: string | null;
    broker_id?: string | null;
    broker_name?: string;
    client_name?: string;
    service_type?: string;
    request_number?: string;
  }) => {
    return fireAutomation({
      ...params,
      trigger_type: 'transfer_status_changed',
    });
  }, [fireAutomation]);

  return {
    fireAutomation,
    onTransferCreated,
    onTransferStatusChanged,
  };
}
