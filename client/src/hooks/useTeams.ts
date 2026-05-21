import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_by: string | null;
  created_at: string;
  member_count?: number;
}

export interface TeamMember {
  id: string;
  organization_id: string;
  team_id: string;
  user_id: string;
  created_at: string;
  profile?: {
    id: string;
    name: string | null;
  };
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export function useTeams() {
  const { profile, organization } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission, isManager, isLoading: permissionsLoading } = usePermissions();
  const organizationId = organization?.id || profile?.organization_id;
  
  // Permission checks for team management - wait for permissions to load
  const canManageTeams = !permissionsLoading && (isManager || hasPermission('members.change_role'));

  const { data: teams = [], isLoading, refetch } = useQuery({
    queryKey: ['teams', organizationId],
    queryFn: async (): Promise<Team[]> => {
      if (!organizationId) return [];

      // First get teams
      const { data: teamsData, error: teamsError } = await supabaseQuery
        .from('teams')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return [];
      }

      // Get member counts
      const { data: memberCounts, error: countError } = await supabaseQuery
        .from('team_members')
        .select('team_id')
        .eq('organization_id', organizationId);

      if (countError) {
        console.error('Error fetching member counts:', countError);
      }

      // Count members per team
      const counts: Record<string, number> = {};
      memberCounts?.forEach((m: any) => {
        counts[m.team_id] = (counts[m.team_id] || 0) + 1;
      });

      return (teamsData || []).map((team: any) => ({
        ...team,
        member_count: counts[team.id] || 0,
      }));
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes - teams rarely change
  });

  const createTeam = useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string; icon?: string }) => {
      if (!organizationId) throw new Error('No organization');
      if (!canManageTeams) throw new Error('No tienes permiso para crear equipos');

      const { data: team, error } = await supabaseQuery
        .from('teams')
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description || null,
          color: data.color || '#4F46E5',
          icon: data.icon || 'users',
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Equipo creado', description: 'El equipo se ha creado correctamente' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; color?: string; icon?: string }) => {
      if (!canManageTeams) throw new Error('No tienes permiso para editar equipos');
      
      const { error } = await supabaseQuery
        .from('teams')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Equipo actualizado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTeam = useMutation({
    mutationFn: async (teamId: string) => {
      if (!canManageTeams) throw new Error('No tienes permiso para eliminar equipos');
      
      const { error } = await supabaseQuery
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Equipo eliminado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    teams,
    isLoading,
    refetch,
    createTeam: createTeam.mutate,
    updateTeam: updateTeam.mutate,
    deleteTeam: deleteTeam.mutate,
    isCreating: createTeam.isPending,
    isUpdating: updateTeam.isPending,
    isDeleting: deleteTeam.isPending,
    canManageTeams,
  };
}

export function useTeam(teamId: string | undefined) {
  const { profile, organization } = useAuth();
  const organizationId = organization?.id || profile?.organization_id;

  const { data: team, isLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async (): Promise<TeamWithMembers | null> => {
      if (!teamId || !organizationId) return null;

      const { data: teamData, error: teamError } = await supabaseQuery
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (teamError) {
        console.error('Error fetching team:', teamError);
        return null;
      }

      if (!teamData) {
        return null;
      }

      const { data: membersData, error: membersError } = await supabaseQuery
        .from('team_members')
        .select(`
          *,
          profile:profiles!team_members_user_id_fkey(id, name)
        `)
        .eq('team_id', teamId);

      if (membersError) {
        console.error('Error fetching team members:', membersError);
      }

      const members = (membersData || []).map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      }));

      return {
        ...teamData,
        members,
      };
    },
    enabled: !!teamId && !!organizationId,
  });

  return { team, isLoading };
}

export function useTeamMembers(teamId: string | undefined) {
  const { profile, organization } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = organization?.id || profile?.organization_id;

  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!teamId || !organizationId) return [];

      const { data, error } = await supabaseQuery
        .from('team_members')
        .select(`
          *,
          profile:profiles!team_members_user_id_fkey(id, name)
        `)
        .eq('team_id', teamId);

      if (error) {
        console.error('Error fetching team members:', error);
        return [];
      }

      return (data || []).map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      }));
    },
    enabled: !!teamId && !!organizationId,
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!teamId || !organizationId) throw new Error('Missing team or organization');

      const { error } = await supabaseQuery
        .from('team_members')
        .insert({
          organization_id: organizationId,
          team_id: teamId,
          user_id: userId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Miembro añadido al equipo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabaseQuery
        .from('team_members')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Miembro eliminado del equipo' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    members,
    isLoading,
    refetch,
    addMember: addMember.mutate,
    removeMember: removeMember.mutate,
    isAdding: addMember.isPending,
    isRemoving: removeMember.isPending,
  };
}
