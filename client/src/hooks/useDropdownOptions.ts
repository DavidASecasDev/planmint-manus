import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { DropdownOption, DropdownFieldName } from '@/types/reservations';
import { toast } from 'sonner';

export function useDropdownOptions(fieldName?: DropdownFieldName) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id;

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['dropdown-options', organizationId, fieldName],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabaseQuery
        .from('dropdown_options')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true });
      
      if (fieldName) {
        query = query.eq('field_name', fieldName);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DropdownOption[];
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutes - dropdown options rarely change
  });

  const createOption = useMutation({
    mutationFn: async ({ 
      field_name, 
      label, 
      color 
    }: { 
      field_name: string; 
      label: string; 
      color: string;
    }) => {
      if (!organizationId) throw new Error('No organization');
      
      const maxOrder = options
        .filter(o => o.field_name === field_name)
        .reduce((max, o) => Math.max(max, o.sort_order), 0);
      
      const { data, error } = await supabaseQuery
        .from('dropdown_options')
        .insert({
          organization_id: organizationId,
          field_name,
          label,
          color,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as DropdownOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dropdown-options'] });
      toast.success('Opción creada');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Esta opción ya existe');
      } else {
        toast.error('Error al crear la opción');
      }
    },
  });

  const getOptionsForField = (field: DropdownFieldName) => {
    return options.filter(o => o.field_name === field);
  };

  return {
    options,
    isLoading,
    createOption,
    getOptionsForField,
  };
}
