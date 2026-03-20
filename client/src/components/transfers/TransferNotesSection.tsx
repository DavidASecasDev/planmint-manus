import { useState } from 'react';
import { useTransferNotes } from '@/hooks/useTransferNotes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/*
 * Azul Cars Brand – Transfer Notes Section
 * Card: #FFFFFF | Navy: #001321 | Gold: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */

const navy = '#001321';
const gold = 'oklch(0.72 0.10 80)';

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
}: TransferNotesSectionProps) {
  const { notes, isLoading, addNote, isAdding, deleteNote, isDeleting } = useTransferNotes(requestId);
  const [newNote, setNewNote] = useState('');

  const cardBg = '#FFFFFF';
  const cardBorder = '#E5E2DB';
  const headerBg = '#FAFAF8';
  const textPrimary = '#111827';
  const textSecondary = '#6B7280';
  const textMuted = '#9CA3AF';

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
    return currentBrokerId && noteBrokerId === currentBrokerId;
  };

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: headerBg, borderBottom: `1px solid ${cardBorder}` }}
      >
        <MessageSquare className="h-4 w-4" style={{ color: textMuted }} />
        <span
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: textMuted,
          }}
        >
          Notas Internas
        </span>
        {notes.length > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(0,19,33,0.08)',
              color: navy,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '10px',
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
            <p className="text-sm" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
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
                    backgroundColor: isOwn ? '#F0F4FF' : '#F5F3EF',
                    borderLeft: isOwn ? `3px solid ${navy}` : '3px solid transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm"
                          style={{ color: textPrimary, fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
                        >
                          {note.author_name}
                        </span>
                        {isOwn && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgba(0,19,33,0.08)',
                              color: navy,
                              fontFamily: 'Montserrat, sans-serif',
                              fontWeight: 700,
                            }}
                          >
                            tú
                          </span>
                        )}
                        <span className="text-xs" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
                          {formatDistanceToNow(new Date(note.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      <p
                        className="text-sm whitespace-pre-wrap break-words"
                        style={{ color: textSecondary, fontFamily: 'Barlow, sans-serif' }}
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
        <div className="pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una nota interna..."
            rows={2}
            className="resize-none"
            style={{
              backgroundColor: '#FFFFFF',
              color: textPrimary,
              borderColor: cardBorder,
              fontFamily: 'Barlow, sans-serif',
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs" style={{ color: textMuted, fontFamily: 'Barlow, sans-serif' }}>
              Ctrl+Enter para enviar
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newNote.trim() || isAdding}
              className="gap-1"
              style={{
                backgroundColor: newNote.trim() ? navy : undefined,
                color: newNote.trim() ? 'white' : undefined,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
