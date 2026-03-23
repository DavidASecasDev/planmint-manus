import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiClient';
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
      const { data, error } = await apiInvoke<OrgInvitation[]>('get-organization-invitations');
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    try {
      const { data: result, error } = await apiInvoke<{ success?: boolean; error?: string }>('revoke-invitation', {
        body: { p_invitation_id: invitationId },
      });
      if (error) throw new Error(error.message);
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invitaciones
          </CardTitle>
          <CardDescription>Invitaciones enviadas a nuevos miembros</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay invitaciones enviadas aún.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => {
                const status = getStatus(inv);
                const config = statusConfig[status] || statusConfig.pending;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>{roleLabels[inv.role] || inv.role}</TableCell>
                    <TableCell>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(inv.created_at), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.expires_at
                        ? format(new Date(inv.expires_at), 'dd MMM yyyy', { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revokingId === inv.id}
                        >
                          {revokingId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
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
