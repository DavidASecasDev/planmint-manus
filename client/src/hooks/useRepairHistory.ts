import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import type { RepairHistory } from '@/types/garatech';

export function useRepairHistory(repairId: string) {
  const historyQuery = useQuery({
    queryKey: ['repair-history', repairId],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('repair_history')
        .select(`
          *,
          user:profiles!repair_history_user_id_fkey(name)
        `)
        .eq('repair_id', repairId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RepairHistory[];
    },
    enabled: !!repairId,
  });

  return {
    history: historyQuery.data ?? [],
    isLoading: historyQuery.isLoading,
  };
}
