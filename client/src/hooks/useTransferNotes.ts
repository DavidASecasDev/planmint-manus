import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { toast } from 'sonner';
import type { TransferRequestNote } from '@/types/transferNotes';

/**
 * Hook for managing internal notes on a transfer request.
 * Works for both broker portal and admin panel.
 * Automatically dispatches in-app notifications to other org members when a note is added.
 */
export function useTransferNotes(requestId: string | undefined) {
  const queryClient = useQueryClient();

  const queryKey = ['transfer-request-notes', requestId];

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabaseQuery
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

      const { data, error } = await supabaseQuery
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

      // Dispatch notifications to other org members (fire-and-forget)
      dispatchNoteNotifications({
        requestId,
        organizationId,
        authorBrokerId: brokerId,
        authorName,
        noteText: text.trim(),
      }).catch(() => {
        // Silent fail — notification dispatch should never block the note creation
      });

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
      const { error } = await supabaseQuery
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

/**
 * Dispatch in-app notifications to all brokers and admin users in the organization,
 * excluding the author of the note.
 */
async function dispatchNoteNotifications({
  requestId,
  organizationId,
  authorBrokerId,
  authorName,
  noteText,
}: {
  requestId: string;
  organizationId: string;
  authorBrokerId: string | null;
  authorName: string;
  noteText: string;
}) {
  // Get the request's client name for context
  const { data: request } = await (supabase as any)
    .from('transfer_requests')
    .select('client_name')
    .eq('id', requestId)
    .single();

  const clientName = request?.client_name || 'Solicitud';
  const truncatedNote = noteText.length > 100 ? noteText.substring(0, 100) + '...' : noteText;

  // Collect all user_ids to notify:
  // 1. All brokers in the org (except the author)
  // 2. All admin/owner profiles in the org

  const recipientUserIds = new Set<string>();

  // Get broker user_ids
  const { data: brokers } = await supabaseQuery
    .from('transfer_brokers')
    .select('id, user_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (brokers) {
    for (const b of brokers) {
      // Skip the author broker
      if (authorBrokerId && b.id === authorBrokerId) continue;
      if (b.user_id) recipientUserIds.add(b.user_id);
    }
  }

  // Get admin/owner user_ids
  const { data: admins } = await supabaseQuery
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .in('role', ['admin', 'owner']);

  if (admins) {
    for (const a of admins) {
      // Skip if the admin is also the author (when admin posts a note, brokerId is null
      // but we can check by seeing if this admin's user_id matches the current auth user)
      recipientUserIds.add(a.id);
    }
  }

  // Remove the current authenticated user (the note author) from recipients
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser?.id) {
    recipientUserIds.delete(currentUser.id);
  }

  if (recipientUserIds.size === 0) return;

  // Batch insert notifications
  const notifications = Array.from(recipientUserIds).map((userId) => ({
    organization_id: organizationId,
    user_id: userId,
    type: 'transfer_note',
    title: `Nueva nota en "${clientName}"`,
    body: `${authorName}: ${truncatedNote}`,
    entity_type: 'transfer_request',
    entity_id: requestId,
    is_read: false,
  }));

  await supabaseQuery.from('notifications').insert(notifications);
}
