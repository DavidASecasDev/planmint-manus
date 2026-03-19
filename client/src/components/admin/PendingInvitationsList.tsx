import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, XCircle, Mail, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Miembro',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pendiente', variant: 'secondary' },
  accepted: { label: 'Aceptada', variant: 'default' },
  revoked: { label: 'Revocada', variant: 'destructive' },
  expired: { label: 'Expirada', variant: 'outline' },
};

export function PendingInvitationsList() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: invitations = [], isLoading, refetch } = useQuery({
    queryKey: ['organization-invitations', profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_organization_invitations');
      if (error) throw error;
      return (data as unknown as OrgInvitation[]) || [];
    },
    enabled: !!profile?.organization_id,
  });

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    try {
      const { data, error } = await supabase.rpc('revoke_invitation', { p_invitation_id: invitationId });
      if (error) throw error;
      const result = data as unknown as { success?: boolean; error?: string };
      if (result?.success) {
        toast({ title: 'Invitación revocada', description: 'La invitación ha sido cancelada.' });
        refetch();
      } else {
        toast({ title: 'Error', description: result?.error || 'No se pudo revocar', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRevokingId(null);
    }
  };

  const isExpired = (inv: OrgInvitation) => {
    if (inv.status !== 'pending') return false;
    if (!inv.expires_at) return false;
    return new Date(inv.expires_at) < new Date();
  };

  const getStatus = (inv: OrgInvitation) => {
    if (isExpired(inv)) return 'expired';
    return inv.status;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invitaciones
            </CardTitle>
            <CardDescription>
              Invitaciones enviadas a nuevos miembros de tu organización
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No hay invitaciones enviadas</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviada</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => {
                const status = getStatus(inv);
                const config = statusConfig[status] || statusConfig.pending;
                const canRevoke = status === 'pending';

                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabels[inv.role] || inv.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(inv.created_at), 'PP', { locale: es })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {inv.expires_at
                        ? format(new Date(inv.expires_at), 'PP', { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {canRevoke && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revokingId === inv.id}
                          className="text-destructive hover:text-destructive"
                        >
                          {revokingId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Revocar
                            </>
                          )}
                        </Button>
                      )}
                      {status === 'accepted' && inv.accepted_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(inv.accepted_at), 'PP', { locale: es })}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
