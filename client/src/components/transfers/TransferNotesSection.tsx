import { useState } from 'react';
import { useTransferNotes } from '@/hooks/useTransferNotes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TransferNotesSectionProps {
  requestId: string;
  organizationId: string;
  currentBrokerId: string | null;
  currentAuthorName: string;
  isDark: boolean;
}

export function TransferNotesSection({
  requestId,
  organizationId,
  currentBrokerId,
  currentAuthorName,
  isDark,
}: TransferNotesSectionProps) {
  const { notes, isLoading, addNote, isAdding, deleteNote, isDeleting } = useTransferNotes(requestId);
  const [newNote, setNewNote] = useState('');

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const headerBg = isDark ? '#0f172a' : '#f8fafc';
  const titleColor = isDark ? '#93c5fd' : '#1a365d';
  const textPrimary = isDark ? '#e2e8f0' : '#111827';
  const textSecondary = isDark ? '#94a3b8' : '#6b7280';
  const textMuted = isDark ? '#64748b' : '#9ca3af';
  const dividerColor = isDark ? '#334155' : '#e2e8f0';
  const noteBg = isDark ? '#0f172a' : '#f1f5f9';
  const ownNoteBg = isDark ? '#1a2744' : '#eff6ff';
  const inputStyle = !isDark
    ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d1d5db' }
    : { backgroundColor: '#0f172a', color: '#e2e8f0', borderColor: '#334155' };

  const handleSubmit = async () => {
    if (!newNote.trim()) return;
    try {
      await addNote({
        organizationId,
        brokerId: currentBrokerId,
        authorName: currentAuthorName,
        text: newNote,
      });
      setNewNote('');
    } catch {
      // Error handled by hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canDelete = (noteBrokerId: string | null) => {
    // Broker can delete their own notes
    return currentBrokerId && noteBrokerId === currentBrokerId;
  };

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: headerBg, borderBottom: `1px solid ${dividerColor}` }}
      >
        <MessageSquare className="h-4 w-4" style={{ color: titleColor }} />
        <span className="font-medium" style={{ color: titleColor }}>
          Notas Internas
        </span>
        {notes.length > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: isDark ? '#b8860b35' : '#b8860b20',
              color: isDark ? '#d4a017' : '#7a5c08',
            }}
          >
            {notes.length}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Notes list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: textMuted }} />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: textMuted, opacity: 0.5 }} />
            <p className="text-sm" style={{ color: textMuted }}>
              No hay notas todavía. Añade un comentario para tu equipo.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {notes.map((note) => {
              const isOwn = currentBrokerId && note.broker_id === currentBrokerId;
              return (
                <div
                  key={note.id}
                  className="rounded-lg p-3 group"
                  style={{
                    backgroundColor: isOwn ? ownNoteBg : noteBg,
                    borderLeft: isOwn ? '3px solid #b8860b' : '3px solid transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: textPrimary }}>
                          {note.author_name}
                        </span>
                        {isOwn && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: isDark ? '#b8860b35' : '#b8860b20',
                              color: isDark ? '#d4a017' : '#7a5c08',
                            }}
                          >
                            tú
                          </span>
                        )}
                        <span className="text-xs" style={{ color: textMuted }}>
                          {formatDistanceToNow(new Date(note.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      <p
                        className="text-sm whitespace-pre-wrap break-words"
                        style={{ color: textSecondary }}
                      >
                        {note.text}
                      </p>
                    </div>
                    {canDelete(note.broker_id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 flex-shrink-0"
                        onClick={() => deleteNote(note.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New note input */}
        <div
          className="pt-3"
          style={{ borderTop: `1px solid ${dividerColor}` }}
        >
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una nota interna..."
            rows={2}
            className="resize-none"
            style={inputStyle}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs" style={{ color: textMuted }}>
              Ctrl+Enter para enviar
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newNote.trim() || isAdding}
              style={{
                backgroundColor: newNote.trim() ? '#b8860b' : undefined,
                color: newNote.trim() ? 'white' : undefined,
              }}
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
