import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { SCIMToken } from '@/types/enterprise';
import { toast } from 'sonner';

// Simple hash function for demo (in production, use server-side hashing)
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function useSCIMTokens() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['scim-tokens', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabaseQuery
        .from('scim_tokens')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SCIMToken[];
    },
    enabled: !!profile?.organization_id,
  });

  const createToken = useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const plainToken = generateToken();
      const tokenHash = await hashToken(plainToken);

      const { data, error } = await supabaseQuery
        .from('scim_tokens')
        .insert({
          organization_id: profile.organization_id,
          created_by: profile.id,
          name,
          token_hash: tokenHash,
        })
        .select()
        .single();

      if (error) throw error;

      // Return both the created record and the plain token (shown once)
      return { token: data, plainToken };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim-tokens'] });
      toast.success('Token SCIM creado. Guárdalo ahora, no se mostrará de nuevo.');
    },
    onError: () => {
      toast.error('Error al crear el token SCIM');
    },
  });

  const revokeToken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery
        .from('scim_tokens')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim-tokens'] });
      toast.success('Token SCIM revocado');
    },
    onError: () => {
      toast.error('Error al revocar el token SCIM');
    },
  });

  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery
        .from('scim_tokens')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim-tokens'] });
      toast.success('Token SCIM eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar el token SCIM');
    },
  });

  const activeTokens = tokens.filter(t => t.is_active);

  return {
    tokens,
    activeTokens,
    isLoading,
    createToken: createToken.mutateAsync,
    revokeToken: revokeToken.mutate,
    deleteToken: deleteToken.mutate,
    isCreating: createToken.isPending,
    isRevoking: revokeToken.isPending,
    isDeleting: deleteToken.isPending,
  };
}
