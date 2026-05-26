import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LostFoundStatus = 'found' | 'contacted' | 'returned' | 'unclaimed';
export type LostFoundCategory = 'electronics' | 'clothing' | 'documents' | 'jewelry' | 'luggage' | 'keys' | 'other';

export interface LostFoundItem {
  id: string;
  organization_id: string;
  transfer_request_id: string | null;
  transfer_item_id: string | null;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  found_by: string;
  found_date: string;
  found_location: string | null;
  description: string;
  category: LostFoundCategory;
  photo_urls: string[];
  status: LostFoundStatus;
  client_name: string | null;
  client_contact: string | null;
  notes: string | null;
  returned_date: string | null;
  returned_to: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CreateLostFoundInput {
  transfer_request_id?: string | null;
  transfer_item_id?: string | null;
  vehicle_id?: string | null;
  vehicle_plate?: string | null;
  found_by: string;
  found_date: string;
  found_location?: string | null;
  description: string;
  category: LostFoundCategory;
  photo_urls?: string[];
  client_name?: string | null;
  client_contact?: string | null;
  notes?: string | null;
}

export interface UpdateLostFoundInput {
  id: string;
  transfer_request_id?: string | null;
  transfer_item_id?: string | null;
  vehicle_id?: string | null;
  vehicle_plate?: string | null;
  found_by?: string;
  found_date?: string;
  found_location?: string | null;
  description?: string;
  category?: LostFoundCategory;
  photo_urls?: string[];
  status?: LostFoundStatus;
  client_name?: string | null;
  client_contact?: string | null;
  notes?: string | null;
  returned_date?: string | null;
  returned_to?: string | null;
}

// ─── Status metadata ───────────────────────────────────────────────────────────

export const LOST_FOUND_STATUS_META: Record<LostFoundStatus, { label: string; color: string; bgColor: string }> = {
  found: { label: 'Encontrado', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  contacted: { label: 'Contactado', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  returned: { label: 'Devuelto', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  unclaimed: { label: 'No reclamado', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

export const LOST_FOUND_CATEGORY_META: Record<LostFoundCategory, { label: string; emoji: string }> = {
  electronics: { label: 'Electrónica', emoji: '📱' },
  clothing: { label: 'Ropa', emoji: '👕' },
  documents: { label: 'Documentos', emoji: '📄' },
  jewelry: { label: 'Joyería', emoji: '💍' },
  luggage: { label: 'Equipaje', emoji: '🧳' },
  keys: { label: 'Llaves', emoji: '🔑' },
  other: { label: 'Otro', emoji: '📦' },
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useLostFound() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // ─── List all items ────────────────────────────────────────────────────────
  const listQuery = useQuery({
    queryKey: ['lost-found', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('lost_found_items')
        .select('*')
        .order('found_date', { ascending: false });

      if (error) throw error;
      return (data || []) as LostFoundItem[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // ─── Get single item ──────────────────────────────────────────────────────
  const getItem = (id: string) => {
    return useQuery({
      queryKey: ['lost-found', orgId, id],
      queryFn: async () => {
        const { data, error } = await supabaseQuery
          .from('lost_found_items')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        return data as LostFoundItem;
      },
      enabled: !!orgId && !!id,
    });
  };

  // ─── Create item ──────────────────────────────────────────────────────────
  const createItem = useMutation({
    mutationFn: async (input: CreateLostFoundInput) => {
      if (!orgId || !profile?.id) throw new Error('No organization');

      const { data, error } = await supabaseQuery
        .from('lost_found_items')
        .insert({
          organization_id: orgId,
          ...input,
          photo_urls: input.photo_urls || [],
          created_by: profile.id,
          updated_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as LostFoundItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-found'] });
      toast.success('Objeto registrado correctamente');
    },
    onError: (err: Error) => {
      toast.error(`Error al registrar: ${err.message}`);
    },
  });

  // ─── Update item ──────────────────────────────────────────────────────────
  const updateItem = useMutation({
    mutationFn: async (input: UpdateLostFoundInput) => {
      if (!profile?.id) throw new Error('No user');
      const { id, ...updates } = input;

      const { data, error } = await supabaseQuery
        .from('lost_found_items')
        .update({ ...updates, updated_by: profile.id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as LostFoundItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-found'] });
      toast.success('Objeto actualizado');
    },
    onError: (err: Error) => {
      toast.error(`Error al actualizar: ${err.message}`);
    },
  });

  // ─── Delete item ──────────────────────────────────────────────────────────
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery
        .from('lost_found_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-found'] });
      toast.success('Objeto eliminado');
    },
    onError: (err: Error) => {
      toast.error(`Error al eliminar: ${err.message}`);
    },
  });

  // ─── Upload photo ─────────────────────────────────────────────────────────
  const uploadPhoto = async (file: File, itemId: string): Promise<string> => {
    if (!orgId) throw new Error('No organization');

    // Compress image
    let uploadFile: File = file;
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
      uploadFile = compressed.file;
    }

    const fileExt = uploadFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${orgId}/lost-found/${itemId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('repair-files')
      .upload(storagePath, uploadFile);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = await supabase.storage
      .from('repair-files')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

    return urlData?.signedUrl || storagePath;
  };

  // ─── Delete photo ─────────────────────────────────────────────────────────
  const deletePhoto = async (photoUrl: string) => {
    // Extract storage path from signed URL or use directly
    // The path is stored in the URL after /object/sign/repair-files/
    const match = photoUrl.match(/repair-files\/(.+?)(\?|$)/);
    if (match) {
      await supabase.storage.from('repair-files').remove([match[1]]);
    }
  };

  // ─── Pending count (for sidebar badge) ────────────────────────────────────
  const pendingCount = (listQuery.data || []).filter(
    item => item.status === 'found' || item.status === 'contacted'
  ).length;

  return {
    items: listQuery.data || [],
    isLoading: listQuery.isLoading,
    pendingCount,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    uploadPhoto,
    deletePhoto,
    refetch: listQuery.refetch,
  };
}

// Standalone hook for single item (avoids rules of hooks issue)
export function useLostFoundItem(id: string) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['lost-found', orgId, id],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('lost_found_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as LostFoundItem;
    },
    enabled: !!orgId && !!id,
  });
}
