// Phase 29: User-Generated Templates Hook
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { 
  UserTemplate, 
  UserTemplateConfig, 
  CreateUserTemplateData,
  TemplateRating,
  ExportOptions 
} from '@/types/userTemplates';
import { Json } from '@/integrations/supabase/types';

// Template limits per plan
const TEMPLATE_LIMITS = {
  free: 0,
  pro: 5,
  team: Infinity,
};

export const useUserTemplates = () => {
  const { profile, user } = useAuth();
  const { currentPlan } = useSubscription();
  const queryClient = useQueryClient();

  // Plan permissions
  const canCreateTemplates = currentPlan !== 'free';
  const canPublishTemplates = currentPlan === 'team';
  const canRateTemplates = currentPlan !== 'free';
  const templateLimit = TEMPLATE_LIMITS[currentPlan as keyof typeof TEMPLATE_LIMITS] || 0;

  // Fetch community templates (public + active)
  const { data: communityTemplates, isLoading: loadingCommunity } = useQuery({
    queryKey: ['user-templates', 'community'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_templates')
        .select('*, profiles!user_templates_created_by_fkey(name)')
        .eq('visibility', 'public')
        .eq('status', 'active')
        .order('installs_count', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        config_json: t.config_json as unknown as UserTemplateConfig,
        creator_name: (t.profiles as any)?.name || 'Anónimo',
      })) as UserTemplate[];
    },
  });

  // Fetch my templates (created by my org)
  const { data: myTemplates, isLoading: loadingMy } = useQuery({
    queryKey: ['user-templates', 'my', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('user_templates')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        config_json: t.config_json as unknown as UserTemplateConfig,
      })) as UserTemplate[];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch my favorites
  const { data: favoriteIds, isLoading: loadingFavorites } = useQuery({
    queryKey: ['template-favorites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('template_favorites')
        .select('template_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return (data || []).map(f => f.template_id);
    },
    enabled: !!user?.id,
  });

  // Fetch favorite templates details
  const { data: favoriteTemplates, isLoading: loadingFavoriteTemplates } = useQuery({
    queryKey: ['user-templates', 'favorites', favoriteIds],
    queryFn: async () => {
      if (!favoriteIds?.length) return [];
      
      const { data, error } = await supabase
        .from('user_templates')
        .select('*, profiles!user_templates_created_by_fkey(name)')
        .in('id', favoriteIds)
        .eq('status', 'active');
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        config_json: t.config_json as unknown as UserTemplateConfig,
        creator_name: (t.profiles as any)?.name || 'Anónimo',
      })) as UserTemplate[];
    },
    enabled: !!favoriteIds?.length,
  });

  // Fetch template by slug
  const fetchUserTemplateBySlug = useCallback(async (slug: string) => {
    const { data, error } = await supabase
      .from('user_templates')
      .select('*, profiles!user_templates_created_by_fkey(name), organizations(name)')
      .eq('slug', slug)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return null;
    
    return {
      ...data,
      config_json: data.config_json as unknown as UserTemplateConfig,
      creator_name: (data.profiles as any)?.name || 'Anónimo',
      organization_name: (data.organizations as any)?.name || 'Organización',
    } as UserTemplate;
  }, []);

  // Fetch template by share_code
  const fetchTemplateByShareCode = useCallback(async (shareCode: string) => {
    const { data, error } = await supabase
      .from('user_templates')
      .select('*, profiles!user_templates_created_by_fkey(name), organizations(name)')
      .eq('share_code', shareCode)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return null;
    
    return {
      ...data,
      config_json: data.config_json as unknown as UserTemplateConfig,
      creator_name: (data.profiles as any)?.name || 'Anónimo',
      organization_name: (data.organizations as any)?.name || 'Organización',
    } as UserTemplate;
  }, []);

  // Fetch ratings for a template
  const fetchTemplateRatings = useCallback(async (templateId: string) => {
    const { data, error } = await supabase
      .from('template_ratings')
      .select('*, profiles!template_ratings_user_id_fkey(name)')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      user_name: (r.profiles as any)?.name || 'Anónimo',
    })) as TemplateRating[];
  }, []);

  // Check if user has rated a template
  const fetchMyRating = useCallback(async (templateId: string) => {
    if (!user?.id) return null;
    
    const { data, error } = await supabase
      .from('template_ratings')
      .select('*')
      .eq('template_id', templateId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) throw error;
    return data as TemplateRating | null;
  }, [user?.id]);

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: CreateUserTemplateData) => {
      if (!profile?.organization_id || !profile?.id) {
        throw new Error('No organization or user');
      }

      if (!canCreateTemplates) {
        throw new Error('Plan Free no permite crear plantillas');
      }

      // Check template limit
      const myCount = myTemplates?.length || 0;
      if (myCount >= templateLimit) {
        throw new Error(`Has alcanzado el límite de ${templateLimit} plantillas`);
      }

      // Check visibility permission
      if (data.visibility === 'public' && !canPublishTemplates) {
        throw new Error('Solo el plan Team puede publicar plantillas públicas');
      }

      const { data: newTemplate, error } = await supabase
        .from('user_templates')
        .insert({
          organization_id: profile.organization_id,
          created_by: profile.id,
          name: data.name,
          slug: data.slug,
          visibility: data.visibility,
          description: data.description,
          long_description: data.long_description || null,
          icon: data.icon || 'layout-template',
          color: data.color || '#6366f1',
          is_pack: data.is_pack || false,
          industry: data.industry || null,
          config_json: data.config_json as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-templates'] });
      toast.success('Plantilla creada correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear la plantilla');
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateUserTemplateData> }) => {
      if (data.visibility === 'public' && !canPublishTemplates) {
        throw new Error('Solo el plan Team puede publicar plantillas públicas');
      }

      const updateData: any = { ...data };
      if (data.config_json) {
        updateData.config_json = data.config_json as unknown as Json;
      }

      const { error } = await supabase
        .from('user_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-templates'] });
      toast.success('Plantilla actualizada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar');
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-templates'] });
      toast.success('Plantilla eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar la plantilla');
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!user?.id) throw new Error('No user');

      const isFavorite = favoriteIds?.includes(templateId);

      if (isFavorite) {
        const { error } = await supabase
          .from('template_favorites')
          .delete()
          .eq('template_id', templateId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('template_favorites')
          .insert({ template_id: templateId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['user-templates'] });
    },
  });

  // Rate template mutation
  const rateTemplateMutation = useMutation({
    mutationFn: async ({ templateId, rating, review }: { templateId: string; rating: number; review?: string }) => {
      if (!user?.id) throw new Error('No user');
      if (!canRateTemplates) throw new Error('Plan Free no permite valorar plantillas');

      // Upsert rating
      const { error } = await supabase
        .from('template_ratings')
        .upsert({
          template_id: templateId,
          user_id: user.id,
          rating,
          review: review || null,
        }, {
          onConflict: 'template_id,user_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-templates'] });
      toast.success('Valoración guardada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al guardar valoración');
    },
  });

  // Report template mutation
  const reportTemplateMutation = useMutation({
    mutationFn: async ({ templateId, reason, details }: { templateId: string; reason: string; details?: string }) => {
      if (!user?.id) throw new Error('No user');

      const { error } = await supabase
        .from('template_reports')
        .insert({
          template_id: templateId,
          reported_by: user.id,
          reason,
          details: details || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reporte enviado. Gracias por ayudar a mantener la comunidad.');
    },
    onError: () => {
      toast.error('Error al enviar el reporte');
    },
  });

  // Install community template (record install)
  const recordInstallMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!profile?.organization_id || !profile?.id) {
        throw new Error('No organization or user');
      }

      const { error } = await supabase
        .from('template_installs')
        .insert({
          template_id: templateId,
          organization_id: profile.organization_id,
          installed_by: profile.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-templates'] });
    },
  });

  // Export organization config as template config
  const exportOrganizationConfig = useCallback(async (options: ExportOptions): Promise<UserTemplateConfig> => {
    if (!profile?.organization_id) {
      throw new Error('No organization');
    }

    const config: UserTemplateConfig = {
      areas: [],
      tags: [],
      kanban_columns: [],
      tasks: [],
      automations: [],
    };

    // Export areas
    if (options.areas) {
      const { data: areas } = await supabase
        .from('areas')
        .select('name, icon, color')
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false);
      
      config.areas = (areas || []).map(a => ({
        name: a.name,
        icon: a.icon || 'folder',
        color: a.color || '#4F46E5',
      }));
    }

    // Export tags
    if (options.tags) {
      const { data: tags } = await supabase
        .from('tags')
        .select('name, icon, color')
        .eq('organization_id', profile.organization_id);
      
      config.tags = (tags || []).map(t => ({
        name: t.name,
        icon: t.icon || 'tag',
        color: t.color || '#6366f1',
      }));
    }

    // Export kanban columns
    if (options.kanban_columns) {
      const { data: columns } = await supabase
        .from('kanban_columns')
        .select('label, status, color')
        .eq('organization_id', profile.organization_id)
        .order('sort_order');
      
      config.kanban_columns = (columns || []).map(c => ({
        label: c.label,
        status: c.status,
        color: c.color,
      }));
    }

    // Export tasks (sanitized)
    if (options.tasks) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          title, type, status, priority, goal_target_value, goal_unit,
          task_areas(areas(name)),
          task_tags(tags(name)),
          task_milestones(title),
          task_subtasks(title)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false)
        .limit(50);
      
      config.tasks = (tasks || []).map((t, index) => ({
        // Sanitize title - replace with generic if too specific
        title: sanitizeTitle(t.title, index),
        type: t.type as 'simple' | 'goal_numeric' | 'goal_milestones',
        status: t.status,
        priority: t.priority,
        areas: (t.task_areas as any[])?.map((ta: any) => ta.areas?.name).filter(Boolean),
        tags: (t.task_tags as any[])?.map((tt: any) => tt.tags?.name).filter(Boolean),
        goal_target_value: t.goal_target_value || undefined,
        goal_unit: t.goal_unit || undefined,
        milestones: (t.task_milestones as any[])?.map((m: any, i: number) => ({
          title: sanitizeTitle(m.title, i),
        })),
        subtasks: (t.task_subtasks as any[])?.map((s: any, i: number) => ({
          title: sanitizeTitle(s.title, i),
        })),
      }));
    }

    // Export automations (sanitized - no user IDs)
    if (options.automations) {
      const { data: rules } = await supabase
        .from('automation_rules')
        .select('name, trigger_type, conditions_json, actions_json, throttle_minutes')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .limit(20);
      
      config.automations = (rules || []).map(r => ({
        name: r.name,
        trigger_type: r.trigger_type,
        conditions: sanitizeAutomationConditions(r.conditions_json as any),
        actions: sanitizeAutomationActions(r.actions_json as any),
        throttle_minutes: r.throttle_minutes,
      }));
    }

    return config;
  }, [profile?.organization_id]);

  // Check if user is favorite
  const isFavorite = useCallback((templateId: string) => {
    return favoriteIds?.includes(templateId) || false;
  }, [favoriteIds]);

  return {
    // Data
    communityTemplates,
    myTemplates,
    favoriteTemplates,
    favoriteIds,
    
    // Loading states
    loadingCommunity,
    loadingMy,
    loadingFavorites: loadingFavorites || loadingFavoriteTemplates,
    
    // Permissions
    canCreateTemplates,
    canPublishTemplates,
    canRateTemplates,
    templateLimit,
    currentPlan,
    
    // Functions
    fetchUserTemplateBySlug,
    fetchTemplateByShareCode,
    fetchTemplateRatings,
    fetchMyRating,
    exportOrganizationConfig,
    isFavorite,
    
    // Mutations
    createTemplate: createTemplateMutation.mutate,
    updateTemplate: updateTemplateMutation.mutate,
    deleteTemplate: deleteTemplateMutation.mutate,
    toggleFavorite: toggleFavoriteMutation.mutate,
    rateTemplate: rateTemplateMutation.mutate,
    reportTemplate: reportTemplateMutation.mutate,
    recordInstall: recordInstallMutation.mutate,
    
    // Mutation states
    isCreating: createTemplateMutation.isPending,
    isUpdating: updateTemplateMutation.isPending,
    isDeleting: deleteTemplateMutation.isPending,
  };
};

