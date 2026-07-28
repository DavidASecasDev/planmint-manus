/**
 * Azul Cars Brand — Broker Dashboard (Redesigned)
 * Calendar is the default view, with toggle to list view
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useBrokerRequests, BrokerFilters } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { BrokerCalendar } from '@/components/broker/BrokerCalendar';
import { BrokerWeeklyCalendar } from '@/components/broker/BrokerWeeklyCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  LayoutList,
  UserCheck,
  Car,
  Ship,
  Building2,
  CalendarDays,
  List,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TransferRequest } from '@/types/transfers';

type ViewMode = 'calendar' | 'weekly' | 'list';

export default function BrokerDashboard() {
  const { broker } = useBrokerAuth();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('broker-dashboard-view');
    return (saved === 'list' || saved === 'calendar' || saved === 'weekly') ? saved as ViewMode : 'calendar';
  });

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('broker-dashboard-view', mode);
  };

  const [filters, setFilters] = usePersistedFilters<BrokerFilters>({
    search: '',
    status: 'all',
    brokerId: 'all',
  });

  const { requests, brokers, stats, isLoading } = useBrokerRequests(filters);

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value as BrokerFilters['status'] }));
  };

  const handleBrokerChange = (value: string) => {
    setFilters((prev) => ({ ...prev, brokerId: value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<LayoutList className="h-5 w-5" />}
          accentColor="hsl(var(--foreground))"
        />
        <StatCard
          label="Pendientes"
          value={stats.pendiente}
          icon={<Clock className="h-5 w-5" />}
          accentColor="#D97706"
        />
        <StatCard
          label="Aceptados"
          value={stats.aceptado}
          icon={<UserCheck className="h-5 w-5" />}
          accentColor="#2563EB"
        />
        <StatCard
          label="En curso"
          value={stats.en_curso}
          icon={<Car className="h-5 w-5" />}
          accentColor="#EA580C"
        />
        <StatCard
          label="Completados"
          value={stats.completado}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accentColor="#16A34A"
        />
        <div className="col-span-2 md:col-span-1">
          <Link to="/broker/new" className="block h-full">
            <div
              className="h-full rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all hover:brightness-110 cursor-pointer bg-foreground text-background"
              style={{
                minHeight: '100px',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              <Plus className="h-6 w-6" />
              <span className="font-bold text-xs uppercase tracking-wider">
                Nueva Solicitud
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Section Header with View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-lg mb-1 text-foreground"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            Solicitudes de la Organización
          </h2>
          <div
            className="w-20 h-[2px] rounded"
            style={{ background: 'linear-gradient(90deg, oklch(0.72 0.10 80), transparent)' }}
          />
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleViewChange('calendar')}
            title="Vista mensual"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'weekly' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleViewChange('weekly')}
            title="Vista semanal"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleViewChange('list')}
            title="Vista lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content based on view mode */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'calendar' ? (
        <BrokerCalendar requests={requests} />
      ) : viewMode === 'weekly' ? (
        <BrokerWeeklyCalendar requests={requests} />
      ) : (
        <>
          {/* Filters (only in list view) */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o número..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 h-10 bg-card border-border text-foreground"
                style={{ fontFamily: 'Barlow, sans-serif' }}
              />
            </div>

            <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[160px] h-10 bg-card border-border text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
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

            <Select value={filters.brokerId || 'all'} onValueChange={handleBrokerChange}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 bg-card border-border text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                <SelectValue placeholder="Broker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los brokers</SelectItem>
                {brokers.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} {b.id === broker?.id && '(tú)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Request List */}
          {requests.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3
                className="text-lg mb-1 text-foreground"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
              >
                No hay solicitudes
              </h3>
              <p className="mb-4 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
                {filters.search || filters.status !== 'all' || filters.brokerId !== 'all'
                  ? 'No se encontraron solicitudes con los filtros aplicados'
                  : 'Crea tu primera solicitud de transfer'}
              </p>
              <Link to="/broker/new">
                <Button className="hover:brightness-110 bg-foreground text-background">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Solicitud
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <BrokerRequestRow key={request.id} request={request} onClick={() => navigate(`/broker/request/${request.id}`)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BrokerRequestRow({ request, onClick }: { request: TransferRequest; onClick: () => void }) {
  const ClientIcon = request.client_type === 'charter' ? Ship : Building2;
  const itemCount = request.items_count || request.items?.length || 0;

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ClientIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{request.client_name}</span>
              <span className="text-xs text-muted-foreground">{request.request_number}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {request.first_transfer_date && (
                <span>{format(new Date(request.first_transfer_date), 'dd MMM yyyy', { locale: es })}</span>
              )}
              <span>·</span>
              <span>{itemCount} servicio{itemCount !== 1 ? 's' : ''}</span>
              {request.broker_name && (
                <>
                  <span>·</span>
                  <span>{request.broker_name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {request.items?.some(i => i.driver_name) && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Conductor asignado
            </Badge>
          )}
          <TransferStatusBadge status={request.status} />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentColor: string;
}

function StatCard({ label, value, icon, accentColor }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-4 bg-card border border-border"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: accentColor, opacity: 0.7 }}>{icon}</span>
      </div>
      <div
        className="text-2xl text-foreground"
        style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-muted-foreground"
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 700,
          fontSize: '10px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase' as const,
        }}
      >
        {label}
      </div>
    </div>
  );
}
