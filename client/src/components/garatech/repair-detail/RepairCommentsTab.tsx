import { useState } from 'react';
import { Send, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRepairComments } from '@/hooks/useRepairComments';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepairCommentsTabProps {
  repairId: string;
}

export function RepairCommentsTab({ repairId }: RepairCommentsTabProps) {
  const { profile } = useAuth();
  const { comments, isLoading, addComment, deleteComment } = useRepairComments(repairId);
  const [newComment, setNewComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    await addComment.mutateAsync(newComment.trim());
    setNewComment('');
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Comment Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Añadir un comentario..."
          className="min-h-[60px] resize-none"
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={!newComment.trim() || addComment.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No hay comentarios todavía</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(comment.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.user?.name || 'Usuario'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.created_at), "d MMM 'a las' HH:mm", { locale: es })}
                  </span>
                  {comment.user_id === profile?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteComment.mutateAsync(comment.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{comment.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