// Sanitization helpers
function sanitizeTitle(title: string, index: number): string {
  // If title looks generic already, keep it
  if (/^(ejemplo|tarea|hito|subtarea|objetivo)/i.test(title)) {
    return title;
  }
  
  // Check for potentially sensitive patterns (emails, phones, specific names)
  const sensitivePatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // email
    /\b\d{9,}\b/, // phone-like numbers
    /\b(cliente|proveedor|usuario):\s*\w+/i, // client references
  ];
  
  for (const pattern of sensitivePatterns) {
    if (pattern.test(title)) {
      return `Ejemplo: Tarea ${index + 1}`;
    }
  }
  
  // Shorten very long titles
  if (title.length > 60) {
    return title.substring(0, 50) + '...';
  }
  
  return title;
}

function sanitizeAutomationConditions(conditions: any): { all?: any[]; any?: any[] } {
  if (!conditions) return { all: [] };
  
  const sanitized: { all?: any[]; any?: any[] } = {};
  
  // Remove user_id specific conditions, keep role-based
  const sanitizeConditionArray = (arr: any[]) => {
    return arr?.filter(c => {
      // Remove conditions that reference specific user IDs
      if (c.field === 'assigned_to' && c.operator === 'equals' && c.value?.length === 36) {
        return false; // Looks like a UUID, remove
      }
      return true;
    }) || [];
  };
  
  if (conditions.all) {
    sanitized.all = sanitizeConditionArray(conditions.all);
  }
  if (conditions.any) {
    sanitized.any = sanitizeConditionArray(conditions.any);
  }
  
  return sanitized;
}

function sanitizeAutomationActions(actions: any): { actions: any[] } {
  if (!actions?.actions) return { actions: [] };
  
  const sanitizedActions = actions.actions.map((action: any) => {
    const sanitized = { ...action };
    
    // Replace specific user IDs with role-based targets
    if (action.type === 'assign_to' && action.value?.length === 36) {
      sanitized.value = 'assigned_to'; // Use variable instead of UUID
    }
    
    // Remove specific user targets in notifications
    if (action.target && action.target.length === 36) {
      sanitized.target = 'assigned_to';
    }
    
    return sanitized;
  });
  
  return { actions: sanitizedActions };
}
