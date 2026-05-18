import { useState, useCallback, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Loader2, Trash2, History, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleNote, ScheduleNoteHistoryEntry } from '@/hooks/useScheduleNotes';
import { useScheduleNoteHistory } from '@/hooks/useScheduleNotes';

interface CellNoteIndicatorProps {
  date: string;
  userId: string;
  note: ScheduleNote | null;
  canManageNotes: boolean;
  onSave: (date: string, content: string, userId: string) => void;
  onDelete: (noteId: string) => void;
  isSaving: boolean;
}

/**
 * Excel-style note indicator: small triangle in top-right corner of cell.
 * - Hover: tooltip shows note content
 * - Click: popover opens for editing/creating/deleting
 * - Only visible to users with manage_notes permission
 */
export function CellNoteIndicator({
  date,
  userId,
  note,
  canManageNotes,
  onSave,
  onDelete,
  isSaving,
}: CellNoteIndicatorProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(note?.content || '');
  const [showHistory, setShowHistory] = useState(false);

  // Sync content when note changes
  useEffect(() => {
    if (!open) {
      setContent(note?.content || '');
      setShowHistory(false);
    }
  }, [note?.content, open]);

  const handleSave = useCallback(() => {
    onSave(date, content, userId);
    setOpen(false);
  }, [date, content, userId, onSave]);

  const handleDelete = useCallback(() => {
    if (note) {
      onDelete(note.id);
      setOpen(false);
    }
  }, [note, onDelete]);

  const hasNote = !!note && !!note.content;
  const isDirty = content.trim() !== (note?.content || '').trim();

  if (!canManageNotes) return null;

  // The triangle indicator (always rendered, positioned absolute in parent)
  const triangle = (
    <div
      className={cn(
        "absolute top-0 right-0 w-0 h-0 z-[2] cursor-pointer transition-all",
        // CSS triangle: top-right corner
        "border-t-[8px] border-r-[8px] border-b-0 border-l-0",
        "border-l-transparent border-b-transparent",
        hasNote
          ? "border-t-red-500 border-r-red-500"
          : "border-t-transparent border-r-transparent group-hover/cell:border-t-amber-400/60 group-hover/cell:border-r-amber-400/60"
      )}
      style={{ borderStyle: 'solid' }}
    />
  );

  // Tooltip wrapping the triangle for hover preview
  const triangleWithTooltip = hasNote ? (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        {triangle}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[220px] p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs whitespace-pre-wrap leading-relaxed">{note!.content}</p>
        {note!.updated_by_name && (
          <p className="text-[10px] text-muted-foreground mt-1.5 pt-1 border-t border-border/30">
            {note!.updated_by_name} &middot; {new Date(note!.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  ) : triangle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="absolute top-0 right-0 w-3 h-3 z-[3] cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {triangleWithTooltip}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        align="end"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => {
          // Don't close when clicking the shift popover trigger
          e.preventDefault();
        }}
      >
        <div className="space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              Nota — {new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
            {hasNote && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowHistory(!showHistory)}
                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <History className="h-3 w-3 mr-0.5" />
                {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
          </div>

          {/* Editor */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Escribe una nota..."
            className="text-sm resize-none min-h-[60px]"
            autoFocus
          />

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || (!isDirty && hasNote) || (!content.trim() && !hasNote)}
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

          {/* Author info */}
          {note?.updated_by_name && (
            <p className="text-[10px] text-muted-foreground">
              Última edición: {note.updated_by_name}
            </p>
          )}

          {/* History section */}
          {showHistory && note && (
            <NoteHistorySection noteId={note.id} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Note History Section ──────────────────────────────────────────────────

function NoteHistorySection({ noteId }: { noteId: string }) {
  const { data: history = [], isLoading } = useScheduleNoteHistory(noteId);

  if (isLoading) {
    return (
      <div className="pt-2 border-t border-border/30">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Cargando historial...
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="pt-2 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground">Sin historial</p>
      </div>
    );
  }

  const ACTION_LABELS: Record<string, string> = {
    created: 'Creada',
    updated: 'Editada',
    deleted: 'Eliminada',
  };

  const ACTION_COLORS: Record<string, string> = {
    created: 'text-emerald-600',
    updated: 'text-blue-600',
    deleted: 'text-red-600',
  };

  return (
    <div className="pt-2 border-t border-border/30">
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
        <History className="h-3 w-3" />
        Historial ({history.length})
      </p>
      <ScrollArea className="max-h-[140px]">
        <div className="space-y-1.5">
          {history.map((entry) => (
            <div key={entry.id} className="flex gap-2 text-[10px]">
              {/* Timeline dot */}
              <div className="flex flex-col items-center pt-1">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  entry.action === 'created' ? 'bg-emerald-500' :
                  entry.action === 'updated' ? 'bg-blue-500' :
                  'bg-red-500'
                )} />
                <div className="w-px flex-1 bg-border/40 mt-0.5" />
              </div>
              {/* Content */}
              <div className="flex-1 pb-1.5">
                <div className="flex items-center gap-1">
                  <span className={cn("font-medium", ACTION_COLORS[entry.action] || 'text-muted-foreground')}>
                    {ACTION_LABELS[entry.action] || entry.action}
                  </span>
                  <span className="text-muted-foreground">
                    por {entry.changed_by_name || 'Desconocido'}
                  </span>
                </div>
                {entry.content && entry.action !== 'deleted' && (
                  <p className="text-muted-foreground/70 truncate max-w-[200px] mt-0.5">
                    &ldquo;{entry.content.length > 60 ? entry.content.slice(0, 60) + '...' : entry.content}&rdquo;
                  </p>
                )}
                <p className="text-muted-foreground/50 mt-0.5">
                  {new Date(entry.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
