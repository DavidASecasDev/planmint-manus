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
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleStatusChange = (value: string) => {
    setFilters(prev => ({ ...prev, status: value as BrokerFilters['status'] }));
  };

  const handleBrokerChange = (value: string) => {
    setFilters(prev => ({ ...prev, brokerId: value }));
  };

  const inputStyle = {
    backgroundColor: '#161B22',
    borderColor: 'rgba(163, 230, 53, 0.15)',
    color: '#E6EDF3',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<LayoutList className="h-5 w-5" />}
          accentColor="#A3E635"
        />
        <StatCard
          label="Pendientes"
          value={stats.pendiente}
          icon={<Clock className="h-5 w-5" />}
          accentColor="#FBBF24"
        />
        <StatCard
          label="En gestión"
          value={stats.en_gestion}
          icon={<TrendingUp className="h-5 w-5" />}
          accentColor="#60A5FA"
        />
        <StatCard
          label="Ppto. Enviado"
          value={stats.presupuesto_enviado}
          icon={<Send className="h-5 w-5" />}
          accentColor="#FB923C"
        />
        <StatCard
          label="Confirmados"
          value={stats.confirmado}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accentColor="#34D399"
        />
        <div className="col-span-2 md:col-span-1">
          <Link to="/broker/new" className="block h-full">
            <div
              className="h-full rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all hover:brightness-110 cursor-pointer"
              style={{
                backgroundColor: '#A3E635',
                color: '#0D1117',
                minHeight: '100px',
              }}
            >
              <Plus className="h-6 w-6" />
              <span className="font-bold text-xs uppercase tracking-wider">Nueva Solicitud</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Section Header */}
      <div className="mb-6">
        <h2
          className="text-lg font-bold uppercase tracking-wider mb-1"
          style={{ color: '#E6EDF3' }}
        >
          Solicitudes de la Organización
        </h2>
        <div
          className="w-20 h-[2px] rounded"
          style={{ background: 'linear-gradient(90deg, #A3E635, transparent)' }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'rgba(230, 237, 243, 0.4)' }}
          />
          <Input
            placeholder="Buscar por cliente o número..."
            value={filters.search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-10 h-10"
            style={inputStyle}
          />
        </div>

        <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[160px] h-10" style={inputStyle}>
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
          <SelectTrigger className="w-full sm:w-[180px] h-10" style={inputStyle}>
            <SelectValue placeholder="Broker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los brokers</SelectItem>
            {brokers.map(b => (
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
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#A3E635' }} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: 'rgba(163, 230, 53, 0.1)' }}
          >
            <FileText className="h-8 w-8" style={{ color: 'rgba(230, 237, 243, 0.4)' }} />
          </div>
          <h3
            className="text-lg font-semibold mb-1"
            style={{ color: '#E6EDF3' }}
          >
            No hay solicitudes
          </h3>
          <p className="mb-4" style={{ color: 'rgba(230, 237, 243, 0.5)' }}>
            {filters.search || filters.status !== 'all' || filters.brokerId !== 'all'
              ? 'No se encontraron solicitudes con los filtros aplicados'
              : 'Crea tu primera solicitud de transfer'}
          </p>
          <Link to="/broker/new">
            <Button
              className="font-bold uppercase text-xs tracking-wider hover:brightness-110"
              style={{ backgroundColor: '#A3E635', color: '#0D1117' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
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
      className="rounded-lg p-4"
      style={{
        backgroundColor: '#161B22',
        border: '1px solid rgba(163, 230, 53, 0.08)',
        borderTop: `2px solid ${accentColor}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: accentColor, opacity: 0.8 }}>{icon}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: '#E6EDF3' }}>
        {value}
      </div>
      <div
        className="text-xs uppercase tracking-wider mt-1"
        style={{ color: 'rgba(230, 237, 243, 0.5)' }}
      >
        {label}
      </div>
    </div>
  );
}
