import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import type { SesDraftFilters } from '@/lib/sesFilterPreferences';

interface ServerEnvelope<T> { data: T; error: string | null }

function unwrap<T>(response: Awaited<ReturnType<typeof apiInvoke<ServerEnvelope<T>>>>): T {
  if (response.error) throw new Error(response.error.message);
  if (!response.data) throw new Error('Respuesta vacía del servidor');
  if (response.data.error) throw new Error(response.data.error);
  return response.data.data;
}

export function useSesFilterPreferences(enabled: boolean) {
  const queryClient = useQueryClient();
  const { profile, sessionReady } = useAuth();
  const userId = profile?.id ?? null;

  const query = useQuery({
    queryKey: ['ses-filter-preferences', userId],
    queryFn: async () => unwrap(await apiInvoke<ServerEnvelope<SesDraftFilters | null>>('ses/filter-preferences')),
    enabled: enabled && sessionReady && Boolean(userId),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const save = useMutation({
    mutationFn: async (filters: SesDraftFilters) => unwrap(await apiInvoke<ServerEnvelope<SesDraftFilters>>(
      'ses/filter-preferences/update', { body: { ...filters } },
    )),
    onSuccess: (filters) => {
      queryClient.setQueryData(['ses-filter-preferences', userId], filters);
    },
    onError: (error: Error) => toast.error(`No se pudieron guardar tus filtros: ${error.message}`),
  });

  return {
    userId,
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    isError: query.isError,
    save,
  };
}
