import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import type { RepairPhoto, RepairPhotoType } from '@/types/garatech';

export function useRepairPhotos(repairId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const photosQuery = useQuery({
    queryKey: ['repair-photos', repairId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repair_photos')
        .select(`
          *,
          uploader:profiles!repair_photos_uploaded_by_fkey(name)
        `)
        .eq('repair_id', repairId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as RepairPhoto[];
    },
    enabled: !!repairId,
  });

  const uploadPhoto = useMutation({
    mutationFn: async ({ file, photoType, description }: { 
      file: File; 
      photoType: RepairPhotoType;
      description?: string;
    }) => {
      if (!orgId || !profile?.id) throw new Error('No organization');

      // Compress image before upload
      const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
      const compressedFile = compressed.file;

      // Upload to storage
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `${orgId}/${repairId}/${photoType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('repair-files')
        .upload(storagePath, compressedFile);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from('repair_photos')
        .insert({
          repair_id: repairId,
          organization_id: orgId,
          photo_type: photoType,
          storage_path: storagePath,
          file_name: file.name,
          description,
          uploaded_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add history entry
      await supabase.from('repair_history').insert({
        repair_id: repairId,
        organization_id: orgId,
        user_id: profile.id,
        action: 'photo_added',
        to_value: photoType,
        metadata: { photo_id: data.id, file_name: file.name },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-photos', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repair-history', repairId] });
      toast.success('Foto subida correctamente');
    },
    onError: (error) => {
      console.error('Error uploading photo:', error);
      toast.error('Error al subir la foto');
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: RepairPhoto) => {
      if (!orgId || !profile?.id) throw new Error('No organization');

      // Delete from storage
      const { error: deleteStorageError } = await supabase.storage
        .from('repair-files')
        .remove([photo.storage_path]);

      if (deleteStorageError) console.error('Storage delete error:', deleteStorageError);

      // Delete database record
      const { error } = await supabase
        .from('repair_photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      // Add history entry
      await supabase.from('repair_history').insert({
        repair_id: repairId,
        organization_id: orgId,
        user_id: profile.id,
        action: 'photo_removed',
        from_value: photo.photo_type,
        metadata: { file_name: photo.file_name },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-photos', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repair-history', repairId] });
      toast.success('Foto eliminada');
    },
    onError: (error) => {
      console.error('Error deleting photo:', error);
      toast.error('Error al eliminar la foto');
    },
  });

  const getSignedUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('repair-files')
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error) throw error;
    return data.signedUrl;
  };

  const beforePhotos = photosQuery.data?.filter(p => p.photo_type === 'before') ?? [];
  const afterPhotos = photosQuery.data?.filter(p => p.photo_type === 'after') ?? [];

  return {
    photos: photosQuery.data ?? [],
    beforePhotos,
    afterPhotos,
    isLoading: photosQuery.isLoading,
    uploadPhoto,
    deletePhoto,
    getSignedUrl,
  };
}
