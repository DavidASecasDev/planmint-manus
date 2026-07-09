import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface LinkEmployeeAsBrokerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkEmployeeAsBrokerDialog({
  open,
  onOpenChange,
}: LinkEmployeeAsBrokerDialogProps) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState('');

  // Fetch organization members
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['org-members-for-broker-link', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await (supabase as any)
        .from('organization_members')
        .select('user_id, profiles!inner(id, name)')
        .eq('organization_id', organization.id)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        name: m.profiles?.name || 'Sin nombre',
      }));
    },
    enabled: open && !!organization?.id,
    staleTime: 30_000,
  });

  // Fetch existing broker profiles to exclude already-linked members
  const { data: existingBrokerProfiles = [] } = useQuery({
    queryKey: ['existing-broker-profiles', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await (supabase as any)
        .from('broker_profiles')
        .select('user_id')
        .eq('organization_id', organization.id);
      if (error) return [];
      return (data || []).map((p: any) => p.user_id);
    },
    enabled: open && !!organization?.id,
    staleTime: 30_000,
  });

  // Filter out members who already have broker access
  const availableMembers = useMemo(() => {
    const linkedSet = new Set(existingBrokerProfiles);
    return members.filter((m: any) => !linkedSet.has(m.user_id));
  }, [members, existingBrokerProfiles]);

  // Filter by search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return availableMembers;
    const term = search.toLowerCase();
    return availableMembers.filter((m: any) =>
      m.name?.toLowerCase().includes(term)
    );
  }, [availableMembers, search]);

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await apiInvoke<{ success: boolean; message?: string; error?: string; already_linked?: boolean }>('link-employee-as-broker', {
        body: { memberId },
      });
      const payload = (result as any)?.data || result;
      if (payload?.error) throw new Error(payload.error);
      if (payload?.already_linked) throw new Error('Este empleado ya tiene acceso al portal de brokers');
      return payload as { success: boolean; message?: string };
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Empleado vinculado como broker');
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'] });
      queryClient.invalidateQueries({ queryKey: ['existing-broker-profiles'] });
      onOpenChange(false);
      setSelectedMemberId(null);
      setSelectedMemberName('');
      setSearch('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al vincular empleado');
    },
  });

  const handleConfirm = () => {
    if (!selectedMemberId) return;
    linkMutation.mutate(selectedMemberId);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedMemberId(null);
    setSelectedMemberName('');
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Empleado como Broker</DialogTitle>
          <DialogDescription>
            Selecciona un miembro del equipo para darle acceso al portal de brokers sin necesidad de invitación o registro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Member list */}
          <ScrollArea className="h-[240px] border rounded-md">
            {loadingMembers ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
                {availableMembers.length === 0
                  ? 'Todos los miembros ya tienen acceso al portal de brokers'
                  : 'No se encontraron empleados con ese nombre'}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map((member: any) => (
                  <button
                    key={member.user_id}
                    onClick={() => {
                      setSelectedMemberId(member.user_id);
                      setSelectedMemberName(member.name);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left transition-colors ${
                      selectedMemberId === member.user_id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                    {selectedMemberId === member.user_id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected indicator */}
          {selectedMemberName && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <UserPlus className="h-3 w-3" />
                {selectedMemberName}
              </Badge>
              <span className="text-muted-foreground">tendrá acceso al portal de brokers</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedMemberId || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Vincular como Broker
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
