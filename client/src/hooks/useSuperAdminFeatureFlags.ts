import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { FeatureFlag } from '@/types/featureFlags';
import { toast } from 'sonner';

export function useSuperAdminFeatureFlags() {
  const { isSuperAdmin } = useSuperAdmin();
  const queryClient = useQueryClient();
  const { logAuditEvent } = useAuditLogs();

  // Fetch all feature flags (global only for management view)
  const { data: globalFlags = [], isLoading } = useQuery({
    queryKey: ['super-admin-feature-flags'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('feature_flags' as any)
        .select('*')
        .is('organization_id', null)
        .order('name') as any);

      if (error) throw error;
      return data as FeatureFlag[];
    },
    enabled: isSuperAdmin,
  });

  // Fetch org-specific overrides
  const useOrgFeatureFlags = (organizationId: string | undefined) => {
    return useQuery({
      queryKey: ['super-admin-org-feature-flags', organizationId],
      queryFn: async () => {
        if (!organizationId) return [];
        
        const { data, error } = await (supabase
          .from('feature_flags' as any)
          .select('*')
          .eq('organization_id', organizationId)
          .order('name') as any);

        if (error) throw error;
        return data as FeatureFlag[];
      },
      enabled: isSuperAdmin && !!organizationId,
    });
  };

  // Toggle global flag with audit logging
  const toggleGlobalFlag = useMutation({
    mutationFn: async ({ flagId, enabled }: { flagId: string; enabled: boolean }) => {
      const { error } = await (supabase
        .from('feature_flags' as any)
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', flagId) as any);

      if (error) throw error;
      return { flagId, enabled };
    },
    onSuccess: async (data, variables) => {
      // Log audit event
      const flag = globalFlags.find(f => f.id === variables.flagId);
      if (flag) {
        logAuditEvent({
          action: 'feature_flag.toggle',
          entity_type: 'feature_flag',
          entity_id: variables.flagId,
          metadata: {
            flag_key: flag.key,
            flag_name: flag.name,
            enabled: variables.enabled,
            scope: 'global',
          },
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['super-admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Flag actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar flag');
    },
  });

  // Update flag settings with audit logging
  const updateFlag = useMutation({
    mutationFn: async ({ 
      flagId, 
      updates 
    }: { 
      flagId: string; 
      updates: Partial<Pick<FeatureFlag, 'plan' | 'rollout_percentage' | 'enabled'>> 
    }) => {
      const { error } = await (supabase
        .from('feature_flags' as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', flagId) as any);

      if (error) throw error;
      return { flagId, updates };
    },
    onSuccess: async (data, variables) => {
      // Log audit event
      const flag = globalFlags.find(f => f.id === variables.flagId);
      if (flag) {
        logAuditEvent({
          action: 'feature_flag.update',
          entity_type: 'feature_flag',
          entity_id: variables.flagId,
          metadata: {
            flag_key: flag.key,
            flag_name: flag.name,
            updates: variables.updates,
            scope: 'global',
          },
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['super-admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Configuración guardada');
    },
    onError: () => {
      toast.error('Error al guardar');
    },
  });

  // Create org-specific override with audit logging
  const createOrgOverride = useMutation({
    mutationFn: async ({ 
      organizationId, 
      key, 
      name,
      description,
      enabled 
    }: { 
      organizationId: string; 
      key: string; 
      name: string;
      description: string | null;
      enabled: boolean;
    }) => {
      const { data, error } = await (supabase
        .from('feature_flags' as any)
        .insert({
          organization_id: organizationId,
          key,
          name,
          description,
          enabled,
        })
        .select()
        .single() as any);

      if (error) throw error;
      return { data, organizationId, key, name, enabled };
    },
    onSuccess: (result, variables) => {
      // Log audit event
      logAuditEvent({
        action: 'feature_flag.override_created',
        entity_type: 'feature_flag',
        entity_id: result.data?.id,
        metadata: {
          flag_key: variables.key,
          flag_name: variables.name,
          organization_id: variables.organizationId,
          enabled: variables.enabled,
          scope: 'organization',
        },
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ['super-admin-org-feature-flags', variables.organizationId] 
      });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Override creado');
    },
    onError: () => {
      toast.error('Error al crear override');
    },
  });

  // Delete org-specific override with audit logging
  const deleteOrgOverride = useMutation({
    mutationFn: async ({ flagId, organizationId, flagKey }: { flagId: string; organizationId: string; flagKey?: string }) => {
      const { error } = await (supabase
        .from('feature_flags' as any)
        .delete()
        .eq('id', flagId) as any);

      if (error) throw error;
      return { flagId, organizationId, flagKey };
    },
    onSuccess: (data) => {
      // Log audit event
      logAuditEvent({
        action: 'feature_flag.override_deleted',
        entity_type: 'feature_flag',
        entity_id: data.flagId,
        metadata: {
          flag_key: data.flagKey,
          organization_id: data.organizationId,
          scope: 'organization',
        },
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ['super-admin-org-feature-flags', data.organizationId] 
      });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Override eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar override');
    },
  });

  return {
    globalFlags,
    isLoading,
    useOrgFeatureFlags,
    toggleGlobalFlag,
    updateFlag,
    createOrgOverride,
    deleteOrgOverride,
  };
}
