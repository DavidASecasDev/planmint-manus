import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

export interface TransferInvoiceSettings {
  id: string;
  organization_id: string;
  company_name: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  quote_prefix: string;
  invoice_prefix: string;
  next_quote_number: number;
  next_invoice_number: number;
  footer_text: string | null;
  bank_details: string | null;
  margin_threshold_danger: number | null;
  margin_threshold_warning: number | null;
  created_at: string;
  updated_at: string;
}

export function useTransferInvoiceSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['transfer-invoice-settings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabaseQuery
        .from('transfer_invoice_settings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return data as TransferInvoiceSettings | null;
    },
    enabled: !!profile?.organization_id,
    staleTime: 10 * 60 * 1000, // 10 minutes - invoice settings rarely change
  });

  const saveSettings = useMutation({
    mutationFn: async (data: Partial<Omit<TransferInvoiceSettings, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { data: existing } = await supabaseQuery
        .from('transfer_invoice_settings')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabaseQuery
          .from('transfer_invoice_settings')
          .update(data)
          .eq('organization_id', profile.organization_id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabaseQuery
          .from('transfer_invoice_settings')
          .insert({
            organization_id: profile.organization_id,
            ...data,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-invoice-settings'] });
      toast.success('Configuración guardada');
    },
    onError: (error: Error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Compress logo image
      const compressed = await compressImage(file, { maxDimension: 800, quality: 0.85 });
      const compressedFile = compressed.file;

      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `invoice-logo.${fileExt}`;
      const storagePath = `${profile.organization_id}/${fileName}`;

      // Delete existing if any
      await supabase.storage
        .from('organization-assets')
        .remove([storagePath]);

      // Upload new
      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(storagePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(storagePath);

      // Save to settings
      await saveSettings.mutateAsync({ logo_url: urlData.publicUrl });

      return urlData.publicUrl;
    },
    onSuccess: () => {
      toast.success('Logo subido');
    },
    onError: (error: Error) => {
      toast.error(`Error al subir logo: ${error.message}`);
    },
  });

  const deleteLogo = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id || !settings?.logo_url) return;

      // Extract path from URL
      const urlParts = settings.logo_url.split('/organization-assets/');
      if (urlParts.length > 1) {
        const path = urlParts[1];
        await supabase.storage
          .from('organization-assets')
          .remove([path]);
      }

      // Clear from settings
      await saveSettings.mutateAsync({ logo_url: null });
    },
    onSuccess: () => {
      toast.success('Logo eliminado');
    },
  });

  return {
    settings,
    isLoading,
    saveSettings: saveSettings.mutateAsync,
    uploadLogo: uploadLogo.mutateAsync,
    deleteLogo: deleteLogo.mutate,
    isSaving: saveSettings.isPending,
    isUploadingLogo: uploadLogo.isPending,
  };
}
