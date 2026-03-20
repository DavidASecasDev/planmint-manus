import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TransferRequestNote } from '@/types/transferNotes';

/**
 * Hook for managing internal notes on a transfer request.
 * Works for both broker portal and admin panel.
 */
export function useTransferNotes(requestId: string | undefined) {
  const queryClient = useQueryClient();

  const queryKey = ['transfer-request-notes', requestId];

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await (supabase as any)
        .from('transfer_request_notes')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as TransferRequestNote[];
    },
    enabled: !!requestId,
  });

  const addNote = useMutation({
    mutationFn: async ({
      organizationId,
      brokerId,
      authorName,
      text,
    }: {
      organizationId: string;
      brokerId: string | null;
      authorName: string;
      text: string;
    }) => {
      if (!requestId) throw new Error('No request ID');

      const { data, error } = await (supabase as any)
        .from('transfer_request_notes')
        .insert({
          request_id: requestId,
          organization_id: organizationId,
          broker_id: brokerId,
          author_name: authorName,
          text: text.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as TransferRequestNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast.error(`Error al añadir nota: ${error.message}`);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await (supabase as any)
        .from('transfer_request_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar nota: ${error.message}`);
    },
  });

  return {
    notes,
    isLoading,
    addNote: addNote.mutateAsync,
    isAdding: addNote.isPending,
    deleteNote: deleteNote.mutateAsync,
    isDeleting: deleteNote.isPending,
  };
}
