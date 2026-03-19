import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TaskUpdateWithUser, UpdateType, TaskUpdateImage } from '@/types/updates';

interface CreateTimelineUpdateData {
  task_id: string;
  type: UpdateType;
  text: string;
  mentionedUserIds?: string[];
  images?: File[];
}

// Helper function to create mention notifications
async function createMentionNotifications(
  updateId: string,
  taskId: string,
  mentionedUserIds: string[],
  currentUserId: string,
  organizationId: string,
  text: string
) {
  // Get task title
  const { data: task } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', taskId)
    .maybeSingle();

  for (const userId of mentionedUserIds) {
    // Don't notify yourself
    if (userId === currentUserId) continue;

    await supabase.from('notifications').insert({
      organization_id: organizationId,
      user_id: userId,
      type: 'mention',
      title: 'Te mencionaron en una tarea',
      body: text?.substring(0, 180) || `En tarea: ${task?.title || 'Sin título'}`,
      entity_type: 'task_update',
      entity_id: updateId,
    });
  }
}

// Helper function to upload images to storage
async function uploadImages(
  files: File[],
  updateId: string,
  userId: string
): Promise<TaskUpdateImage[]> {
  const uploadedImages: TaskUpdateImage[] = [];

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `${userId}/${updateId}/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from('task-update-images')
      .upload(storagePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      continue;
    }

    // Insert record into task_update_images
    const { data: imageRecord, error: insertError } = await supabase
      .from('task_update_images')
      .insert({
        update_id: updateId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
      })
      .select('id, storage_path, file_name, file_size')
      .single();

    if (insertError) {
      console.error('Error inserting image record:', insertError);
      // Try to clean up the uploaded file
      await supabase.storage.from('task-update-images').remove([storagePath]);
      continue;
    }

    uploadedImages.push(imageRecord);
  }

  return uploadedImages;
}

export function useTimeline(taskId: string | null) {
  const { user, profile } = useAuth();
  const [updates, setUpdates] = useState<TaskUpdateWithUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUpdates = useCallback(async () => {
    if (!taskId) {
      setUpdates([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_updates')
        .select(`
          *,
          profiles:user_id(id, name),
          task_update_mentions(
            id,
            mentioned_user_id,
            mentioned_user:mentioned_user_id(id, name)
          ),
          task_update_images(id, storage_path, file_name, file_size)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUpdates: TaskUpdateWithUser[] = (data || []).map((u: any) => ({
        id: u.id,
        task_id: u.task_id,
        user_id: u.user_id,
        text: u.text,
        type: u.type as UpdateType,
        goal_increment_value: u.goal_increment_value,
        created_at: u.created_at,
        user: u.profiles,
        mentions: u.task_update_mentions?.map((m: any) => ({
          id: m.id,
          mentioned_user_id: m.mentioned_user_id,
          mentioned_user: m.mentioned_user,
        })) || [],
        images: u.task_update_images || [],
      }));

      setUpdates(formattedUpdates);
    } catch (error: any) {
      console.error('Error fetching timeline:', error);
      toast.error('Error al cargar las actualizaciones');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const addUpdate = async (data: CreateTimelineUpdateData): Promise<boolean> => {
    if (!user?.id || !profile?.organization_id) {
      toast.error('No se pudo añadir la actualización');
      return false;
    }

    try {
      // Insert the update
      const { data: newUpdate, error: updateError } = await supabase
        .from('task_updates')
        .insert({
          task_id: data.task_id,
          user_id: user.id,
          text: data.text || null,
          type: data.type,
          goal_increment_value: null,
        })
        .select('id')
        .single();

      if (updateError) throw updateError;

      // Upload images if any
      if (data.images && data.images.length > 0 && newUpdate) {
        const uploadedImages = await uploadImages(data.images, newUpdate.id, user.id);
        if (uploadedImages.length < data.images.length) {
          toast.warning('Algunas imágenes no se pudieron subir');
        }
      }

      // Insert mentions if any
      if (data.mentionedUserIds && data.mentionedUserIds.length > 0 && newUpdate) {
        const mentionInserts = data.mentionedUserIds.map((userId) => ({
          update_id: newUpdate.id,
          mentioned_user_id: userId,
        }));

        const { error: mentionError } = await supabase
          .from('task_update_mentions')
          .insert(mentionInserts);

        if (mentionError) {
          console.error('Error inserting mentions:', mentionError);
        } else {
          // Create notifications for mentions
          await createMentionNotifications(
            newUpdate.id,
            data.task_id,
            data.mentionedUserIds,
            user.id,
            profile.organization_id,
            data.text
          );
        }
      }

      toast.success('Actualización añadida');
      await fetchUpdates();
      return true;
    } catch (error: any) {
      console.error('Error adding update:', error);
      toast.error('Error al añadir la actualización');
      return false;
    }
  };

  const deleteUpdate = async (updateId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // First, get the images to delete from storage
      const { data: images } = await supabase
        .from('task_update_images')
        .select('storage_path')
        .eq('update_id', updateId);

      // Delete the update (this will cascade delete task_update_images records)
      const { error } = await supabase
        .from('task_updates')
        .delete()
        .eq('id', updateId);

      if (error) throw error;

      // Delete the actual files from storage
      if (images && images.length > 0) {
        const paths = images.map(img => img.storage_path);
        await supabase.storage.from('task-update-images').remove(paths);
      }

      toast.success('Actualización eliminada');
      await fetchUpdates();
      return true;
    } catch (error: any) {
      console.error('Error deleting update:', error);
      toast.error('Error al eliminar la actualización');
      return false;
    }
  };

  return {
    updates,
    loading,
    fetchUpdates,
    addUpdate,
    deleteUpdate,
  };
}
