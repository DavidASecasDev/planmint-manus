import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ScheduleNote {
  id: string;
  user_id: string;
  date: string;
  content: string;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
}

export interface ScheduleNoteHistoryEntry {
  id: string;
  note_id: string;
  content: string;
  action: 'created' | 'updated' | 'deleted';
  changed_by: string;
  changed_by_name: string | null;
  created_at: string;
}

/**
 * Hook to manage schedule notes for a given week.
 * Returns a lookup map (user_id:date -> note), plus upsert/delete mutations.
 */
export function useScheduleNotes({
  weekStart,
  weekEnd,
  enabled,
}: {
  weekStart: string;
  weekEnd: string;
  enabled: boolean;
}) {
  const { profile, sessionReady } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: notes = [] } = useQuery({
    queryKey: ['schedule-notes', orgId, weekStart, weekEnd],
    queryFn: async (): Promise<ScheduleNote[]> => {
      if (!orgId) return [];
      const res = await apiInvoke<{ ok: boolean; data: ScheduleNote[] }>('get-schedule-notes', {
        body: { start_date: weekStart, end_date: weekEnd },
      });
      if (res.error || !res.data?.ok) return [];
      return res.data.data || [];
    },
    enabled: !!orgId && sessionReady && enabled,
    staleTime: 30_000,
  });

  // Key: "user_id:date" → ScheduleNote (per-cell lookup)
  const noteLookup = useMemo(() => {
    const map = new Map<string, ScheduleNote>();
    for (const n of notes) {
      const key = `${n.user_id}:${n.date}`;
      map.set(key, n);
    }
    return map;
  }, [notes]);

  const upsertNote = useMutation({
    mutationFn: async ({ date, content, user_id }: { date: string; content: string; user_id: string }) => {
      const res = await apiInvoke<{ ok: boolean }>('upsert-schedule-note', {
        body: { date, content, user_id },
      });
      if (res.error) throw new Error(res.error.message || 'Error al guardar nota');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-notes', orgId] });
      queryClient.invalidateQueries({ queryKey: ['schedule-note-history'] });
      toast.success('Nota guardada');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async ({ noteId }: { noteId: string }) => {
      const res = await apiInvoke<{ ok: boolean }>('delete-schedule-note', {
        body: { note_id: noteId },
      });
      if (res.error) throw new Error(res.error.message || 'Error al eliminar nota');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-notes', orgId] });
      queryClient.invalidateQueries({ queryKey: ['schedule-note-history'] });
      toast.success('Nota eliminada');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    noteLookup,
    notes,
    upsertNote,
    deleteNote,
  };
}

/**
 * Hook to fetch note history for a specific note.
 */
export function useScheduleNoteHistory(noteId: string | null) {
  const { profile, sessionReady } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['schedule-note-history', noteId],
    queryFn: async (): Promise<ScheduleNoteHistoryEntry[]> => {
      if (!noteId) return [];
      const res = await apiInvoke<{ ok: boolean; data: ScheduleNoteHistoryEntry[] }>('get-schedule-note-history', {
        body: { note_id: noteId },
      });
      if (res.error || !res.data?.ok) return [];
      return res.data.data || [];
    },
    enabled: !!noteId && !!orgId && sessionReady,
    staleTime: 30_000,
  });
}
