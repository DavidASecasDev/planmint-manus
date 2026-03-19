import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AuditLog, AUDIT_ACTIONS } from '@/types/enterprise';
import { toast } from 'sonner';

interface AuditLogFilters {
  action?: string;
  entity_type?: string;
  actor_user_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          actor:profiles!audit_logs_actor_user_id_fkey(id, name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }
      if (filters.actor_user_id) {
        query = query.eq('actor_user_id', filters.actor_user_id);
      }
      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('created_at', filters.end_date);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!profile?.organization_id,
  });

  const logAuditEvent = useMutation({
    mutationFn: async ({
      action,
      entity_type,
      entity_id,
      metadata,
    }: {
      action: string;
      entity_type: string;
      entity_id?: string;
      metadata?: Record<string, any>;
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { error } = await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        actor_user_id: profile.id,
        actor_role: profile.role,
        action,
        entity_type,
        entity_id,
        metadata_json: metadata || {},
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const exportToCSV = async () => {
    if (!logs.length) {
      toast.error('No hay registros para exportar');
      return;
    }

    const headers = ['Fecha', 'Usuario', 'Rol', 'Acción', 'Entidad', 'ID Entidad'];
    const rows = logs.map((log) => [
      new Date(log.created_at).toLocaleString('es-ES'),
      log.actor?.name || 'Sistema',
      log.actor_role || '-',
      log.action,
      log.entity_type,
      log.entity_id || '-',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Registros exportados correctamente');
  };

  return {
    logs,
    isLoading,
    logAuditEvent: logAuditEvent.mutate,
    exportToCSV,
    AUDIT_ACTIONS,
  };
}
