import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTransition } from '@/components/ui/skeleton-transition';
import { Plus, Search, Upload, ChevronRight, Car, Palette, Fuel, Zap, Settings, Calendar, Building2, Layers, AlertTriangle } from 'lucide-react';
import { FLEET_STATUS_OPTIONS, type FleetVehicleStatus } from '@/types/fleet';
import { FleetImportDialog } from '@/components/fleet/FleetImportDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_FILTERS: { value: FleetVehicleStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'pendiente_recogida', label: 'Pendientes' },
  { value: 'devuelto', label: 'Devueltos' },
];

export default function FleetList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { vehicles, isLoading } = useFleetVehicles();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FleetVehicleStatus | 'all'>('all');
  const [importOpen, setImportOpen] = useState(false);

  // Fetch pending damage counts per vehicle
  const { data: damageCounts = {} } = useQuery({
    queryKey: ['fleet-damage-counts', profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicle_damages')
        .select('fleet_vehicle_id, status')
        .eq('organization_id', profile!.organization_id!)
        .neq('status', 'reparado');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((d: any) => {
        counts[d.fleet_vehicle_id] = (counts[d.fleet_vehicle_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!profile?.organization_id,
  });

  const filtered = vehicles
    .filter(v =>
      v.matricula.toLowerCase().includes(search.toLowerCase()) ||
      (v.modelo || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.proveedor || '').toLowerCase().includes(search.toLowerCase())
    )
    .filter(v => statusFilter === 'all' || v.status === statusFilter);

  const getStatusStyle = (status: string) => {
    const opt = FLEET_STATUS_OPTIONS.find(o => o.value === status);
    return {
      backgroundColor: `${opt?.color}15`,
      color: opt?.color,
      borderColor: 'transparent',
    };
  };

  const counts = {
    all: vehicles.length,
    activo: vehicles.filter(v => v.status === 'activo').length,
    pendiente_recogida: vehicles.filter(v => v.status === 'pendiente_recogida').length,
    devuelto: vehicles.filter(v => v.status === 'devuelto').length,
  };

  const fleetSkeleton = (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Search skeleton */}
      <Skeleton className="h-11 w-full rounded-full" />

      {/* Status filter pills skeleton */}
      <div className="flex gap-1.5">
        {STATUS_FILTERS.map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="hidden sm:flex gap-2 justify-end">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>

      {/* Vehicle cards skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-border/50 space-y-3"
            style={{ opacity: 1 - i * 0.08, borderLeftWidth: 3, borderLeftColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-36 rounded" />
              </div>
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 pt-3 border-t border-border/30">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout title="Flota">
      <SkeletonTransition isLoading={isLoading} skeleton={fleetSkeleton}>
        <div className="space-y-6 max-w-4xl mx-auto pb-8">
          {/* Spotlight Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por matrícula, modelo o proveedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-11 h-11 rounded-full bg-muted/50 border-transparent focus:border-primary/30 focus:bg-background transition-all"
            />
          </div>

          {/* Segmented Control */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  statusFilter === f.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-xs opacity-70">
                  {counts[f.value]}
                </span>
              </button>
            ))}
          </div>

          {/* Action buttons - desktop */}
          <div className="hidden sm:flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="rounded-xl">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => navigate('/fleet/new')} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Vehículo
            </Button>
          </div>

          {/* Content */}
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Car className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-foreground">No hay vehículos</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Importa tu flota desde Excel o añade vehículos manualmente.
              </p>
              <div className="flex gap-2 justify-center mt-6">
                <Button variant="outline" onClick={() => setImportOpen(true)} className="rounded-xl">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </Button>
                <Button onClick={() => navigate('/fleet/new')} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo
                </Button>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {filtered.map((v, i) => {
                  const statusOpt = FLEET_STATUS_OPTIONS.find(o => o.value === v.status);
                  const details = [
                    v.categoria && { icon: Layers, text: `Grupo ${v.categoria}` },
                    v.color && { icon: Palette, text: v.color },
                    v.combustible && { icon: (v as any).hibrido ? Zap : Fuel, text: `${v.combustible}${(v as any).hibrido ? ' · Híbrido' : ''}` },
                    ((v as any).motor || (v as any).cv) && { icon: Settings, text: [(v as any).motor, (v as any).cv && `${(v as any).cv} CV`].filter(Boolean).join(' · ') },
                    v.proveedor && { icon: Building2, text: v.proveedor },
                    v.fecha_fin_contrato && { icon: Calendar, text: format(new Date(v.fecha_fin_contrato), 'dd MMM yyyy', { locale: es }) },
                  ].filter(Boolean) as { icon: any; text: string }[];

                  return (
                    <motion.div
                      key={v.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      onClick={() => navigate(`/fleet/${v.id}`)}
                      className="p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all cursor-pointer active:scale-[0.98] group"
                      style={{ borderLeftWidth: 3, borderLeftColor: statusOpt?.color }}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden">
                          {(v as any).photo_url ? (
                            <img src={(v as any).photo_url} alt={v.matricula} className="w-full h-full object-cover" />
                          ) : (
                            <Car className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-foreground tracking-wider text-base">
                              {v.matricula}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-2 py-0 h-5 rounded-full font-medium border-0"
                              style={getStatusStyle(v.status)}
                            >
                              {statusOpt?.label}
                            </Badge>
                            {damageCounts[v.id] > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0 h-5 rounded-full font-medium border-0 bg-destructive/10 text-destructive gap-1"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {damageCounts[v.id]}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {[(v as any).marca, v.modelo].filter(Boolean).join(' · ') || 'Sin modelo'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </div>

                      {/* Details grid */}
                      {details.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border/30">
                          {details.map((d, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                              <d.icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{d.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}

          {/* FAB - mobile only */}
          <button
            onClick={() => navigate('/fleet/new')}
            className="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform z-50"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </SkeletonTransition>

      <FleetImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </AppLayout>
  );
}
