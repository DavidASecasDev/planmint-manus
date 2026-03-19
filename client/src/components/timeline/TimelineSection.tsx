import { useState, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTimeline } from '@/hooks/useTimeline';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { MentionInput } from './MentionInput';
import { TimelineItem } from './TimelineItem';
import { ImageUploadPreview } from './ImageUploadPreview';
import { UPDATE_TYPE_OPTIONS, UpdateType } from '@/types/updates';
import { Skeleton } from '@/components/ui/skeleton';

interface TimelineSectionProps {
  taskId: string;
  canEdit: boolean;
  goalUnit?: string;
}

export function TimelineSection({ taskId, canEdit, goalUnit }: TimelineSectionProps) {
  const { updates, loading, fetchUpdates, addUpdate, deleteUpdate } = useTimeline(taskId);
  const { members } = useOrganizationMembers();
  
  const [updateType, setUpdateType] = useState<UpdateType>('note');
  const [text, setText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleTextChange = (value: string, userIds: string[]) => {
    setText(value);
    setMentionedUserIds(userIds);
  };

  const handleSubmit = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;

    setIsSubmitting(true);
    try {
      const success = await addUpdate({
        task_id: taskId,
        type: updateType,
        text: text.trim(),
        mentionedUserIds,
        images: selectedFiles,
      });

      if (success) {
        setText('');
        setMentionedUserIds([]);
        setSelectedFiles([]);
        setUpdateType('note');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const usersForMention = members.map(m => ({
    id: m.user_id,
    name: m.name,
  }));

  const canSubmit = text.trim().length > 0 || selectedFiles.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Actualizaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Update Form */}
        {canEdit && (
          <>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Select 
                  value={updateType} 
                  onValueChange={(v) => setUpdateType(v as UpdateType)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UPDATE_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <MentionInput
                value={text}
                onChange={handleTextChange}
                users={usersForMention}
                placeholder="Escribe una actualización... Usa @ para mencionar usuarios"
                disabled={isSubmitting}
              />

              {/* Image upload section */}
              <ImageUploadPreview
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                disabled={isSubmitting}
              />

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !canSubmit}
                size="sm"
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Añadiendo...' : 'Añadir actualización'}
              </Button>
            </div>
            <Separator />
          </>
        )}

        {/* Timeline List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg border">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : updates.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {updates.map((update) => (
              <TimelineItem
                key={update.id}
                update={update}
                canDelete={canEdit}
                onDelete={deleteUpdate}
                goalUnit={goalUnit}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay actualizaciones todavía
          </p>
        )}
      </CardContent>
    </Card>
  );
}
