import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Area, CreateAreaData, UpdateAreaData, AreaFilter, AreaVisibility } from '@/types/areas';
import { toast } from '@/hooks/use-toast';
import { ERROR_MESSAGES, createErrorHandler } from '@/lib/errorHandler';
import { apiInvoke } from '@/lib/apiClient';

const errorHandler = createErrorHandler('useAreas');

export function useAreas() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AreaFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const orgId = profile?.organization_id;

  // Use permission engine instead of profile.role
  const canCreate = hasPermission('areas.create');
  const canEdit = hasPermission('areas.update');
  const canDelete = hasPermission('areas.delete');
  const canManageVisibility = hasPermission('areas.manage_visibility');

  const { data: areas = [], isLoading: loading, refetch: fetchAreas } = useQuery({
    queryKey: ['areas', orgId, filter],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from('areas')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      // Apply filter
      if (filter === 'active') {
        query = query.eq('is_archived', false);
      } else if (filter === 'archived') {
        query = query.eq('is_archived', true);
      }

      const { data, error } = await query;

      if (error) {
        errorHandler.log('Error fetching areas', error);
        toast({
          title: ERROR_MESSAGES.areas.loadError.title,
          description: ERROR_MESSAGES.areas.loadError.description,
          variant: 'destructive',
        });
        return [];
      }

      // RLS will filter based on visibility - user only sees what they're allowed to
      return ((data || []).map(a => ({
        ...a,
        visibility: (a.visibility as AreaVisibility) || 'org',
      }))) as Area[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - areas rarely change
  });

  const invalidateAreas = () => {
    queryClient.invalidateQueries({ queryKey: ['areas', orgId] });
  };

  const createArea = async (
    data: CreateAreaData,
    accessSubjects?: Array<{ type: 'user' | 'role' | 'team'; id: string }>
  ): Promise<boolean> => {
    if (!orgId) return false;

    const { data: newArea, error } = await apiInvoke<Area>('create-area-secure', {
      body: {
        p_name: data.name,
        p_description: data.description ?? undefined,
        p_color: data.color,
        p_icon: data.icon,
        p_visibility: data.visibility || 'org',
      },
    });

    if (error) {
      errorHandler.log('Error creating area', error);
      const errMsg = error.message || '';
      if (errMsg.includes('23505') || errMsg.includes('Duplicate')) {
        toast({
          title: ERROR_MESSAGES.areas.duplicateName.title,
          description: ERROR_MESSAGES.areas.duplicateName.description,
          variant: 'destructive',
        });
      } else if (errMsg.includes('42501') || errMsg.includes('permission')) {
        toast({
          title: ERROR_MESSAGES.areas.noPermission.title,
          description: ERROR_MESSAGES.areas.noPermission.description,
          variant: 'destructive',
        });
      } else {
        toast({
          title: ERROR_MESSAGES.areas.createError.title,
          description: ERROR_MESSAGES.areas.createError.description,
          variant: 'destructive',
        });
      }
      return false;
    }

    // If custom visibility, add access rules
    if (data.visibility === 'custom' && accessSubjects && accessSubjects.length > 0 && newArea) {
      const { error: accessError } = await supabase
        .from('area_access_rules')
        .insert(
          accessSubjects.map((s) => ({
            organization_id: orgId!,
            area_id: newArea.id,
            subject_type: s.type,
            subject_id: s.id,
            permission: 'view' as const,
          }))
        );

      if (accessError) {
        errorHandler.log('Error creating access rules', accessError);
        toast({
          title: 'Advertencia',
          description: 'El área fue creada pero hubo un error al configurar el acceso',
          variant: 'destructive',
        });
      }
    }

    toast({
      title: '¡Área creada!',
      description: `${data.name} ha sido creada exitosamente`,
    });

    invalidateAreas();
    return true;
  };

  const updateArea = async (
    id: string, 
    data: UpdateAreaData,
    accessSubjects?: Array<{ type: 'user' | 'role' | 'team'; id: string }>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('areas')
      .update(data)
      .eq('id', id);

    if (error) {
      errorHandler.log('Error updating area', error);
      if (error.code === '23505') {
        toast({
          title: ERROR_MESSAGES.areas.duplicateName.title,
          description: ERROR_MESSAGES.areas.duplicateName.description,
          variant: 'destructive',
        });
      } else {
        toast({
          title: ERROR_MESSAGES.areas.updateError.title,
          description: ERROR_MESSAGES.areas.updateError.description,
          variant: 'destructive',
        });
      }
      return false;
    }

    // If visibility changed to custom, update access rules
    if (data.visibility === 'custom' && accessSubjects && orgId) {
      // Delete existing rules
      await supabase
        .from('area_access_rules')
        .delete()
        .eq('area_id', id)
        .eq('organization_id', orgId);

      // Insert new rules
      if (accessSubjects.length > 0) {
        const { error: accessError } = await supabase
          .from('area_access_rules')
          .insert(
            accessSubjects.map((s) => ({
              organization_id: orgId!,
              area_id: id,
              subject_type: s.type,
              subject_id: s.id,
              permission: 'view' as const,
            }))
          );

        if (accessError) {
          errorHandler.log('Error updating access rules', accessError);
        }
      }
    } else if (data.visibility && data.visibility !== 'custom' && orgId) {
      // If visibility changed FROM custom, clear access rules
      await supabase
        .from('area_access_rules')
        .delete()
        .eq('area_id', id)
        .eq('organization_id', orgId);
    }

    toast({
      title: 'Área actualizada',
      description: 'Los cambios han sido guardados',
    });

    invalidateAreas();
    return true;
  };

  const archiveArea = async (id: string, archive: boolean): Promise<boolean> => {
    const { error } = await supabase
      .from('areas')
      .update({ is_archived: archive })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: `No se pudo ${archive ? 'archivar' : 'desarchivar'} el área`,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: archive ? 'Área archivada' : 'Área restaurada',
      description: archive 
        ? 'El área ha sido archivada' 
        : 'El área ha sido restaurada',
    });

    invalidateAreas();
    return true;
  };

  const deleteArea = async (id: string): Promise<boolean> => {
    // Access rules will be cascade deleted
    const { error } = await supabase
      .from('areas')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el área',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Área eliminada',
      description: 'El área ha sido eliminada permanentemente',
    });

    invalidateAreas();
    return true;
  };

  // Filter areas by search query (client-side)
  const filteredAreas = areas.filter(area =>
    area.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (area.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return {
    areas: filteredAreas,
    loading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    canCreate,
    canEdit,
    canDelete,
    canManageVisibility,
    createArea,
    updateArea,
    archiveArea,
    deleteArea,
    refetch: fetchAreas,
  };
}
