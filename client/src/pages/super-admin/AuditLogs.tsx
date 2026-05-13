import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from './SuperAdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Download, History, Building2, User, Calendar, Shield, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Action labels and colors ───────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/10 text-green-600 border-green-500/20',
  update: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-600 border-red-500/20',
  login: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  logout: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const ACTION_LABELS: Record<string, string> = {
  'create.member': 'Miembro añadido',
  'update.member_role': 'Rol cambiado',
  'update.member_reactivated': 'Miembro reactivado',
  'update.member_suspended': 'Miembro suspendido',
  'delete.member': 'Miembro eliminado',
  'update.org_status': 'Estado org. cambiado',
  'delete.organization': 'Organización eliminada',
  'update.org_plan': 'Plan cambiado',
  'update.feedback': 'Feedback actualizado',
  'delete.feedback': 'Feedback eliminado',
  'delete.task': 'Tarea eliminada',
  'delete.area': 'Área eliminada',
};

const ENTITY_LABELS: Record<string, string> = {
  organization_member: 'Miembro',
  organization: 'Organización',
  subscription: 'Suscripción',
  user_feedback: 'Feedback',
  task: 'Tarea',
  area: 'Área',
};

// ─── Metadata formatter ─────────────────────────────────────────────────────

function formatMetadata(metadata: unknown): string | null {
  if (!metadata) return null;
  try {
    // metadata_json can come as an object (from Supabase) or as a string
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    if (typeof parsed !== 'object' || parsed === null) return String(parsed);
    const parts: string[] = [];
    if (parsed.targetUserName) parts.push(`Usuario: ${parsed.targetUserName}`);
    if (parsed.orgName) parts.push(`Org: ${parsed.orgName}`);
    if (parsed.oldRole && parsed.newRole) parts.push(`Rol: ${parsed.oldRole} → ${parsed.newRole}`);
    if (parsed.role && !parsed.oldRole) parts.push(`Rol: ${parsed.role}`);
    if (parsed.oldStatus && parsed.newStatus) parts.push(`Estado: ${parsed.oldStatus} → ${parsed.newStatus}`);
    if (parsed.oldPlan && parsed.newPlan) parts.push(`Plan: ${parsed.oldPlan} → ${parsed.newPlan}`);
    if (parsed.taskTitle) parts.push(`Tarea: ${parsed.taskTitle}`);
    if (parsed.areaName) parts.push(`Área: ${parsed.areaName}`);
    if (parsed.deletedMembers !== undefined) parts.push(`Miembros eliminados: ${parsed.deletedMembers}`);
    if (parsed.deletedTasks !== undefined) parts.push(`Tareas eliminadas: ${parsed.deletedTasks}`);
    if (parsed.deletedAreas !== undefined) parts.push(`Áreas eliminadas: ${parsed.deletedAreas}`);
    if (parsed.reactivated) parts.push('(Reactivación)');
    if (parsed.email) parts.push(`Email: ${parsed.email}`);
    return parts.length > 0 ? parts.join(' · ') : JSON.stringify(parsed);
  } catch {
    return String(metadata);
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-audit-logs', page, actionFilter, entityFilter, roleFilter, search],
    queryFn: async () => {
      // Use left join (remove !inner) so logs without org_id still appear
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          organizations!audit_logs_organization_id_fkey (name),
          actor:profiles!audit_logs_actor_user_id_fkey (id, name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      if (roleFilter !== 'all') {
        query = query.eq('actor_role', roleFilter);
      }

      if (search) {
        query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%,metadata_json.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { logs: data || [], total: count || 0 };
    },
  });

  const handleExport = () => {
    if (!data?.logs) return;

    const csv = [
      ['Fecha', 'Organización', 'Usuario', 'Rol Actor', 'Acción', 'Entidad', 'ID Entidad', 'Detalles', 'IP'].join(','),
      ...data.logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        (log.organizations as any)?.name || 'Plataforma',
        (typeof (log.actor as any)?.name === 'string' ? (log.actor as any).name : 'Sistema'),
        log.actor_role || '',
        ACTION_LABELS[log.action] || log.action,
        ENTITY_LABELS[log.entity_type] || log.entity_type,
        log.entity_id || '',
        formatMetadata(log.metadata_json) || '',
        log.ip_address || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <SuperAdminLayout title="Audit Logs">
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Registro de Auditoría</h2>
                <p className="text-sm text-muted-foreground">
                  {data?.total || 0} registros totales
                </p>
              </div>
            </div>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar en logs..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Acción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las acciones</SelectItem>
                    <SelectItem value="create">Crear</SelectItem>
                    <SelectItem value="update">Actualizar</SelectItem>
                    <SelectItem value="delete">Eliminar</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Entidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las entidades</SelectItem>
                    <SelectItem value="organization_member">Miembros</SelectItem>
                    <SelectItem value="organization">Organizaciones</SelectItem>
                    <SelectItem value="subscription">Suscripciones</SelectItem>
                    <SelectItem value="user_feedback">Feedback</SelectItem>
                    <SelectItem value="task">Tareas</SelectItem>
                    <SelectItem value="area">Áreas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Rol actor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Miembro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Organización</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay logs de auditoría
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.logs.map((log) => {
                      const actionType = log.action.split('.')[0];
                      const isSuperAdmin = log.actor_role === 'super_admin';
                      const metadataStr = formatMetadata(log.metadata_json);

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {format(new Date(log.created_at), "d MMM, HH:mm", { locale: es })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {(log.organizations as any)?.name || 'Plataforma'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isSuperAdmin ? (
                                <Shield className="h-4 w-4 text-amber-500" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm">
                                  {typeof (log.actor as any)?.name === 'string' ? (log.actor as any).name : 'Sistema'}
                                </span>
                                {isSuperAdmin && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 w-fit">
                                    Super Admin
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={ACTION_COLORS[actionType] || 'bg-muted'}
                            >
                              {ACTION_LABELS[log.action] || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {ENTITY_LABELS[log.entity_type] || log.entity_type}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            {metadataStr ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                      {metadataStr}
                                    </span>
                                    <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-sm">
                                  <p className="text-xs whitespace-pre-wrap">{metadataStr}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">
                                {log.entity_id?.slice(0, 8)}...
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {data && data.total > pageSize && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {page * pageSize + 1} - {Math.min((page + 1) * pageSize, data.total)} de {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * pageSize >= data.total}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </SuperAdminLayout>
  );
}
