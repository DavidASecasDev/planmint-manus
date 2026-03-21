/*
 * Azul Cars Brand — Broker Dashboard
 * Uses semantic CSS tokens for dark/light mode compatibility
 * bg-background | bg-card | text-foreground | text-muted-foreground
 */
import { Link } from 'react-router-dom';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useBrokerRequests, BrokerFilters } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { BrokerRequestCard } from '@/components/broker/BrokerRequestCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Send,
  TrendingUp,
} from 'lucide-react';

export default function BrokerDashboard() {
  const { broker } = useBrokerAuth();

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
          label="En gestión"
          value={stats.en_gestion}
          icon={<TrendingUp className="h-5 w-5" />}
          accentColor="#2563EB"
        />
        <StatCard
          label="Ppto. Enviado"
          value={stats.presupuesto_enviado}
          icon={<Send className="h-5 w-5" />}
          accentColor="#EA580C"
        />
        <StatCard
          label="Confirmados"
          value={stats.confirmado}
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

      {/* Section Header */}
      <div className="mb-6">
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
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
            <SelectItem value="en_gestion">En gestión</SelectItem>
            <SelectItem value="presupuesto_enviado">Ppto. Enviado</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.brokerId || 'all'} onValueChange={handleBrokerChange}>
          <SelectTrigger className="w-full sm:w-[180px] h-10 bg-card border-border text-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
            <SelectValue placeholder="Broker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los brokers</SelectItem>
            {brokers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name} {b.id === broker?.id && '(tú)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Request List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3
            className="text-lg mb-1 text-foreground"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
            }}
          >
            No hay solicitudes
          </h3>
          <p className="mb-4 text-muted-foreground" style={{ fontFamily: 'Barlow, sans-serif' }}>
            {filters.search || filters.status !== 'all' || filters.brokerId !== 'all'
              ? 'No se encontraron solicitudes con los filtros aplicados'
              : 'Crea tu primera solicitud de transfer'}
          </p>
          <Link to="/broker/new">
            <Button
              className="hover:brightness-110 bg-foreground text-background"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <BrokerRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
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
      style={{
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: accentColor, opacity: 0.7 }}>{icon}</span>
      </div>
      <div
        className="text-2xl text-foreground"
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
        }}
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
