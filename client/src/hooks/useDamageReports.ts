import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import type { DamageReport, DamageReportFormData, DamageReportItemFormData, CollectPaymentFormData } from '@/types/garatech';

export function useDamageReports() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Permission flags
  const canView = !permissionsLoading && hasPermission('garatech.view');
  const canManage = !permissionsLoading && hasPermission('garatech.manage');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['damage-reports', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabaseQuery
        .from('damage_reports')
        .select(`
          *,
          vehicle:vehicles(matricula, modelo),
          reported_by_profile:profiles!damage_reports_reported_by_fkey(name),
          items:damage_report_items(*, catalog_item:damage_catalog(*))
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((r: any) => ({
        ...r,
        vehicle: r.vehicle ? { matricula: r.vehicle.matricula, modelo: r.vehicle.modelo } : null,
        status: r.status || 'borrador',
        amount_collected: r.amount_collected,
        collected_at: r.collected_at,
        collection_notes: r.collection_notes,
        payment_gateway: r.payment_gateway,
        payment_reference: r.payment_reference,
        photos_before: r.photos_before || [],
        photos_after: r.photos_after || [],
      })) as DamageReport[];
    },
    enabled: !!orgId,
  });

  const createReport = useMutation({
    mutationFn: async (data: DamageReportFormData) => {
      if (!orgId || !profile?.id) throw new Error('No organization');
      const { data: result, error } = await supabaseQuery
        .from('damage_reports')
        .insert({ 
          ...data, 
          organization_id: orgId,
          reported_by: profile.id,
          status: 'borrador',
          report_number: '',
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports', orgId] });
      toast.success('Informe creado');
    },
    onError: () => toast.error('Error al crear informe'),
  });

  const updateReport = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DamageReportFormData> }) => {
      const { error } = await supabaseQuery.from('damage_reports').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['damage-report'] });
      toast.success('Informe actualizado');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery.from('damage_reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['damage-report'] });
      toast.success('Informe eliminado');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const addReportItem = useMutation({
    mutationFn: async ({ reportId, item }: { reportId: string; item: DamageReportItemFormData }) => {
      const totalPrice = item.unit_price * item.quantity;
      const { error } = await supabaseQuery.from('damage_report_items').insert({
        report_id: reportId,
        ...item,
        total_price: totalPrice,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['damage-report'] });
      toast.success('Item añadido');
    },
    onError: () => toast.error('Error al añadir item'),
  });

  const removeReportItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabaseQuery.from('damage_report_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['damage-report'] });
      toast.success('Item eliminado');
    },
    onError: () => toast.error('Error al eliminar item'),
  });

  const finalizeReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery
        .from('damage_reports')
        .update({ status: 'finalizado' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['damage-report'] });
      toast.success('Informe finalizado');
    },
    onError: () => toast.error('Error al finalizar'),
  });

  const collectPayment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CollectPaymentFormData }) => {
      const { error } = await supabaseQuery
        .from('damage_reports')
        .update({
          amount_collected: data.amount_collected,
          collected_at: data.collected_at,
          collection_notes: data.collection_notes || null,
          payment_gateway: data.payment_gateway,
          payment_reference: data.payment_reference,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['damage-report'] });
      queryClient.invalidateQueries({ queryKey: ['garatech-stats', orgId] });
      toast.success('Cobro registrado');
    },
    onError: () => toast.error('Error al registrar cobro'),
  });

  return { 
    reports, 
    isLoading, 
    createReport, 
    updateReport, 
    deleteReport, 
    addReportItem, 
    removeReportItem, 
    finalizeReport,
    collectPayment,
    canView,
    canManage,
    permissionsLoading,
  };
}
