import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useSuperAdmin } from './useSuperAdmin';
import { toast } from 'sonner';
import { getPlanMonthlyPrice } from '@/lib/billing';

export interface SuperAdminAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  organization_id: string | null;
  metadata_json: Record<string, any>;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
  organizations?: { name: string } | null;
}

export function useSuperAdminAlerts() {
  const { isSuperAdmin } = useSuperAdmin();
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ['super-admin-alerts'],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('super_admin_alerts')
        .select(`
          *,
          organizations (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as SuperAdminAlert[];
    },
    enabled: isSuperAdmin,
  });

  const unreadAlertsQuery = useQuery({
    queryKey: ['super-admin-alerts-unread'],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('super_admin_alerts')
        .select(`
          *,
          organizations (name)
        `)
        .is('read_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SuperAdminAlert[];
    },
    enabled: isSuperAdmin,
  });

  const paymentAlertsQuery = useQuery({
    queryKey: ['super-admin-payment-alerts'],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('super_admin_alerts')
        .select(`
          *,
          organizations (name)
        `)
        .eq('alert_type', 'payment_failed')
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SuperAdminAlert[];
    },
    enabled: isSuperAdmin,
  });

  const unreadFeedbackQuery = useQuery({
    queryKey: ['super-admin-feedback-unread-count'],
    queryFn: async () => {
      const { count, error } = await supabaseQuery
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .is('read_at', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: isSuperAdmin,
  });

  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabaseQuery
        .from('super_admin_alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-alerts-unread'] });
    },
  });

  const markAsResolved = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabaseQuery
        .from('super_admin_alerts')
        .update({ 
          resolved_at: new Date().toISOString(),
          read_at: new Date().toISOString() 
        })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-alerts-unread'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-payment-alerts'] });
      toast.success('Alerta marcada como resuelta');
    },
  });

  const deleteAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabaseQuery
        .from('super_admin_alerts')
        .delete()
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-alerts-unread'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-payment-alerts'] });
      toast.success('Alerta eliminada');
    },
  });

  return {
    alerts: alertsQuery.data || [],
    isLoading: alertsQuery.isLoading,
    unreadAlerts: unreadAlertsQuery.data || [],
    unreadCount: unreadAlertsQuery.data?.length || 0,
    paymentAlerts: paymentAlertsQuery.data || [],
    activePaymentCount: paymentAlertsQuery.data?.length || 0,
    unreadFeedbackCount: unreadFeedbackQuery.data || 0,
    markAsRead,
    markAsResolved,
    deleteAlert,
  };
}

export function usePaymentStats() {
  const { isSuperAdmin } = useSuperAdmin();

  return useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      // Get subscriptions with past_due status
      const { data: pastDueSubs, error: subError } = await supabaseQuery
        .from('subscriptions')
        .select(`
          id,
          organization_id,
          plan,
          status,
          seats_included,
          organizations (name)
        `)
        .eq('status', 'past_due');

      if (subError) throw subError;

      // Calculate MRR at risk (display estimate)
      const mrrAtRisk = (pastDueSubs || []).reduce((total: any, sub: any) => {
        const seats = sub.seats_included || 1;
        return total + getPlanMonthlyPrice(sub.plan) * seats;
      }, 0);

      // Get unresolved payment alerts count
      const { count: activeAlerts } = await supabaseQuery
        .from('super_admin_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('alert_type', 'payment_failed')
        .is('resolved_at', null);

      return {
        pastDueSubscriptions: pastDueSubs || [],
        pastDueCount: pastDueSubs?.length || 0,
        mrrAtRisk,
        activeAlerts: activeAlerts || 0,
      };
    },
    enabled: isSuperAdmin,
  });
}
