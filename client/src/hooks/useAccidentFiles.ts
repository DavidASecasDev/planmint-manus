import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import type { AccidentFile, AccidentFileType, AccidentFileCategory } from '@/types/garatech';

export function useAccidentFiles(accidentId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const filesQuery = useQuery({
    queryKey: ['accident-files', accidentId],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('accident_files')
        .select(`
          *,
          uploader:profiles!accident_files_uploaded_by_fkey(name)
        `)
        .eq('accident_id', accidentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as AccidentFile[];
    },
    enabled: !!accidentId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, fileType, fileCategory, description }: {
      file: File;
      fileType: AccidentFileType;
      fileCategory: AccidentFileCategory;
      description?: string;
    }) => {
      if (!orgId || !profile?.id) throw new Error('No organization');

      // Compress images; skip documents/PDFs
      let uploadFile: File = file;
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
        uploadFile = compressed.file;
      }

      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `${orgId}/accidents/${accidentId}/${fileType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('repair-files')
        .upload(storagePath, uploadFile);

      if (uploadError) throw uploadError;

      const { data, error } = await supabaseQuery
        .from('accident_files')
        .insert({
          accident_id: accidentId,
          organization_id: orgId,
          file_type: fileType,
          file_category: fileCategory,
          storage_path: storagePath,
          file_name: file.name,
          description,
          uploaded_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accident-files', accidentId] });
      toast.success('Archivo subido correctamente');
    },
    onError: () => toast.error('Error al subir el archivo'),
  });

  const deleteFile = useMutation({
    mutationFn: async (fileRecord: AccidentFile) => {
      await supabase.storage.from('repair-files').remove([fileRecord.storage_path]);
      const { error } = await supabaseQuery.from('accident_files').delete().eq('id', fileRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accident-files', accidentId] });
      toast.success('Archivo eliminado');
    },
    onError: () => toast.error('Error al eliminar el archivo'),
  });

  const getSignedUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('repair-files')
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  const photos = filesQuery.data?.filter(f => f.file_type === 'photo') ?? [];
  const documents = filesQuery.data?.filter(f => f.file_type === 'document') ?? [];

  return {
    files: filesQuery.data ?? [],
    photos,
    documents,
    isLoading: filesQuery.isLoading,
    uploadFile,
    deleteFile,
    getSignedUrl,
  };
}
