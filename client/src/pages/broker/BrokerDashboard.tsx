import { Link } from 'react-router-dom';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { useBrokerRequests, BrokerFilters } from '@/hooks/useBrokerRequests';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
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
  XCircle,
  LayoutList,
  Send,
} from 'lucide-react';

export default function BrokerDashboard() {
  const { broker } = useBrokerAuth();
  const { resolvedTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';

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

  const inputBg = !isDark ? '#ffffff' : '#0f172a';
  const inputBorder = isDark ? '#334155' : '#d1d5db';
  const inputColor = !isDark ? '#0f172a' : '#e2e8f0';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<LayoutList className="h-5 w-5" />}
          color="#1a365d"
          isDark={isDark}
        />
        <StatCard
          label="Pendientes"
          value={stats.pendiente}
          icon={<Clock className="h-5 w-5" />}
          color="#92400e"
          borderColor="#f59e0b"
          isDark={isDark}
        />
        <StatCard
          label="En gestión"
          value={stats.en_gestion}
          icon={<FileText className="h-5 w-5" />}
          color="#1e40af"
          borderColor="#3b82f6"
          isDark={isDark}
        />
        <StatCard
          label="Ppto. Enviado"
          value={stats.presupuesto_enviado}
          icon={<Send className="h-5 w-5" />}
          color="#c2410c"
          borderColor="#fb923c"
          isDark={isDark}
        />
        <StatCard
          label="Confirmados"
          value={stats.confirmado}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="#10b981"
          isDark={isDark}
        />
        <div className="col-span-2 md:col-span-1">
          <Link to="/broker/new" className="block h-full">
            <div
              className="h-full rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all hover:shadow-md cursor-pointer"
              style={{
                backgroundColor: '#b8860b',
                color: 'white',
                minHeight: '100px',
              }}
            >
              <Plus className="h-6 w-6" />
              <span className="font-medium text-sm">Nueva Solicitud</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Section Header */}
      <div className="mb-6">
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: isDark ? '#93c5fd' : '#1a365d' }}
        >
          Solicitudes de la Organización
        </h2>
        <div className="w-20 h-1 rounded" style={{ backgroundColor: '#b8860b' }} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: isDark ? '#94a3b8' : '#6b7280' }}
          />
          <Input
            placeholder="Buscar por cliente o número..."
            value={filters.search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-10 h-10"
            style={{
              backgroundColor: inputBg,
              borderColor: inputBorder,
              color: inputColor,
            }}
          />
        </div>

        <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger
            className="w-full sm:w-[160px] h-10"
            style={{
              backgroundColor: inputBg,
              borderColor: inputBorder,
              color: inputColor,
            }}
          >
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
          <SelectTrigger
            className="w-full sm:w-[180px] h-10"
            style={{
              backgroundColor: inputBg,
              borderColor: inputBorder,
              color: inputColor,
            }}
          >
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
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1a365d' }} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }}
          >
            <FileText className="h-8 w-8" style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
          </div>
          <h3
            className="text-lg font-medium mb-1"
            style={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
          >
            No hay solicitudes
          </h3>
          <p className="mb-4" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
            {filters.search || filters.status !== 'all' || filters.brokerId !== 'all'
              ? 'No se encontraron solicitudes con los filtros aplicados'
              : 'Crea tu primera solicitud de transfer'}
          </p>
          <Link to="/broker/new">
            <Button style={{ backgroundColor: '#b8860b', color: 'white' }}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
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
  color: string;
  borderColor?: string;
  isDark: boolean;
}

function StatCard({ label, value, icon, color, borderColor, isDark }: StatCardProps) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: isDark ? '#1e293b' : 'white',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderTop: `3px solid ${borderColor ?? color}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: borderColor ?? color }} className="opacity-80">
          {icon}
        </span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-sm" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
        {label}
      </div>
    </div>
  );
}
