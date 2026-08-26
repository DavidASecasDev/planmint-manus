import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiInvoke } from '@/lib/apiClient';
import type {
  SesBatch,
  SesContractDraft,
  SesMunicipality,
  SesPersonProfile,
  SesSettings,
} from '@/types/sesHospedajes';

interface ServerEnvelope<T> { data: T; error: string | null }

function unwrap<T>(response: Awaited<ReturnType<typeof apiInvoke<ServerEnvelope<T>>>>): T {
  if (response.error) throw new Error(response.error.message);
  if (!response.data) throw new Error('Respuesta vacía del servidor');
  if (response.data.error) throw new Error(response.data.error);
  return response.data.data;
}

export interface SesDraftFilters {
  dateFrom: string;
  dateTo: string;
  status: string;
  search: string;
}

export function useSesHospedajes(filters: SesDraftFilters) {
  const queryClient = useQueryClient();

  const draftsQuery = useQuery({
    queryKey: ['ses-drafts', filters],
    queryFn: async () => unwrap(await apiInvoke<ServerEnvelope<{
      drafts: SesContractDraft[];
      summary: Record<string, number>;
      total: number;
    }>>('ses/drafts', { body: { ...filters } })),
    staleTime: 30_000,
  });

  const settingsQuery = useQuery({
    queryKey: ['ses-settings'],
    queryFn: async () => unwrap(await apiInvoke<ServerEnvelope<SesSettings | null>>('ses/settings')),
    staleTime: 5 * 60_000,
  });

  const batchesQuery = useQuery({
    queryKey: ['ses-batches'],
    queryFn: async () => unwrap(await apiInvoke<ServerEnvelope<SesBatch[]>>('ses/batches')),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ses-drafts'] });
  const invalidateBatches = () => queryClient.invalidateQueries({ queryKey: ['ses-batches'] });

  const prepareMutation = useMutation({
    mutationFn: async (input: { dateFrom: string; dateTo: string; reservationIds?: string[] }) =>
      unwrap(await apiInvoke<ServerEnvelope<{ total: number; created: number; updated: number; skippedLocked: number }>>(
        'ses/prepare', { body: input, timeoutMs: 120_000 },
      )),
    onSuccess: (result) => {
      invalidate();
      toast.success(`${result.total} reservas preparadas: ${result.created} nuevas, ${result.updated} actualizadas`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updatePersonMutation = useMutation({
    mutationFn: async (input: { id: string; values: Partial<SesPersonProfile> }) =>
      unwrap(await apiInvoke<ServerEnvelope<SesPersonProfile>>('ses/person/update', { body: input })),
    onSuccess: () => { invalidate(); toast.success('Datos personales guardados'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const createPersonMutation = useMutation({
    mutationFn: async (input: {
      draftId: string;
      role: 'holder' | 'primary_driver' | 'secondary_driver';
      values: Record<string, unknown>;
    }) => unwrap(await apiInvoke<ServerEnvelope<SesPersonProfile>>('ses/person/create', { body: input })),
    onSuccess: () => { invalidate(); toast.success('Persona añadida y vinculada'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateDraftMutation = useMutation({
    mutationFn: async (input: { id: string; values: Record<string, unknown> }) =>
      unwrap(await apiInvoke<ServerEnvelope<unknown>>('ses/draft/update', { body: input })),
    onSuccess: () => { invalidate(); toast.success('Contrato actualizado'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (input: { id: string; values: Record<string, unknown> }) =>
      unwrap(await apiInvoke<ServerEnvelope<unknown>>('ses/location/update', { body: input })),
    onSuccess: () => { invalidate(); toast.success('Ubicación guardada para futuras reservas'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (values: Partial<SesSettings>) =>
      unwrap(await apiInvoke<ServerEnvelope<SesSettings>>('ses/settings/update', { body: values })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ses-settings'] });
      invalidate();
      toast.success('Configuración SES guardada');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportXmlMutation = useMutation({
    mutationFn: async (ids: string[]) => unwrap(await apiInvoke<ServerEnvelope<{
      batchId: string;
      fileName: string;
      xml: string;
      xmlHash: string;
      itemCount: number;
    }>>('ses/xml/export', { body: { ids }, timeoutMs: 120_000 })),
    onSuccess: (result) => {
      const blob = new Blob([result.xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      invalidate();
      invalidateBatches();
      toast.success(`XML generado con ${result.itemCount} contrato(s)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markBatchUploadedMutation = useMutation({
    mutationFn: async (input: { batchId: string; officialLotCode: string; notes?: string | null }) =>
      unwrap(await apiInvoke<ServerEnvelope<SesBatch>>('ses/batches/uploaded', { body: input })),
    onSuccess: () => {
      invalidate();
      invalidateBatches();
      toast.success('Acuse de subida registrado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const recordBatchResultMutation = useMutation({
    mutationFn: async (input: {
      batchId: string;
      acceptedDraftIds: string[];
      errors: Array<{ draftId: string; code?: string | null; message: string }>;
      notes?: string | null;
    }) => unwrap(await apiInvoke<ServerEnvelope<SesBatch>>('ses/batches/result', { body: input })),
    onSuccess: () => {
      invalidate();
      invalidateBatches();
      toast.success('Resultado del lote conciliado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const searchMunicipalities = async (query: string, provinceCode?: string) =>
    unwrap(await apiInvoke<ServerEnvelope<SesMunicipality[]>>('ses/municipalities', {
      body: { query, ...(provinceCode ? { provinceCode } : {}) },
    }));

  return {
    drafts: draftsQuery.data?.drafts ?? [],
    summary: draftsQuery.data?.summary ?? {},
    total: draftsQuery.data?.total ?? 0,
    isLoading: draftsQuery.isLoading,
    refetch: draftsQuery.refetch,
    settings: settingsQuery.data ?? null,
    settingsLoading: settingsQuery.isLoading,
    batches: batchesQuery.data ?? [],
    batchesLoading: batchesQuery.isLoading,
    prepare: prepareMutation,
    updatePerson: updatePersonMutation,
    createPerson: createPersonMutation,
    updateDraft: updateDraftMutation,
    updateLocation: updateLocationMutation,
    updateSettings: updateSettingsMutation,
    exportXml: exportXmlMutation,
    markBatchUploaded: markBatchUploadedMutation,
    recordBatchResult: recordBatchResultMutation,
    searchMunicipalities,
  };
}
