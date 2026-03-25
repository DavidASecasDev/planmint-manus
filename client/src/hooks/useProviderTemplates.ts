import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { ProviderParsingTemplate, ProviderTemplateFormData } from '@/types/providerTemplates';

export function useProviderTemplates() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const templatesQuery = useQuery({
    queryKey: ['provider-parsing-templates', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('provider_parsing_templates')
        .select('*')
        .eq('organization_id', orgId)
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProviderParsingTemplate[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: ProviderTemplateFormData) => {
      if (!orgId || !profile?.id) throw new Error('No auth');
      const { data, error } = await supabase
        .from('provider_parsing_templates')
        .insert({
          organization_id: orgId,
          provider_name: input.provider_name,
          provider_aliases: input.provider_aliases || [],
          description: input.description || null,
          parsing_hints: input.parsing_hints,
          field_mappings: input.field_mappings || {},
          sample_fields: input.sample_fields || {},
          default_vehicle_type: input.default_vehicle_type || null,
          default_currency: input.default_currency || 'EUR',
          is_active: input.is_active ?? true,
          created_by: profile.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-parsing-templates'] });
      toast({ title: 'Plantilla creada', description: 'La plantilla de proveedor se ha guardado correctamente.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProviderTemplateFormData> & { id: string }) => {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.provider_name !== undefined) updateData.provider_name = input.provider_name;
      if (input.provider_aliases !== undefined) updateData.provider_aliases = input.provider_aliases;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.parsing_hints !== undefined) updateData.parsing_hints = input.parsing_hints;
      if (input.field_mappings !== undefined) updateData.field_mappings = input.field_mappings;
      if (input.sample_fields !== undefined) updateData.sample_fields = input.sample_fields;
      if (input.default_vehicle_type !== undefined) updateData.default_vehicle_type = input.default_vehicle_type;
      if (input.default_currency !== undefined) updateData.default_currency = input.default_currency;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;

      const { data, error } = await supabase
        .from('provider_parsing_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-parsing-templates'] });
      toast({ title: 'Plantilla actualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('provider_parsing_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-parsing-templates'] });
      toast({ title: 'Plantilla eliminada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('provider_parsing_templates')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-parsing-templates'] });
    },
  });

  /** Find the best matching template for a given provider name */
  const findTemplateForProvider = (providerName: string | null): ProviderParsingTemplate | null => {
    if (!providerName || !templatesQuery.data) return null;
    const normalizedName = providerName.toLowerCase().trim();

    // Exact match on provider_name
    const exactMatch = templatesQuery.data.find(
      t => t.is_active && t.provider_name.toLowerCase().trim() === normalizedName
    );
    if (exactMatch) return exactMatch;

    // Check aliases
    const aliasMatch = templatesQuery.data.find(
      t => t.is_active && t.provider_aliases.some(
        alias => alias.toLowerCase().trim() === normalizedName
      )
    );
    if (aliasMatch) return aliasMatch;

    // Partial match (provider name contains or is contained)
    const partialMatch = templatesQuery.data.find(
      t => t.is_active && (
        normalizedName.includes(t.provider_name.toLowerCase().trim()) ||
        t.provider_name.toLowerCase().trim().includes(normalizedName) ||
        t.provider_aliases.some(alias => 
          normalizedName.includes(alias.toLowerCase().trim()) ||
          alias.toLowerCase().trim().includes(normalizedName)
        )
      )
    );
    return partialMatch || null;
  };

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleActive,
    findTemplateForProvider,
  };
}
