import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import type { TransferStatusHistoryEntry } from '@/types/transferStatusHistory';

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_gestion: 'En gestión',
  presupuesto_enviado: 'Ppto. Enviado',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export function useTransferStatusHistory(requestId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['transfer-status-history', requestId],
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabaseQuery
        .from('transfer_status_history')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as TransferStatusHistoryEntry[];
    },
    enabled: !!requestId,
  });

  const logStatusChange = useMutation({
    mutationFn: async (entry: {
      request_id: string;
      organization_id: string;
      previous_status: string | null;
      new_status: string;
      changed_by_type: 'admin' | 'broker' | 'system';
      changed_by_id?: string;
      changed_by_name?: string;
      note?: string;
      // Optional: for broker notification
      broker_id?: string | null;
      request_number?: string;
      client_name?: string;
    }) => {
      const { error } = await supabaseQuery
        .from('transfer_status_history')
        .insert({
          request_id: entry.request_id,
          organization_id: entry.organization_id,
          previous_status: entry.previous_status,
          new_status: entry.new_status,
          changed_by_type: entry.changed_by_type,
          changed_by_id: entry.changed_by_id || null,
          changed_by_name: entry.changed_by_name || null,
          note: entry.note || null,
        });

      if (error) throw error;

      // Notify broker if status changed by admin and broker has portal access
      if (entry.changed_by_type === 'admin' && entry.broker_id) {
        try {
          // Look up broker's user_id from transfer_brokers
          const { data: broker } = await supabaseQuery
            .from('transfer_brokers')
            .select('user_id, name')
            .eq('id', entry.broker_id)
            .single();

          if (broker?.user_id) {
            const newLabel = STATUS_LABELS[entry.new_status] || entry.new_status;
            const ref = entry.request_number || entry.request_id.slice(0, 8);
            const client = entry.client_name || '';
            await supabaseQuery.from('notifications').insert({
              organization_id: entry.organization_id,
              user_id: broker.user_id,
              type: 'transfer_status_change',
              title: `${ref} — Estado: ${newLabel}`,
              body: client
                ? `Tu solicitud para ${client} ha cambiado a "${newLabel}".`
                : `Tu solicitud ha cambiado a "${newLabel}".`,
              entity_type: 'transfer_request',
              entity_id: entry.request_id,
              is_read: false,
            });
          }
        } catch (notifErr) {
          // Non-blocking: don't fail status change if notification fails
          console.error('Failed to notify broker of status change:', notifErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-status-history'] });
    },
  });

  return {
    history,
    isLoading,
    logStatusChange: logStatusChange.mutateAsync,
  };
}
