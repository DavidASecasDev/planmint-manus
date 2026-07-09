import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransferRequests } from '@/hooks/useTransferRequests';
import { usePermissions } from '@/hooks/usePermissions';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { TransfersCalendar } from '@/components/transfers/TransfersCalendar';
import { TransfersWeeklyCalendar } from '@/components/transfers/TransfersWeeklyCalendar';
import { TransfersDailySummary } from '@/components/transfers/TransfersDailySummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Ship, Building2, MapPin, Clock, Phone, Copy, Trash2, ChevronRight, List, CalendarDays, CalendarRange, LayoutGrid, FileDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CLIENT_TYPE_META, VEHICLE_TYPE_META } from '@/types/transfers';
import type { TransferRequestStatus, ClientType, TransferFilters } from '@/types/transfers';

export default function Transfers() {
  const { session } = useAuth();

  const handleDownloadPdf = async (e: React.MouseEvent, requestId: string, requestNumber: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/transfer-pdf/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Error al generar PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transfer-${requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
    }
  };

  const navigate = useNavigate();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canCreate = !permissionsLoading && (hasPermission('transfers.create') || hasPermission('transfers.manage'));
  const [filters, setFilters] = useState<Partial<TransferFilters>>({
    search: '',
    status: 'all',
    clientType: 'all',
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'weekly' | 'daily'>(() => {
    return (localStorage.getItem('transfers_view_mode') as 'list' | 'calendar' | 'weekly' | 'daily') || 'calendar';
  });

  const handleViewModeChange = (mode: 'list' | 'calendar' | 'weekly' | 'daily') => {
    setViewMode(mode);
    localStorage.setItem('transfers_view_mode', mode);
  };

  const { requests, isLoading, cloneRequest, deleteRequest } = useTransferRequests(filters);

  const stats = useMemo(() => {
    const total = requests.length;
    const pendiente = requests.filter(r => r.status === 'pendiente').length;
    const aceptado = requests.filter(r => r.status === 'aceptado' || r.status === 'conductor_asignado').length;
    const en_curso = requests.filter(r => r.status === 'en_curso').length;
    const completado = requests.filter(r => r.status === 'completado').length;
    return { total, pendiente, aceptado, en_curso, completado };
  }, [requests]);

  return (
    <AppLayout title="Transfers">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transfers</h1>
          <p className="text-muted-foreground">Gestión de solicitudes de transfer</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-9"
              onClick={() => handleViewModeChange('list')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-9"
              onClick={() => handleViewModeChange('calendar')}
              title="Calendario mensual"
            >
              <CalendarDays className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-9"
              onClick={() => handleViewModeChange('weekly')}
              title="Vista semanal"
            >
              <CalendarRange className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'daily' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-9"
              onClick={() => handleViewModeChange('daily')}
              title="Resumen diario"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          {canCreate && (
            <Button onClick={() => navigate('/transfers/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Solicitud
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setFilters(f => ({ ...f, status: 'all' }))}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-yellow-500/50" onClick={() => setFilters(f => ({ ...f, status: 'pendiente' }))}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.pendiente}</div>
            <div className="text-xs text-muted-foreground">Pendientes</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-blue-500/50" onClick={() => setFilters(f => ({ ...f, status: 'aceptado' }))}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.aceptado}</div>
            <div className="text-xs text-muted-foreground">Aceptados</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-orange-500/50" onClick={() => setFilters(f => ({ ...f, status: 'en_curso' }))}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.en_curso}</div>
            <div className="text-xs text-muted-foreground">En curso</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500/50" onClick={() => setFilters(f => ({ ...f, status: 'completado' }))}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completado}</div>
            <div className="text-xs text-muted-foreground">Completados</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, broker o número..."
            className="pl-9"
            value={filters.search || ''}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v as TransferRequestStatus | 'all' }))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="aceptado">Aceptado</SelectItem>
            <SelectItem value="conductor_asignado">Conductor asignado</SelectItem>
            <SelectItem value="en_curso">En curso</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
            <SelectItem value="rechazado">Rechazado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.clientType || 'all'} onValueChange={v => setFilters(f => ({ ...f, clientType: v as ClientType | 'all' }))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="villa">Villa</SelectItem>
            <SelectItem value="charter">Charter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calendar view */}
      {viewMode === 'calendar' && (
        <TransfersCalendar requests={requests} />
      )}

      {/* Weekly view */}
      {viewMode === 'weekly' && (
        <TransfersWeeklyCalendar requests={requests} />
      )}

      {/* Daily summary view */}
      {viewMode === 'daily' && (
        <TransfersDailySummary requests={requests} />
      )}

      {/* Request list */}
      {viewMode === 'list' && (isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Card key={i} className="animate-pulse h-24" />)}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No hay solicitudes de transfer
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map(request => {
            const clientMeta = CLIENT_TYPE_META[request.client_type as ClientType];
            const ClientIcon = request.client_type === 'charter' ? Ship : Building2;
            const firstItem = request.items?.[0];
            return (
              <Card
                key={request.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/transfers/requests/${request.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{request.request_number}</span>
                        <TransferStatusBadge status={request.status} />
                        {clientMeta && (
                          <Badge variant="outline" className={clientMeta.color}>
                            <ClientIcon className="w-3 h-3 mr-1" />
                            {clientMeta.label}
                          </Badge>
                        )}
                        {request.items_count && request.items_count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {request.items_count} servicio{request.items_count > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      {/* Client & broker */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">{request.client_name}</span>
                        <span className="text-muted-foreground">· {request.broker_name}</span>
                        {request.client_phone && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {request.client_phone}
                          </span>
                        )}
                      </div>
                      {/* First item preview */}
                      {firstItem && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {firstItem.transfer_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(firstItem.transfer_date), 'dd MMM yyyy', { locale: es })}
                              {firstItem.transfer_time && ` ${firstItem.transfer_time.slice(0, 5)}`}
                            </span>
                          )}
                          {firstItem.pickup_location && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {firstItem.pickup_location}
                            </span>
                          )}
                          {firstItem.vehicle_type && (
                            <span>{VEHICLE_TYPE_META[firstItem.vehicle_type as keyof typeof VEHICLE_TYPE_META]?.label}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={e => handleDownloadPdf(e, request.id, request.request_number)}
                        title="Descargar PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={e => { e.stopPropagation(); cloneRequest(request.id); }}
                        title="Clonar"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {request.status === 'pendiente' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar esta solicitud?')) deleteRequest(request.id); }}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
    </AppLayout>
  );
}
