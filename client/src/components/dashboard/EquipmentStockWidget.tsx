import { useEquipmentInventory } from '@/hooks/useEquipment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Baby, Package, CheckCircle2, ArrowRightLeft, Wrench, AlertTriangle } from 'lucide-react';
import {
  EQUIPMENT_TIPO_LABELS,
  EQUIPMENT_ESTADO_COLORS,
  type EquipmentTipo,
} from '@/types/equipment';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { RentlyExtra } from '@/types/reservations';

function safeParseJsonArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; }
    catch { return []; }
  }
  return [];
}

const SEAT_KEYWORDS = ['silla', 'bebé', 'bebe', 'infante', 'elevador', 'child seat', 'baby seat', 'booster', 'infant'];

function isBabySeatExtra(name: string): boolean {
  const lower = name.toLowerCase();
  return SEAT_KEYWORDS.some((kw) => lower.includes(kw));
}

export function EquipmentStockWidget() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { items, isLoading, stats } = useEquipmentInventory();

  // Count how many baby seats are needed today from active reservations
  // and how many are already assigned
  const { data: demandData = { total: 0, assigned: 0, pending: 0 } } = useQuery({
    queryKey: ['equipment-today-demand', profile?.organization_id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      // Get reservations active today with their extras
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('id, extras_contratados')
        .eq('organization_id', profile!.organization_id!)
        .lte('desde', today + 'T23:59:59')
        .gte('hasta', today + 'T00:00:00')
        .not('estado', 'in', '("Cancelada","No Show")');
      if (resError) throw resError;

      let totalSeats = 0;
      const reservationIds: string[] = [];
      (reservations as any[]).forEach((r: any) => {
        const extras = safeParseJsonArray<RentlyExtra>(r.extras_contratados);
        let hasSeat = false;
        extras.forEach((e: RentlyExtra) => {
          const name = e.nombre || e.name || '';
          if (isBabySeatExtra(name)) {
            totalSeats += e.cantidad ?? e.quantity ?? 1;
            hasSeat = true;
          }
        });
        if (hasSeat) reservationIds.push(r.id);
      });

      // Count how many are already assigned
      let assignedCount = 0;
      if (reservationIds.length > 0) {
        const { count, error: assError } = await (supabase
          .from as any)('equipment_assignments')
          .select('id', { count: 'exact', head: true })
          .in('reservation_id', reservationIds)
          .is('returned_at', null);
        if (!assError) assignedCount = count || 0;
      }

      return { total: totalSeats, assigned: assignedCount, pending: Math.max(0, totalSeats - assignedCount) };
    },
    enabled: !!profile?.organization_id,
  });

  const todayDemand = demandData.total;

  // Stats by seat type
  const seatTypes: EquipmentTipo[] = ['silla_bebe', 'silla_infantes', 'elevador'];
  const seatStats = useMemo(() => {
    return seatTypes.map((tipo) => ({
      tipo,
      label: EQUIPMENT_TIPO_LABELS[tipo],
      ...stats.byTipo(tipo),
    }));
  }, [items]);

  const totalAvailable = seatStats.reduce((sum, s) => sum + s.disponible, 0);
  const hasShortage = demandData.pending > totalAvailable;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Baby className="h-4 w-4 text-pink-500" />
            Stock de Sillitas
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate('/fleet/equipment')}
          >
            Ver todo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert if shortage */}
        {hasShortage && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                Stock insuficiente
              </p>
              <p className="text-xs text-red-600 dark:text-red-400/80">
                Hoy se necesitan {todayDemand} sillitas pero solo hay {totalAvailable} disponibles
              </p>
            </div>
          </div>
        )}

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{stats.disponible}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Disponibles</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <ArrowRightLeft className="h-4 w-4 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{stats.asignada}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Asignadas</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <Wrench className="h-4 w-4 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{stats.mantenimiento}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mantenim.</p>
          </div>
        </div>

        {/* By type breakdown */}
        <div className="space-y-2">
          {seatStats.map((s) => (
            <div key={s.tipo} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs h-5 px-1.5 font-mono">
                  {s.disponible}/{s.total}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Today demand */}
        {todayDemand > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Demanda hoy</span>
              <Badge
                className={
                  hasShortage
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                }
              >
                {todayDemand} sillitas
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Asignadas</span>
              <span className="font-mono">{demandData.assigned}</span>
            </div>
            {demandData.pending > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className={hasShortage ? 'text-red-600 dark:text-red-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                  Pendientes de asignar
                </span>
                <span className={`font-mono font-semibold ${hasShortage ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {demandData.pending}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-4">
            <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No hay equipamiento registrado
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => navigate('/fleet/equipment')}
            >
              Registrar equipamiento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
