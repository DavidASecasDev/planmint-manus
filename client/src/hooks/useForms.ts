import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { 
  Form, 
  FormWithFields, 
  FormField,
  FormResponseWithRelations,
  CreateFormData,
  CreateFormFieldData,
  SubmitFormData
} from '@/types/forms';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'Forms' });

export function useForms() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();

  // Permission flags
  const canView = !permissionsLoading && hasPermission('forms.view');
  const canCreate = !permissionsLoading && hasPermission('forms.create');
  const canManage = !permissionsLoading && hasPermission('forms.manage');

  // Fetch all forms
  const { data: forms = [], isLoading, refetch } = useQuery({
    queryKey: ['forms', profile?.organization_id],
    queryFn: async (): Promise<Form[]> => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) {
        log.error('Error fetching:', error);
        throw error;
      }

      return (data || []) as unknown as Form[];
    },
    enabled: !!profile?.organization_id,
  });

  // Create form mutation
  const createFormMutation = useMutation({
    mutationFn: async (data: CreateFormData) => {
      if (!profile?.organization_id || !profile?.id) {
        throw new Error('No organization');
      }

      const { data: form, error } = await supabase
        .from('forms')
        .insert({
          ...data,
          organization_id: profile.organization_id,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return form as unknown as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulario creado');
    },
    onError: (error) => {
      log.error('Error creating:', error);
      toast.error('Error al crear formulario');
    },
  });

  // Update form mutation
  const updateFormMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateFormData> & { id: string }) => {
      const { data: form, error } = await supabase
        .from('forms')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return form as unknown as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulario actualizado');
    },
    onError: (error) => {
      log.error('Error updating:', error);
      toast.error('Error al actualizar formulario');
    },
  });

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Formulario eliminado');
    },
    onError: (error) => {
      log.error('Error deleting:', error);
      toast.error('Error al eliminar formulario');
    },
  });

  return {
    forms,
    isLoading,
    refetch,
    createForm: createFormMutation.mutateAsync,
    updateForm: updateFormMutation.mutate,
    deleteForm: deleteFormMutation.mutate,
    isCreating: createFormMutation.isPending,
    canView,
    canCreate,
    canManage,
    permissionsLoading,
  };
}

// Hook for single form with fields
export function useForm(formId: string | null) {
  const { data: form, isLoading, refetch } = useQuery({
    queryKey: ['form', formId],
    queryFn: async (): Promise<FormWithFields | null> => {
      if (!formId) return null;

      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (formError) {
        createLogger({ context: 'Form' }).error('Error fetching form:', formError);
        throw formError;
      }

      const { data: fieldsData, error: fieldsError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('position', { ascending: true });

      if (fieldsError) {
        createLogger({ context: 'Form' }).error('Error fetching fields:', fieldsError);
        throw fieldsError;
      }

      return {
        ...(formData as unknown as Form),
        fields: (fieldsData || []) as unknown as FormField[],
      };
    },
    enabled: !!formId,
  });

  return { form, isLoading, refetch };
}

// Hook for form fields management
export function useFormFields(formId: string | null) {
  const queryClient = useQueryClient();
  const fieldLog = createLogger({ context: 'FormFields' });

  // Create field mutation
  const createFieldMutation = useMutation({
    mutationFn: async (data: CreateFormFieldData) => {
      // Convert to database-compatible format
      const dbData = {
        ...data,
        options: data.options ? JSON.parse(JSON.stringify(data.options)) : null,
      };

      const { data: field, error } = await supabase
        .from('form_fields')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;
      return field as unknown as FormField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (error) => {
      fieldLog.error('Error creating:', error);
      toast.error('Error al crear campo');
    },
  });

  // Update field mutation
  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateFormFieldData> & { id: string }) => {
      // Convert to database-compatible format
      const dbData: Record<string, unknown> = { ...data };
      if (data.options !== undefined) {
        dbData.options = data.options ? JSON.parse(JSON.stringify(data.options)) : null;
      }

      const { data: field, error } = await supabase
        .from('form_fields')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return field as unknown as FormField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (error) => {
      fieldLog.error('Error updating:', error);
      toast.error('Error al actualizar campo');
    },
  });

  // Delete field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('form_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
      toast.success('Campo eliminado');
    },
    onError: (error) => {
      fieldLog.error('Error deleting:', error);
      toast.error('Error al eliminar campo');
    },
  });

  // Reorder fields mutation
  const reorderFieldsMutation = useMutation({
    mutationFn: async (fields: { id: string; position: number }[]) => {
      const updates = fields.map(({ id, position }) =>
        supabase
          .from('form_fields')
          .update({ position })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (error) => {
      fieldLog.error('Error reordering:', error);
      toast.error('Error al reordenar campos');
    },
  });

  return {
    createField: createFieldMutation.mutateAsync,
    updateField: updateFieldMutation.mutate,
    deleteField: deleteFieldMutation.mutate,
    reorderFields: reorderFieldsMutation.mutate,
    isCreating: createFieldMutation.isPending,
  };
}

// Hook for form responses
export function useFormResponses(formId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const responseLog = createLogger({ context: 'FormResponses' });

  const { data: responses = [], isLoading, refetch } = useQuery({
    queryKey: ['form-responses', formId],
    queryFn: async (): Promise<FormResponseWithRelations[]> => {
      if (!formId) return [];

      const { data, error } = await supabase
        .from('form_responses')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });

      if (error) {
        responseLog.error('Error fetching:', error);
        throw error;
      }

      return (data || []) as unknown as FormResponseWithRelations[];
    },
    enabled: !!formId,
  });

  // Update response status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('form_responses')
        .update({ 
          status,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-responses', formId] });
      toast.success('Estado actualizado');
    },
    onError: (error) => {
      responseLog.error('Error updating status:', error);
      toast.error('Error al actualizar estado');
    },
  });

  return {
    responses,
    isLoading,
    refetch,
    updateStatus: updateStatusMutation.mutate,
  };
}

// Hook for public form submission (no auth required)
export function usePublicFormSubmit() {
  const submitLog = createLogger({ context: 'PublicForm' });

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitFormData) => {
      // First get the form to get organization_id
      const { data: form, error: formError } = await supabase
        .from('forms')
        .select('id, organization_id, create_task_on_submit, default_area_id, default_assignee_id, default_task_type, default_task_priority')
        .eq('id', data.form_id)
        .eq('is_public', true)
        .eq('is_active', true)
        .single();

      if (formError || !form) {
        throw new Error('Formulario no disponible');
      }

      // Insert response - cast for Supabase JSON compatibility
      const { data: response, error: responseError } = await supabase
        .from('form_responses')
        .insert([{
          form_id: data.form_id,
          organization_id: form.organization_id,
          data: JSON.parse(JSON.stringify(data.data)),
          submitter_email: data.submitter_email || null,
          submitter_name: data.submitter_name || null,
          status: 'new' as const,
        }])
        .select()
        .single();

      if (responseError) throw responseError;

      return response;
    },
    onError: (error) => {
      submitLog.error('Error submitting:', error);
      toast.error('Error al enviar formulario');
    },
  });

  return {
    submit: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}
