import { useMemo, useState } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, XCircle, Search, Send } from 'lucide-react';
import {
  OutboundNotificationChannel,
  OutboundNotificationStatus,
  SuperAdminOutboundNotificationRow,
  useSuperAdminOutboundNotifications,
} from '@/hooks/useSuperAdminOutboundNotifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type ActionType = 'retry' | 'cancel';

function getStatusBadge(status: OutboundNotificationStatus) {
  switch (status) {
    case 'sent':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">enviado</Badge>;
    case 'failed':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20">fallido</Badge>;
    case 'pending':
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">pendiente</Badge>;
    case 'skipped':
    default:
      return <Badge variant="secondary">omitido</Badge>;
  }
}

function getChannelBadge(channel: OutboundNotificationChannel) {
  const label = channel.toUpperCase();
  return <Badge variant="outline">{label}</Badge>;
}

export default function SuperAdminOperations() {
  const [status, setStatus] = useState<OutboundNotificationStatus | 'all'>('failed');
  const [channel, setChannel] = useState<OutboundNotificationChannel | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useSuperAdminOutboundNotifications({
    status,
    channel,
    search,
    limit: 200,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>('retry');
  const [actionTarget, setActionTarget] = useState<SuperAdminOutboundNotificationRow | null>(null);
  const [reason, setReason] = useState('');
  const [isActing, setIsActing] = useState(false);

  const openAction = (type: ActionType, target: SuperAdminOutboundNotificationRow) => {
    setActionType(type);
    setActionTarget(target);
    setReason('');
    setActionOpen(true);
  };

  const runAction = async () => {
    if (!actionTarget) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error('El motivo es obligatorio');
      return;
    }

    setIsActing(true);
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke('superadmin-outbound', {
        body: {
          outbound_notification_id: actionTarget.id,
          action: actionType,
          reason: trimmedReason,
        },
      });

      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);

      toast.success(actionType === 'retry' ? 'Reintento ejecutado' : 'Cancelación aplicada');
      setActionOpen(false);
      setActionTarget(null);
      await refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error ejecutando acción';
      console.error('[SuperAdminOperations] action error', e);
      toast.error(msg);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <SuperAdminLayout title="Operaciones">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Consola de trabajos
            </CardTitle>
            <CardDescription>
              Monitoriza y gestiona envíos de notificaciones externas (push/email/slack/whatsapp).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="outbound">
              <TabsList className="mb-4">
                <TabsTrigger value="outbound">Notificaciones externas</TabsTrigger>
              </TabsList>

              <TabsContent value="outbound" className="space-y-4">
                <div className="flex gap-3 flex-wrap items-center">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por organización..."
                      className="pl-9"
                    />
                  </div>

                  <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="failed">fallido</SelectItem>
                      <SelectItem value="pending">pendiente</SelectItem>
                      <SelectItem value="sent">enviado</SelectItem>
                      <SelectItem value="skipped">omitido</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="push">push</SelectItem>
                      <SelectItem value="email">email</SelectItem>
                      <SelectItem value="slack">slack</SelectItem>
                      <SelectItem value="whatsapp">whatsapp</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                </div>

                {error ? (
                  <div className="text-sm text-destructive">Error cargando: {(error as any)?.message ?? 'unknown'}</div>
                ) : isLoading ? (
                  <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No hay outbound notifications con estos filtros.
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Org</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Detalle</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(r.created_at), 'd MMM, HH:mm', { locale: es })}
                            </TableCell>
                            <TableCell className="font-medium">{r.organizations?.name ?? r.organization_id}</TableCell>
                            <TableCell>{r.profiles?.name ?? r.user_id}</TableCell>
                            <TableCell>{getChannelBadge(r.channel)}</TableCell>
                            <TableCell>{getStatusBadge(r.status)}</TableCell>
                            <TableCell className="max-w-[380px]">
                              <div className="space-y-1">
                                <div className="text-sm font-medium line-clamp-1">
                                  {(r.payload as any)?.title ?? '—'}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-1">
                                  {r.error_message ? `Error: ${r.error_message}` : ((r.payload as any)?.body ?? '—')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAction('retry', r)}
                                  disabled={r.status !== 'failed'}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Reintentar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAction('cancel', r)}
                                  disabled={r.status !== 'pending'}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={actionOpen} onOpenChange={setActionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'retry' ? 'Reintentar envío' : 'Cancelar envío'}
              </DialogTitle>
              <DialogDescription>
                Confirma la acción y deja un motivo (obligatorio). Esto quedará registrado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="text-sm">
                <div className="text-muted-foreground">Destino</div>
                <div className="font-medium">
                  {actionTarget?.organizations?.name ?? actionTarget?.organization_id} ·{' '}
                  {actionTarget?.channel}
                </div>
              </div>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo (p. ej. 'Reintento manual tras corregir configuración')"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActionOpen(false)} disabled={isActing}>
                Volver
              </Button>
              <Button
                onClick={runAction}
                disabled={isActing}
                variant={actionType === 'cancel' ? 'destructive' : 'default'}
              >
                {isActing ? 'Procesando…' : actionType === 'retry' ? 'Reintentar' : 'Cancelar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
