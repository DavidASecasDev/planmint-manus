import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AreaAccessRule } from '@/types/areas';
import { toast } from '@/hooks/use-toast';

interface AccessSubject {
  id: string;
  type: 'user' | 'role' | 'team';
  name: string;
}

export function useAreaAccess(areaId?: string) {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [accessRules, setAccessRules] = useState<AreaAccessRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AccessSubject[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AccessSubject[]>([]);

  // Use permissions from RPC instead of profile.role - wait for permissions to load
  const isAdmin = !permissionsLoading && hasPermission('areas.manage_visibility');

  const fetchAccessRules = useCallback(async () => {
    if (!areaId || !profile?.organization_id) return;

    setLoading(true);
    setAccessRules([]);
    const { data, error } = await supabase
      .from('area_access_rules')
      .select('*')
      .eq('area_id', areaId)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('Error fetching access rules:', error);
    } else {
      setAccessRules(data as AreaAccessRule[]);
    }
    setLoading(false);
  }, [areaId, profile?.organization_id]);

  const fetchAvailableSubjects = useCallback(async () => {
    if (!profile?.organization_id) return;

    // Fetch users in organization
    const { data: users } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('organization_id', profile.organization_id);

    if (users) {
      setAvailableUsers(
        users.map((u) => ({
          id: u.id,
          type: 'user' as const,
          name: u.name || 'Usuario sin nombre',
        }))
      );
    }

    // Fetch custom roles via backend (bypasses RLS)
    try {
      const rolesResult = await apiInvoke<{ data: any[]; error: string | null }>('get-org-custom-roles', {
        body: { p_organization_id: profile.organization_id },
      });

      if (!rolesResult.error && rolesResult.data?.data) {
        setAvailableRoles(
          rolesResult.data.data.map((r: any) => ({
            id: r.id,
            type: 'role' as const,
            name: r.name,
          }))
        );
      }
    } catch (err) {
      console.warn('[useAreaAccess] Error fetching custom roles:', err);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchAccessRules();
    fetchAvailableSubjects();
  }, [fetchAccessRules, fetchAvailableSubjects]);

  const addAccessRule = async (
    subjectType: 'user' | 'role' | 'team',
    subjectId: string
  ): Promise<boolean> => {
    if (!areaId || !profile?.organization_id || !isAdmin) return false;

    // Check if rule already exists
    const exists = accessRules.some(
      (r) => r.subject_type === subjectType && r.subject_id === subjectId
    );
    if (exists) {
      toast({
        title: 'Regla duplicada',
        description: 'Este acceso ya está configurado',
        variant: 'destructive',
      });
      return false;
    }

    const { error } = await supabase.from('area_access_rules').insert({
      organization_id: profile.organization_id,
      area_id: areaId,
      subject_type: subjectType,
      subject_id: subjectId,
      permission: 'view',
    });

    if (error) {
      console.error('Error adding access rule:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar la regla de acceso',
        variant: 'destructive',
      });
      return false;
    }

    await fetchAccessRules();
    return true;
  };

  const removeAccessRule = async (ruleId: string): Promise<boolean> => {
    if (!isAdmin) return false;

    const { error } = await supabase
      .from('area_access_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('Error removing access rule:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la regla de acceso',
        variant: 'destructive',
      });
      return false;
    }

    await fetchAccessRules();
    return true;
  };

  const setAccessRulesForArea = async (
    newAreaId: string,
    subjects: Array<{ type: 'user' | 'role' | 'team'; id: string }>
  ): Promise<boolean> => {
    if (!profile?.organization_id || !isAdmin) return false;

    // Delete existing rules for this area
    await supabase
      .from('area_access_rules')
      .delete()
      .eq('area_id', newAreaId)
      .eq('organization_id', profile.organization_id);

    // Insert new rules
    if (subjects.length > 0) {
      const { error } = await supabase.from('area_access_rules').insert(
        subjects.map((s) => ({
          organization_id: profile.organization_id!,
          area_id: newAreaId,
          subject_type: s.type,
          subject_id: s.id,
          permission: 'view' as const,
        }))
      );

      if (error) {
        console.error('Error setting access rules:', error);
        return false;
      }
    }

    return true;
  };

  return {
    accessRules,
    loading,
    availableUsers,
    availableRoles,
    isAdmin,
    addAccessRule,
    removeAccessRule,
    setAccessRulesForArea,
    refetch: fetchAccessRules,
  };
}
