import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { syncRequestTotals } from '@/utils/syncRequestTotals';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import type { TransferDocument, TransferDocumentType, ExtractedTransferItem } from '@/types/transfers';
import { calculateClientInvoice } from '@/utils/transferCalculations';

export function useTransferDocuments(requestId: string | undefined) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const uploadDocument = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: TransferDocumentType }) => {
      if (!profile?.organization_id || !requestId) throw new Error('Missing data');

      // Compress images; skip documents/PDFs
      let uploadFile: File = file;
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
        uploadFile = compressed.file;
      }

      // Upload file to storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `${profile.organization_id}/${requestId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transfer-documents')
        .upload(storagePath, uploadFile);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: doc, error: insertError } = await supabase
        .from('transfer_documents')
        .insert({
          request_id: requestId,
          organization_id: profile.organization_id,
          document_type: documentType,
          storage_path: storagePath,
          file_name: file.name,
          ai_status: 'pending',
          uploaded_by: profile.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger AI processing (non-blocking)
      processWithAI(doc.id).catch(console.error);

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      toast.success('Documento subido');
    },
    onError: (error: Error) => {
      toast.error(`Error al subir documento: ${error.message}`);
    },
  });

  const processWithAI = async (documentId: string) => {
    try {
      // Call Express endpoint for AI processing (it handles status updates internally)
      const { error } = await apiInvoke('parse-transfer-document', {
        body: { documentId },
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
    } catch (error) {
      console.error('AI processing failed:', error);
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
    }
  };

  const updateDocument = useMutation({
    mutationFn: async ({ id, ai_raw_data, ...data }: Partial<TransferDocument> & { id: string }) => {
      // Prepare update data, handling ai_raw_data separately to ensure JSON compatibility
      const updateData: Record<string, unknown> = { ...data };
      if (ai_raw_data !== undefined) {
        updateData.ai_raw_data = ai_raw_data ? JSON.parse(JSON.stringify(ai_raw_data)) : null;
      }
      
      const { error } = await supabase
        .from('transfer_documents')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      toast.success('Documento actualizado');
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (doc: TransferDocument) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('transfer-documents')
        .remove([doc.storage_path]);

      if (storageError) console.error('Storage delete error:', storageError);

      // Delete record
      const { error } = await supabase
        .from('transfer_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      toast.success('Documento eliminado');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  const getDocumentUrl = async (storagePath: string): Promise<string | null> => {
    const { data } = await supabase.storage
      .from('transfer-documents')
      .createSignedUrl(storagePath, 3600); // 1 hour

    return data?.signedUrl ?? null;
  };

  const retryAI = useMutation({
    mutationFn: async (documentId: string) => {
      await processWithAI(documentId);
    },
    onSuccess: () => {
      toast.success('Reintentando análisis con IA');
    },
  });

  // Apply provider cost from document to request and create items
  const applyProviderCost = useMutation({
    mutationFn: async ({ 
      providerCost, 
      items 
    }: { 
      providerCost: number; 
      documentType: TransferDocumentType;
      items?: ExtractedTransferItem[];
    }) => {
      if (!requestId || !profile?.organization_id) throw new Error('No request ID');

      const calculation = calculateClientInvoice(providerCost);

      // Update request with costs
      const { error } = await supabase
        .from('transfer_requests')
        .update({
          provider_cost: providerCost,
          client_total: calculation.clientTotal,
          internal_margin: calculation.profitMargin,
        })
        .eq('id', requestId);

      if (error) throw error;

      // If items were detected, create them
      let createdItemsCount = 0;
      if (items && items.length > 0) {
        // Get max position of existing items
        const { data: existingItems } = await supabase
          .from('transfer_items')
          .select('position')
          .eq('request_id', requestId)
          .order('position', { ascending: false })
          .limit(1);

        const startPosition = (existingItems?.[0]?.position ?? 0) + 1;

        // Create new items from extracted data
        const itemsToInsert = items.map((item, index) => ({
          request_id: requestId,
          organization_id: profile.organization_id!,
          position: startPosition + index,
          transfer_date: item.date,
          pickup_enabled: !!item.pickup_location,
          pickup_location: item.pickup_location,
          pickup_time: item.pickup_time,
          dropoff_enabled: !!item.dropoff_location,
          dropoff_location: item.dropoff_location,
          pax_count: item.pax_count,
          vehicle_type: item.vehicle_type,
          base_price: item.amount,
          notes: item.notes,
          status: 'pendiente' as const,
          has_return: false,
          return_pickup_enabled: false,
          return_dropoff_enabled: false,
          driver_pending: true,
          price_manually_set: false,
        }));

        const { error: insertError, data: insertedItems } = await supabase
          .from('transfer_items')
          .insert(itemsToInsert)
          .select();

        if (insertError) {
          console.error('Error creating items:', insertError);
          throw new Error(`Coste aplicado pero error al crear trayectos: ${insertError.message}`);
        }

        createdItemsCount = insertedItems?.length ?? 0;
      }

      return { calculation, createdItemsCount };
    },
    onSuccess: ({ calculation, createdItemsCount }) => {
      queryClient.invalidateQueries({ queryKey: ['transfer-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['transfer-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-items', requestId] });
      // Sync totals from items to request after applying provider cost
      if (requestId) syncRequestTotals(requestId).catch(console.error);
      
      if (createdItemsCount > 0) {
        toast.success(`Coste aplicado y ${createdItemsCount} trayecto${createdItemsCount !== 1 ? 's' : ''} creado${createdItemsCount !== 1 ? 's' : ''}`);
      } else {
        toast.success(`Coste aplicado. Total cliente: ${calculation.clientTotal.toFixed(2)}€`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Error al aplicar coste: ${error.message}`);
    },
  });

  return {
    uploadDocument: uploadDocument.mutateAsync,
    updateDocument: updateDocument.mutate,
    deleteDocument: deleteDocument.mutate,
    getDocumentUrl,
    retryAI: retryAI.mutate,
    applyProviderCost: applyProviderCost.mutateAsync,
    isUploading: uploadDocument.isPending,
    isDeleting: deleteDocument.isPending,
    isApplyingCost: applyProviderCost.isPending,
  };
}