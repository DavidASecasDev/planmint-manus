import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiInvoke } from '@/lib/apiClient';
import type {
  SesBatch,
  SesContractDraft,
  SesEligibilityException,
  SesMunicipality,
  SesPersonProfile,
  SesSettings,
} from '@/types/sesHospedajes';
import type { SesDraftFilters } from '@/lib/sesFilterPreferences';

interface ServerEnvelope<T> { data: T; error: string | null }

function unwrap<T>(response: Awaited<ReturnType<typeof apiInvoke<ServerEnvelope<T>>>>): T {
  if (response.error) throw new Error(response.error.message);
  if (!response.data) throw new Error('Respuesta vacía del servidor');
  if (response.data.error) throw new Error(response.data.error);
  return response.data.data;
}

export function useSesHospedajes(
  filters: SesDraftFilters,
  enabled = true,
  pagination: { limit: number; offset: number; searchMode: 'exact' | 'contains' } = { limit: 200, offset: 0, searchMode: 'exact' },
) {
  const queryClient = useQueryClient();

  const draftsQuery = useQuery({
    queryKey: ['ses-drafts', filters, pagination],
    queryFn: async () => unwrap(await apiInvoke<ServerEnvelope<{
      drafts: SesContractDraft[];
      summary: Record<string, number>;
      total: number;
      pageCount: number;
      limit: number;
      offset: number;
      schemaMigrationRequired?: boolean;
    }>>('ses/drafts', { body: { ...filters, ...pagination } })),
    staleTime: 30_000,
    enabled,
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

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      let reset = true;
      let rentlyFetched = 0;
      let rentlyInserted = 0;
      for (let iteration = 0; iteration < 200; iteration++) {
        const response = await apiInvoke<{
          success: boolean;
          hasMore: boolean;
          progress: { fetched: number; inserted: number; totalFetched: number; totalInserted: number };
          error?: string;
        }>('sync-rently', { body: { reset, continue_sync: !reset, include_all: true }, timeoutMs: 120_000 });
        if (response.error) throw new Error(response.error.message);
        if (!response.data?.success) throw new Error(response.data?.error || 'Rently no pudo completar la sincronización');
        rentlyFetched = response.data.progress.totalFetched;
        rentlyInserted = response.data.progress.totalInserted;
        if (!response.data.hasMore) break;
        reset = false;
        if (iteration === 199) throw new Error('La sincronización Rently superó el límite de seguridad de páginas');
      }

      let offset = 0;
      let draftsCreated = 0;
      let draftsUpdated = 0;
      let draftsUnchanged = 0;
      let draftsTotal = 0;
      for (let iteration = 0; iteration < 200; iteration++) {
        const result = unwrap(await apiInvoke<ServerEnvelope<{
          processed: number; created: number; updated: number; unchanged: number; skippedLocked: number;
          total: number; nextOffset: number | null; hasMore: boolean;
        }>>('ses/sync', { body: { offset, limit: 50 }, timeoutMs: 120_000 }));
        draftsCreated += result.created;
        draftsUpdated += result.updated;
        draftsUnchanged += result.unchanged;
        draftsTotal = result.total;
        if (!result.hasMore || result.nextOffset === null) break;
        offset = result.nextOffset;
        if (iteration === 199) throw new Error('La sincronización SES superó el límite de seguridad de páginas');
      }
      return { rentlyFetched, rentlyInserted, draftsCreated, draftsUpdated, draftsUnchanged, draftsTotal };
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(`Sincronización completada: ${result.draftsTotal} reservas disponibles en SES`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const prepareMutation = useMutation({
    mutationFn: async (input: { dateFrom: string; dateTo: string; reservationIds?: string[] }) =>
      unwrap(await apiInvoke<ServerEnvelope<{
        total: number; eligible: number; excluded: number; created: number; updated: number; skippedLocked: number;
        exclusions: Array<{ reservationId: string; reference: string; reasons: Array<{ code: string; message: string }> }>;
      }>>('ses/prepare', { body: input, timeoutMs: 120_000 })),
    onSuccess: (result) => {
      invalidate();
      if (result.excluded) {
        toast.warning(`${result.eligible} elegibles y ${result.excluded} excluidas. Revisa los motivos antes de continuar.`);
      } else {
        toast.success(`${result.total} reservas preparadas: ${result.created} nuevas, ${result.updated} actualizadas`);
      }
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
    mutationFn: async (input: { draftId: string; role: 'holder' | 'primary_driver' | 'secondary_driver'; values: Record<string, unknown> }) =>
      unwrap(await apiInvoke<ServerEnvelope<SesPersonProfile>>('ses/person/create', { body: input })),
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

  const uploadXsdMutation = useMutation({
    mutationFn: async (input: { fileName: string; version: string; content: string }) =>
      unwrap(await apiInvoke<ServerEnvelope<{ hash: string; version: string; uploadedAt: string }>>(
        'ses/settings/xsd', { body: input, timeoutMs: 60_000 },
      )),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ses-settings'] });
      invalidate();
      toast.success('XSD oficial guardado');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const checkOfficialCommunicationMutation = useMutation({
    mutationFn: async (input: {
      draftId: string;
      outcome: 'not_found' | 'found';
      communication?: {
        officialCommunicationCode: string; officialLotCode?: string | null; reference: string;
        communicationType?: 'ALQUILER_VEHICULO'; contractDate: string; vehiclePlate?: string | null;
        status: 'active' | 'accepted' | 'annulled' | 'error'; notes?: string | null;
      };
    }) => unwrap(await apiInvoke<ServerEnvelope<{
      draft: SesContractDraft;
      officialClearance: { status: 'clear' | 'blocked' | 'review'; clear: boolean; reasons: string[] };
      checkedAt: string;
    }>>('ses/official-check', { body: input })),
    onSuccess: (result) => {
      invalidate();
      const label = result.officialClearance.status === 'clear' ? 'sin coincidencias'
        : result.officialClearance.status === 'blocked' ? 'ya comunicada' : 'requiere revisión';
      toast.success(`Comprobación oficial registrada: ${label}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revalidateMutation = useMutation({
    mutationFn: async (ids: string[]) => unwrap(await apiInvoke<ServerEnvelope<{
      results: Array<{ draft: SesContractDraft; issues: unknown[] }>;
      rentlyCandidates: number;
      intersectionMatches: number;
    }>>('ses/revalidate', { body: { ids }, timeoutMs: 120_000 })),
    onSuccess: (result) => {
      invalidate();
      toast.success(`${result.results.length} contrato(s) revalidados contra la lista exacta de Rently`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createEligibilityExceptionMutation = useMutation({
    mutationFn: async (input: { draftId: string; protocolReference: string; reason: string; expiresAt: string }) =>
      unwrap(await apiInvoke<ServerEnvelope<{ exception: SesEligibilityException }>>(
        'ses/eligibility-exceptions/create', { body: input },
      )),
    onSuccess: () => { invalidate(); toast.success('Excepción manual temporal registrada y auditada'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeEligibilityExceptionMutation = useMutation({
    mutationFn: async (input: { exceptionId: string; reason: string }) =>
      unwrap(await apiInvoke<ServerEnvelope<{ exception: SesEligibilityException }>>(
        'ses/eligibility-exceptions/revoke', { body: input },
      )),
    onSuccess: () => { invalidate(); toast.success('Excepción manual revocada'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportXmlMutation = useMutation({
    mutationFn: async (ids: string[]) => unwrap(await apiInvoke<ServerEnvelope<{
      batchId: string; fileName: string; xml: string; xmlHash: string; itemCount: number;
      documentVersion: string; validationMode: 'official_contract';
      validationVersion: string; validationHash: string; xsdVersion: string | null; xsdHash: string | null;
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
      toast.success(`XML validado localmente y descargado con ${result.itemCount} contrato(s)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markBatchUploadedMutation = useMutation({
    mutationFn: async (input: { batchId: string; officialLotCode: string; notes?: string | null }) =>
      unwrap(await apiInvoke<ServerEnvelope<SesBatch>>('ses/batches/uploaded', { body: input })),
    onSuccess: () => { invalidate(); invalidateBatches(); toast.success('Acuse de subida registrado'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const recordBatchResultMutation = useMutation({
    mutationFn: async (input: {
      batchId: string;
      accepted: Array<{ draftId: string; officialCommunicationCode: string }>;
      errors: Array<{ draftId: string; code?: string | null; message: string }>;
      notes?: string | null;
    }) => unwrap(await apiInvoke<ServerEnvelope<SesBatch>>('ses/batches/result', { body: input })),
    onSuccess: () => { invalidate(); invalidateBatches(); queryClient.invalidateQueries({ queryKey: ['ses-official-inventory'] }); toast.success('Resultado del lote conciliado'); },
    onError: (error: Error) => toast.error(error.message),
  });

  const searchMunicipalities = async (query: string, provinceCode?: string) =>
    unwrap(await apiInvoke<ServerEnvelope<SesMunicipality[]>>('ses/municipalities', { body: { query, ...(provinceCode ? { provinceCode } : {}) } }));

  return {
    drafts: draftsQuery.data?.drafts ?? [], summary: draftsQuery.data?.summary ?? {},
    total: draftsQuery.data?.total ?? 0, pageCount: draftsQuery.data?.pageCount ?? 0,
    isLoading: draftsQuery.isLoading, refetch: draftsQuery.refetch,
    settings: settingsQuery.data ?? null, settingsLoading: settingsQuery.isLoading,
    batches: batchesQuery.data ?? [], batchesLoading: batchesQuery.isLoading,
    schemaMigrationRequired: Boolean(
      draftsQuery.data?.schemaMigrationRequired
      || settingsQuery.data?.schema_migration_required
    ),
    readError: draftsQuery.error ?? settingsQuery.error ?? batchesQuery.error ?? null,
    syncAll: syncAllMutation,
    prepare: prepareMutation, updatePerson: updatePersonMutation, createPerson: createPersonMutation,
    updateDraft: updateDraftMutation, updateLocation: updateLocationMutation,
    updateSettings: updateSettingsMutation, uploadXsd: uploadXsdMutation,
    checkOfficialCommunication: checkOfficialCommunicationMutation,
    revalidate: revalidateMutation,
    createEligibilityException: createEligibilityExceptionMutation,
    revokeEligibilityException: revokeEligibilityExceptionMutation,
    exportXml: exportXmlMutation,
    markBatchUploaded: markBatchUploadedMutation, recordBatchResult: recordBatchResultMutation,
    searchMunicipalities,
  };
}
