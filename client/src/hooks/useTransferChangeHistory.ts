import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import type { TransferChangeHistoryEntry, FieldChange, ChangeType } from '@/types/transferChangeHistory';

export function useTransferChangeHistory(requestId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: changeHistory = [], isLoading } = useQuery({
    queryKey: ['transfer-change-history', requestId],
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabaseQuery
        .from('transfer_change_history')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as TransferChangeHistoryEntry[];
    },
    enabled: !!requestId,
  });

  const logChange = useMutation({
    mutationFn: async (entry: {
      request_id: string;
      organization_id: string;
      change_type: ChangeType;
      changed_by_type: 'admin' | 'broker' | 'system';
      changed_by_id?: string;
      changed_by_name?: string;
      changes: FieldChange[];
      summary?: string;
    }) => {
      const { error } = await supabaseQuery
        .from('transfer_change_history')
        .insert({
          request_id: entry.request_id,
          organization_id: entry.organization_id,
          change_type: entry.change_type,
          changed_by_type: entry.changed_by_type,
          changed_by_id: entry.changed_by_id || null,
          changed_by_name: entry.changed_by_name || null,
          changes: entry.changes,
          summary: entry.summary || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-change-history'] });
    },
  });

  return {
    changeHistory,
    isLoading,
    logChange: logChange.mutateAsync,
  };
}

/**
 * Utility: Compare two objects and return field-level changes.
 * Useful for detecting what changed between old and new request data.
 */
export function detectChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fieldLabels: Record<string, string>,
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const key of Object.keys(fieldLabels)) {
    const oldVal = oldData[key] ?? null;
    const newVal = newData[key] ?? null;

    // Normalize for comparison
    const oldStr = oldVal === '' ? null : oldVal;
    const newStr = newVal === '' ? null : newVal;

    if (JSON.stringify(oldStr) !== JSON.stringify(newStr)) {
      changes.push({
        field: key,
        label: fieldLabels[key],
        old_value: oldStr as string | number | boolean | null,
        new_value: newStr as string | number | boolean | null,
      });
    }
  }

  return changes;
}

/** Field labels for transfer request header fields */
export const REQUEST_FIELD_LABELS: Record<string, string> = {
  client_name: 'Nombre del cliente',
  client_type: 'Tipo de cliente',
  service_type: 'Tipo de servicio',
  client_reference: 'Referencia del cliente',
  associated_service: 'Servicio asociado',
  notes: 'Notas',
};

/** Field labels for transfer item fields */
export const ITEM_FIELD_LABELS: Record<string, string> = {
  transfer_date: 'Fecha',
  pickup_location: 'Recogida',
  pickup_time: 'Hora de recogida',
  dropoff_location: 'Destino',
  dropoff_time: 'Hora de destino',
  pax_count: 'Pasajeros',
  vehicle_type: 'Tipo de vehículo',
  flight_number: 'Nº vuelo/ferry',
  has_return: 'Incluye vuelta',
  return_pickup_location: 'Recogida (vuelta)',
  return_pickup_time: 'Hora recogida (vuelta)',
  return_dropoff_location: 'Destino (vuelta)',
  return_dropoff_time: 'Hora destino (vuelta)',
  pack_duration: 'Duración del pack',
  estimated_price: 'Precio estimado',
  notes: 'Notas del trayecto',
};
