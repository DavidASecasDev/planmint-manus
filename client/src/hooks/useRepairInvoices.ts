import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import type { 
  RepairInvoice, 
  RepairInvoiceFormData,
  RepairInvoiceItemFormData 
} from '@/types/garatech';

export function useRepairInvoices(repairId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const invoicesQuery = useQuery({
    queryKey: ['repair-invoices', repairId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repair_invoices')
        .select(`
          *,
          items:repair_invoice_items(*),
          uploader:profiles!repair_invoices_uploaded_by_fkey(name)
        `)
        .eq('repair_id', repairId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RepairInvoice[];
    },
    enabled: !!repairId,
  });

  const uploadInvoice = useMutation({
    mutationFn: async ({ file, formData }: { 
      file: File; 
      formData?: RepairInvoiceFormData;
    }) => {
      if (!orgId || !profile?.id) throw new Error('No organization');

      // Compress images; skip PDFs/documents
      let uploadFile: File = file;
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
        uploadFile = compressed.file;
      }

      // Upload to storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `${orgId}/${repairId}/invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('repair-files')
        .upload(storagePath, uploadFile);

      if (uploadError) throw uploadError;

      // Create database record with processing status
      const { data, error } = await supabase
        .from('repair_invoices')
        .insert({
          repair_id: repairId,
          organization_id: orgId,
          storage_path: storagePath,
          file_name: file.name,
          uploaded_by: profile.id,
          ocr_status: 'processing',
          ...formData,
        })
        .select()
        .single();

      if (error) throw error;

      // Add history entry
      await supabase.from('repair_history').insert({
        repair_id: repairId,
        organization_id: orgId,
        user_id: profile.id,
        action: 'invoice_added',
        metadata: { invoice_id: data.id, file_name: file.name },
      });

      // Trigger AI extraction (non-blocking)
      supabase.functions
        .invoke('parse-repair-invoice', {
          body: { invoiceId: data.id }
        })
        .then(({ error: fnError }) => {
          if (fnError) {
            console.error('AI extraction error:', fnError);
          }
        })
        .catch((err) => {
          console.error('Failed to invoke parse-repair-invoice:', err);
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-invoices', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repair-history', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      toast.success('Factura subida - procesando con IA...');
    },
    onError: (error) => {
      console.error('Error uploading invoice:', error);
      toast.error('Error al subir la factura');
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ invoiceId, data }: { 
      invoiceId: string; 
      data: RepairInvoiceFormData;
    }) => {
      const { error } = await supabase
        .from('repair_invoices')
        .update(data)
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-invoices', repairId] });
      toast.success('Factura actualizada');
    },
    onError: (error) => {
      console.error('Error updating invoice:', error);
      toast.error('Error al actualizar la factura');
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (invoice: RepairInvoice) => {
      if (!orgId || !profile?.id) throw new Error('No organization');

      // Delete from storage if exists
      if (invoice.storage_path) {
        const { error: deleteStorageError } = await supabase.storage
          .from('repair-files')
          .remove([invoice.storage_path]);

        if (deleteStorageError) console.error('Storage delete error:', deleteStorageError);
      }

      // Delete database record (cascade will delete items)
      const { error } = await supabase
        .from('repair_invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      // Add history entry
      await supabase.from('repair_history').insert({
        repair_id: repairId,
        organization_id: orgId,
        user_id: profile.id,
        action: 'invoice_removed',
        metadata: { 
          invoice_number: invoice.invoice_number, 
          total_amount: invoice.total_amount 
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-invoices', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repair-history', repairId] });
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      toast.success('Factura eliminada');
    },
    onError: (error) => {
      console.error('Error deleting invoice:', error);
      toast.error('Error al eliminar la factura');
    },
  });

  const addInvoiceItem = useMutation({
    mutationFn: async ({ invoiceId, item }: { 
      invoiceId: string; 
      item: RepairInvoiceItemFormData;
    }) => {
      const totalPrice = item.quantity * item.unit_price;
      
      const { data, error } = await supabase
        .from('repair_invoice_items')
        .insert({
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: totalPrice,
          category: item.category,
        })
        .select()
        .single();

      if (error) throw error;

      // Update invoice totals
      await recalculateInvoiceTotals(invoiceId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-invoices', repairId] });
      toast.success('Línea añadida');
    },
    onError: (error) => {
      console.error('Error adding invoice item:', error);
      toast.error('Error al añadir la línea');
    },
  });

  const deleteInvoiceItem = useMutation({
    mutationFn: async ({ itemId, invoiceId }: { itemId: string; invoiceId: string }) => {
      const { error } = await supabase
        .from('repair_invoice_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Update invoice totals
      await recalculateInvoiceTotals(invoiceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repair-invoices', repairId] });
      toast.success('Línea eliminada');
    },
    onError: (error) => {
      console.error('Error deleting invoice item:', error);
      toast.error('Error al eliminar la línea');
    },
  });

  const recalculateInvoiceTotals = async (invoiceId: string) => {
    // Get all items for this invoice
    const { data: items } = await supabase
      .from('repair_invoice_items')
      .select('total_price')
      .eq('invoice_id', invoiceId);

    const subtotal = items?.reduce((sum, item) => sum + Number(item.total_price), 0) ?? 0;
    const taxAmount = subtotal * 0.21; // 21% IVA
    const total = subtotal + taxAmount;

    await supabase
      .from('repair_invoices')
      .update({
        subtotal_amount: subtotal,
        tax_amount: taxAmount,
        total_amount: total,
      })
      .eq('id', invoiceId);

    // Update repair cost_final with total of all invoices
    await updateRepairCostFinal();
  };

  const updateRepairCostFinal = async () => {
    const { data: invoices } = await supabase
      .from('repair_invoices')
      .select('total_amount')
      .eq('repair_id', repairId);

    const totalCost = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) ?? 0;

    await supabase
      .from('repairs')
      .update({ cost_final: totalCost })
      .eq('id', repairId);

    queryClient.invalidateQueries({ queryKey: ['repairs'] });
  };

  const getInvoiceUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('repair-files')
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error) throw error;
    return data.signedUrl;
  };

  // Calculate totals
  const totalAmount = invoicesQuery.data?.reduce(
    (sum, inv) => sum + Number(inv.total_amount), 
    0
  ) ?? 0;

  return {
    invoices: invoicesQuery.data ?? [],
    isLoading: invoicesQuery.isLoading,
    totalAmount,
    uploadInvoice,
    updateInvoice,
    deleteInvoice,
    addInvoiceItem,
    deleteInvoiceItem,
    getInvoiceUrl,
  };
}
