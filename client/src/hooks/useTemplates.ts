import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { 
  Template, 
  TemplateVersion,
  TemplateConfig,
  TemplateApply, 
  ApplyOptions,
  AppliedEntities 
} from '@/types/templates';

export const useTemplates = () => {
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const { currentPlan } = useSubscription();
  const queryClient = useQueryClient();

  // Fetch all templates (public metadata only)
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as Template[];
    },
  });

  // Fetch template by slug with version (includes config_json for preview display)
  const fetchTemplateBySlug = useCallback(async (slug: string) => {
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (templateError) throw templateError;
    if (!template) return null;

    // System templates - fetch full version for display (RLS allows this)
    const { data: version, error: versionError } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', template.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) throw versionError;

    return {
      template: template as Template,
      version: version ? {
        ...version,
        config_json: version.config_json as unknown as TemplateConfig,
      } as TemplateVersion : null,
    };
  }, []);

  // Fetch organization's applied templates
  const { data: appliedTemplates, isLoading: loadingApplied } = useQuery({
    queryKey: ['template-applies', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('template_applies')
        .select('*, templates(name, icon, color)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (TemplateApply & { templates: Pick<Template, 'name' | 'icon' | 'color'> })[];
    },
    enabled: !!profile?.organization_id,
  });

  // Apply template mutation - calls Edge Function (server-side)
  const applyTemplateMutation = useMutation({
    mutationFn: async ({ 
      versionId,
      userTemplateId,
      options 
    }: { 
      versionId?: string;
      userTemplateId?: string;
      options: ApplyOptions;
    }): Promise<AppliedEntities> => {
      if (!profile?.organization_id || !profile?.id) {
        throw new Error('No organization or user');
      }

      if (!versionId && !userTemplateId) {
        throw new Error('versionId or userTemplateId is required');
      }

      // Call the secure Edge Function - config_json is never exposed to client
      const { data, error } = await supabase.functions.invoke('apply-template', {
        body: {
          version_id: versionId,
          user_template_id: userTemplateId,
          options,
        },
      });

      if (error) {
        throw new Error(error.message || 'Error applying template');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to apply template');
      }

      return data.applied as AppliedEntities;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-applies'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-columns'] });
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Plantilla aplicada correctamente');
    },
    onError: (error) => {
      console.error('Error applying template:', error);
      toast.error('No se pudo aplicar la plantilla. No se hicieron cambios.');
    },
  });

  // Use permissions from RPC instead of profile.role
  const canManageTemplates = hasPermission('templates.create') || hasPermission('templates.apply');

  return {
    templates,
    loadingTemplates,
    appliedTemplates,
    loadingApplied,
    fetchTemplateBySlug,
    applyTemplate: (versionId: string, options: ApplyOptions) => 
      applyTemplateMutation.mutate({ versionId, options }),
    applyUserTemplate: (userTemplateId: string, options: ApplyOptions) =>
      applyTemplateMutation.mutate({ userTemplateId, options }),
    isApplying: applyTemplateMutation.isPending,
    canManageTemplates,
    currentPlan,
  };
};
