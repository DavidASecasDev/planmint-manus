import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TransferStatusHistoryEntry } from '@/types/transferStatusHistory';

export function useTransferStatusHistory(requestId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['transfer-status-history', requestId],
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabase
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
    }) => {
      const { error } = await supabase
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
