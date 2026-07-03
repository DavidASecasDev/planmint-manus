/**
 * Audit History Page
 * Shows a full history of operational field changes (Check-in, Pagado, Hosp, Contacto)
 * with filters by date, user, and reservation.
 * Protected by 'reservations.view_checkin_audit' permission.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Download, History, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiInvoke } from '@/lib/apiClient';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Field labels and colors ───────────────────────────────────────────────

const FIELD_COLORS: Record<string, string> = {
  checkin: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  pagado: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  hosp: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  contacto: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
};

const FIELD_LABELS: Record<string, string> = {
  checkin: 'Check-in',
  checkin_entrega: 'Check-in (Entrega)',
  checkin_devolucion: 'Check-in (Devolución)',
  pagado: 'Pagado',
  pagado_entrega: 'Pagado (Entrega)',
  pagado_devolucion: 'Pagado (Devolución)',
  hosp: 'Hosp',
  hosp_entrega: 'Hosp (Entrega)',
  hosp_devolucion: 'Hosp (Devolución)',
  contacto: 'Contacto',
  contacto_entrega: 'Contacto (Entrega)',
  contacto_devolucion: 'Contacto (Devolución)',
};

const OPERATION_LABELS: Record<string, string> = {
  entrega: 'Entrega',
  devolucion: 'Devolución',
  transfer: 'Transfer',
};

function getBaseField(fieldName: string): string {
  return fieldName.replace(/_entrega$|_devolucion$/, '');
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  reservation_id: string;
  operation_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string;
  changed_by_name: string;
  changed_by_user_id: string | null;
  created_at: string;
}

interface AuditResponse {
  ok: boolean;
  data: {
    items: AuditEntry[];
    total: number;
    page: number;
    limit: number;
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AuditHistory() {
  const { hasPermission, isOwner, isLoading: permissionsLoading } = usePermissions();
  const [fieldFilter, setFieldFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [reservationSearch, setReservationSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const canView = isOwner || hasPermission('reservations.view_checkin_audit');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-history', page, fieldFilter, userSearch, reservationSearch, dateFrom, dateTo],
    queryFn: async () => {
      const result = await apiInvoke<AuditResponse>('get-audit-history', {
        body: {
          page,
          limit: pageSize,
          field_name: fieldFilter !== 'all' ? fieldFilter : undefined,
          changed_by_name: userSearch || undefined,
          reservation_search: reservationSearch || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
      if (result.error || !result.data?.ok) {
        throw new Error((result.data as any)?.error || 'Error al cargar historial');
      }
      return result.data.data;
    },
    enabled: canView,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const handleExport = () => {
    if (!data?.items) return;

    const csv = [
      ['Fecha', 'Reserva', 'Operación', 'Campo', 'Valor Anterior', 'Nuevo Valor', 'Modificado por'].join(','),
      ...data.items.map(entry => [
        format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss'),
        entry.reservation_id,
        OPERATION_LABELS[entry.operation_type] || entry.operation_type,
        FIELD_LABELS[entry.field_name] || entry.field_name,
        entry.old_value || '(vacío)',
        entry.new_value,
        entry.changed_by_name,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (permissionsLoading) {
    return (
      <AppLayout title="Historial de Auditoría">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!canView) {
    return (
      <AppLayout title="Historial de Auditoría">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground max-w-md">
            No tienes permiso para ver el historial de auditoría. Contacta con el administrador para solicitar acceso.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Historial de Auditoría" fullWidth>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold font-heading">Historial de Auditoría</h1>
              <p className="text-sm text-muted-foreground">
                Registro de cambios en Check-in, Pagado, Hosp y Contacto
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data?.items?.length}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Campo</label>
                <Select value={fieldFilter} onValueChange={(v) => { setFieldFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="checkin">Check-in</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="hosp">Hosp</SelectItem>
                    <SelectItem value="contacto">Contacto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Usuario</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setPage(1); }}
                    className="pl-8 w-[180px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Reserva</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="ID reserva..."
                    value={reservationSearch}
                    onChange={(e) => { setReservationSearch(e.target.value); setPage(1); }}
                    className="pl-8 w-[180px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="w-[150px]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="w-[150px]"
                />
              </div>

              {(fieldFilter !== 'all' || userSearch || reservationSearch || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFieldFilter('all');
                    setUserSearch('');
                    setReservationSearch('');
                    setDateFrom('');
                    setDateTo('');
                    setPage(1);
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Fecha</TableHead>
                  <TableHead className="w-[120px]">Campo</TableHead>
                  <TableHead className="w-[100px]">Operación</TableHead>
                  <TableHead className="w-[140px]">Reserva</TableHead>
                  <TableHead className="w-[120px]">Valor Anterior</TableHead>
                  <TableHead className="w-[120px]">Nuevo Valor</TableHead>
                  <TableHead>Modificado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No se encontraron registros de auditoría
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((entry) => {
                    const baseField = getBaseField(entry.field_name);
                    const colorClass = FIELD_COLORS[baseField] || 'bg-gray-500/10 text-gray-600 border-gray-500/20';
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm tabular-nums">
                          {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${colorClass}`}>
                            {FIELD_LABELS[entry.field_name] || entry.field_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {OPERATION_LABELS[entry.operation_type] || entry.operation_type}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-xs">
                          {entry.reservation_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.old_value || <span className="italic">(vacío)</span>}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {entry.new_value}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.changed_by_name}
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, data?.total || 0)} de {data?.total || 0} registros
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
