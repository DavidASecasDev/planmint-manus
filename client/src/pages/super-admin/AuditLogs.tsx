import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from './SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Download, Filter, History, Building2, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/10 text-green-600 border-green-500/20',
  update: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-600 border-red-500/20',
  login: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  logout: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-audit-logs', page, actionFilter, entityFilter, search],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          organizations!inner (name),
          profiles:actor_user_id (name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      if (search) {
        query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { logs: data || [], total: count || 0 };
    },
  });

  const handleExport = () => {
    if (!data?.logs) return;

    const csv = [
      ['Fecha', 'Organización', 'Usuario', 'Acción', 'Entidad', 'ID Entidad', 'IP'].join(','),
      ...data.logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        (log.organizations as any)?.name || '',
        (log.profiles as any)?.name || 'Sistema',
        log.action,
        log.entity_type,
        log.entity_id || '',
        log.ip_address || '',
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const uniqueActions = [...new Set(data?.logs.map(l => l.action.split('.')[0]) || [])];
  const uniqueEntities = [...new Set(data?.logs.map(l => l.entity_type) || [])];

  return (
    <SuperAdminLayout title="Audit Logs">
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
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px]">
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
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las entidades</SelectItem>
                  {uniqueEntities.map(entity => (
                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                  ))}
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
                  <TableHead>Usuario</TableHead>
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
                              {(log.organizations as any)?.name || 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {(log.profiles as any)?.name || 'Sistema'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={ACTION_COLORS[actionType] || 'bg-muted'}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.entity_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.entity_id?.slice(0, 8)}...
                          </span>
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
    </SuperAdminLayout>
  );
}
