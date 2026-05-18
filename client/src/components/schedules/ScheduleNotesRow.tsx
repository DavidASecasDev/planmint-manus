import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StickyNote, Save, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ScheduleNote {
  id: string;
  date: string;
  content: string;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
}

interface ScheduleNotesRowProps {
  weekDates: Date[];
  canManageNotes: boolean;
}

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function ScheduleNotesRow({ weekDates, canManageNotes }: ScheduleNotesRowProps) {
  const { profile, sessionReady } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const weekStart = formatDateISO(weekDates[0]);
  const weekEnd = formatDateISO(weekDates[6]);

  // Fetch notes for the week
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
    enabled: !!orgId && sessionReady && canManageNotes,
    staleTime: 30_000,
  });

  // Build lookup: date -> note
  const noteLookup = useMemo(() => {
    const map = new Map<string, ScheduleNote>();
    for (const n of notes) {
      map.set(n.date, n);
    }
    return map;
  }, [notes]);

  if (!canManageNotes) return null;

  return (
    <tr className="bg-amber-50/40 dark:bg-amber-950/10 border-t border-amber-200/40">
      {/* Label cell */}
      <td className="sticky left-0 z-10 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-1.5 border-r border-border/30">
        <div className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Notas</span>
        </div>
      </td>
      {/* Note cells per day */}
      {weekDates.map(d => {
        const dateStr = formatDateISO(d);
        const note = noteLookup.get(dateStr);
        const today = isToday(d);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        return (
          <NoteCell
            key={dateStr}
            date={dateStr}
            note={note || null}
            today={today}
            isWeekend={isWeekend}
            orgId={orgId || undefined}
          />
        );
      })}
      {/* Empty hours column */}
      <td className="px-3 py-1.5 border-l border-border/30 bg-muted/10" />
    </tr>
  );
}

// ─── Individual Note Cell ─────────────────────────────────────────────────

interface NoteCellProps {
  date: string;
  note: ScheduleNote | null;
  today: boolean;
  isWeekend: boolean;
  orgId: string | undefined;
}

function NoteCell({ date, note, today, isWeekend, orgId }: NoteCellProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(note?.content || '');

  // Sync content when note changes (e.g., after refetch)
  useEffect(() => {
    if (!open) {
      setContent(note?.content || '');
    }
  }, [note?.content, open]);

  const upsertMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const res = await apiInvoke<{ ok: boolean }>('upsert-schedule-note', {
        body: { date, content: newContent },
      });
      if (res.error) throw new Error(res.error.message || 'Error al guardar nota');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-notes', orgId] });
      toast.success('Nota guardada');
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!note) return;
      const res = await apiInvoke<{ ok: boolean }>('delete-schedule-note', {
        body: { note_id: note.id },
      });
      if (res.error) throw new Error(res.error.message || 'Error al eliminar nota');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-notes', orgId] });
      toast.success('Nota eliminada');
      setContent('');
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSave = useCallback(() => {
    upsertMutation.mutate(content);
  }, [content, upsertMutation]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate();
  }, [deleteMutation]);

  const hasNote = !!note && !!note.content;
  const isDirty = content.trim() !== (note?.content || '').trim();
  const isSaving = upsertMutation.isPending || deleteMutation.isPending;

  return (
    <td
      className={cn(
        "px-1 py-1 text-center border-border/20",
        today && "bg-primary/5",
        isWeekend && !today && "bg-muted/20"
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {hasNote ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "w-full min-h-[28px] rounded-md text-[11px] font-medium transition-all px-1.5 py-1",
                    "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
                    "border border-amber-200/60 dark:border-amber-700/40",
                    "hover:bg-amber-200/70 dark:hover:bg-amber-900/50 hover:shadow-sm",
                    "line-clamp-2 text-left leading-tight"
                  )}
                >
                  {note!.content.length > 40 ? note!.content.slice(0, 40) + '...' : note!.content}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[250px]">
                <p className="text-xs whitespace-pre-wrap">{note!.content}</p>
                {note!.updated_by_name && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    — {note!.updated_by_name}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              className={cn(
                "w-full min-h-[28px] rounded-md text-xs transition-all",
                "text-muted-foreground/30 hover:text-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-950/20"
              )}
            >
              <StickyNote className="h-3 w-3 mx-auto" />
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="center" side="bottom">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Nota del {new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Escribe una nota..."
              className="text-sm resize-none min-h-[60px]"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || (!isDirty && hasNote)}
                className="flex-1 h-7 text-xs"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Guardar
              </Button>
              {hasNote && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {note?.updated_by_name && (
              <p className="text-[10px] text-muted-foreground">
                Última edición: {note.updated_by_name}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </td>
  );
}
