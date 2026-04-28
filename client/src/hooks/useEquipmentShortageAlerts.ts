import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SEAT_TIPOS, EQUIPMENT_TIPO_SHORT_LABELS } from '@/types/equipment';
import type { RentlyExtra } from '@/types/reservations';

/* ── Constants ── */
const DEDUP_WINDOW_HOURS = 12;
const MIN_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const LS_KEY = 'equipment_shortage_last_check';
const ALERT_ROLES = ['admin', 'manager', 'directiva', 'mostrador', 'rental'];

const BABY_SEAT_KEYWORDS = [
  'recién nacido', 'recien nacido', 'newborn', 'grupo 0',
  'silla de bebé', 'silla de bebe', 'silla bebé', 'silla bebe',
  'silla de infantes', 'silla infantes',
  'silla de niño', 'silla de nino', 'silla niño', 'silla nino',
  'asiento elevador', 'elevador',
  'baby seat', 'child seat', 'booster seat', 'infant seat',
];

function isBabySeatExtra(name: string): boolean {
  const lower = name.toLowerCase();
  return BABY_SEAT_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Classify a Rently extra name into one of the seat tipos.
 * Returns the matching tipo key or null if not a seat.
 */
function classifySeatExtra(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('recién nacido') || lower.includes('recien nacido') || lower.includes('newborn') || lower.includes('grupo 0')) {
    return 'recien_nacido';
  }
  if (lower.includes('infante') || lower.includes('infant') || lower.includes('grupo 1')) {
    return 'silla_infantes';
  }
  if (lower.includes('niño') || lower.includes('nino') || lower.includes('child') || lower.includes('grupo 2')) {
    return 'silla_nino';
  }
  if (lower.includes('elevador') || lower.includes('booster') || lower.includes('grupo 3')) {
    return 'elevador';
  }
  // Fallback: generic baby/bebe keywords → silla_nino (most common)
  if (lower.includes('bebé') || lower.includes('bebe') || lower.includes('baby') || lower.includes('silla')) {
    return 'silla_nino';
  }
  return null;
}

function safeParseJsonArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

const log = {
  info: (...args: unknown[]) => console.log('[EquipmentShortageAlerts]', ...args),
  error: (...args: unknown[]) => console.error('[EquipmentShortageAlerts]', ...args),
};

function getLastCheckTimestamp(): number {
  try {
    return parseInt(localStorage.getItem(LS_KEY) || '0', 10);
  } catch { return 0; }
}

function setLastCheckTimestamp(ts: number) {
  try { localStorage.setItem(LS_KEY, String(ts)); } catch { /* ignore */ }
}

interface ShortageInfo {
  tipo: string;
  demanda: number;
  disponible: number;
  deficit: number;
}

/**
 * Hook that checks if today's baby seat demand exceeds available stock
 * and creates a notification alert when there's a shortage.
 */
export function useEquipmentShortageAlerts() {
  const { profile } = useAuth();
  const processingRef = useRef(false);

  /** Calculate today's demand vs available stock */
  const calculateShortage = useCallback(async (): Promise<ShortageInfo[]> => {
    const orgId = profile?.organization_id;
    if (!orgId) return [];

    const today = new Date().toISOString().split('T')[0];

    // Get reservations active today
    const { data: reservations, error: resError } = await (supabase as any)
      .from('reservations')
      .select('id, extras_contratados')
      .eq('organization_id', orgId)
      .lte('desde', today + 'T23:59:59')
      .gte('hasta', today + 'T00:00:00')
      .not('estado', 'in', '("Cancelada","No Show")');

    if (resError) {
      log.error('Error fetching reservations:', resError.message);
      return [];
    }

    // Count demand by seat type using classifier
    const demandMap: Record<string, number> = {};
    for (const tipo of SEAT_TIPOS) {
      demandMap[tipo] = 0;
    }

    const reservationIds: string[] = [];
    (reservations || []).forEach((r: any) => {
      const extras = safeParseJsonArray<RentlyExtra>(r.extras_contratados);
      extras.forEach((e: RentlyExtra) => {
        const name = (e.nombre || e.name || '');
        const qty = e.cantidad ?? e.quantity ?? 1;
        const classified = classifySeatExtra(name);
        if (classified && demandMap[classified] !== undefined) {
          demandMap[classified] += qty;
          reservationIds.push(r.id);
        }
      });
    });

    // Count already assigned equipment for today's reservations
    const assignedByTipo: Record<string, number> = {};
    for (const tipo of SEAT_TIPOS) {
      assignedByTipo[tipo] = 0;
    }

    if (reservationIds.length > 0) {
      const { data: assignments } = await (supabase as any)
        .from('equipment_assignments')
        .select('equipment_id')
        .in('reservation_id', Array.from(new Set(reservationIds)))
        .is('returned_at', null);

      if (assignments && assignments.length > 0) {
        const equipIds = assignments.map((a: any) => a.equipment_id);
        const { data: equipItems } = await (supabase as any)
          .from('equipment_inventory')
          .select('id, tipo')
          .in('id', equipIds);

        if (equipItems) {
          equipItems.forEach((eq: any) => {
            if (assignedByTipo[eq.tipo] !== undefined) {
              assignedByTipo[eq.tipo]++;
            }
          });
        }
      }
    }

    // Get available stock
    const { data: stockData, error: stockError } = await (supabase as any)
      .from('equipment_inventory')
      .select('tipo, estado')
      .eq('organization_id', orgId)
      .eq('estado', 'disponible');

    if (stockError) {
      log.error('Error fetching stock:', stockError.message);
      return [];
    }

    const stockMap: Record<string, number> = {};
    for (const tipo of SEAT_TIPOS) {
      stockMap[tipo] = 0;
    }
    (stockData || []).forEach((s: any) => {
      if (stockMap[s.tipo] !== undefined) stockMap[s.tipo]++;
    });

    // Calculate shortages (demand minus already assigned = pending; pending vs available)
    const shortages: ShortageInfo[] = [];
    for (const tipo of Object.keys(demandMap)) {
      const totalDemand = demandMap[tipo];
      const alreadyAssigned = assignedByTipo[tipo] || 0;
      const pendingDemand = Math.max(0, totalDemand - alreadyAssigned);
      const available = stockMap[tipo] || 0;

      if (pendingDemand > available) {
        shortages.push({
          tipo,
          demanda: totalDemand,
          disponible: available,
          deficit: pendingDemand - available,
        });
      }
    }

    return shortages;
  }, [profile?.organization_id]);

  /** Check for recent alerts to avoid duplicates */
  const hasRecentAlert = useCallback(async (userId: string): Promise<boolean> => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - DEDUP_WINDOW_HOURS);

    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'equipment_shortage' as any)
      .gte('created_at', cutoff.toISOString())
      .limit(1);

    if (error) {
      log.error('Error checking recent alerts:', error.message);
      return true; // Assume already alerted on error
    }

    return (data || []).length > 0;
  }, []);

  /** Create shortage notification */
  const createShortageAlert = useCallback(async (
    shortages: ShortageInfo[],
    userId: string,
    orgId: string
  ): Promise<boolean> => {
    const details = shortages.map(s =>
      `${EQUIPMENT_TIPO_SHORT_LABELS[s.tipo as keyof typeof EQUIPMENT_TIPO_SHORT_LABELS] || s.tipo}: necesitas ${s.demanda}, disponibles ${s.disponible} (faltan ${s.deficit})`
    ).join('. ');

    const title = `⚠️ Stock insuficiente de sillitas para hoy`;
    const body = `La demanda de sillitas para hoy supera el stock disponible. ${details}. Revisa el módulo de Equipamiento para gestionar las asignaciones.`;

    const { error } = await supabase
      .from('notifications')
      .insert({
        organization_id: orgId,
        user_id: userId,
        type: 'equipment_shortage' as any,
        title,
        body: body.substring(0, 500),
        entity_type: 'equipment' as any,
        entity_id: 'shortage-' + new Date().toISOString().split('T')[0],
        is_read: false,
      });

    if (error) {
      log.error('Error creating shortage alert:', error.message);
      return false;
    }

    return true;
  }, []);

  /** Main check function */
  const checkAndAlert = useCallback(async (): Promise<number> => {
    const orgId = profile?.organization_id;
    const userId = profile?.id;
    const userRole = profile?.role;

    if (!orgId || !userId) return 0;
    if (!userRole || !ALERT_ROLES.includes(userRole)) return 0;

    // Throttle
    const now = Date.now();
    const lastCheck = getLastCheckTimestamp();
    if (now - lastCheck < MIN_CHECK_INTERVAL_MS) {
      log.info(`Throttled: last check was ${Math.round((now - lastCheck) / 60000)}min ago`);
      return 0;
    }

    // Prevent concurrent runs
    if (processingRef.current) {
      log.info('Skipped: already processing');
      return 0;
    }
    processingRef.current = true;

    try {
      const shortages = await calculateShortage();
      if (shortages.length === 0) {
        log.info('No equipment shortages detected');
        setLastCheckTimestamp(now);
        return 0;
      }

      log.info(`Detected ${shortages.length} equipment shortage(s)`);

      // Check dedup
      const alreadyAlerted = await hasRecentAlert(userId);
      if (alreadyAlerted) {
        log.info('Recent shortage alert already exists, skipping');
        setLastCheckTimestamp(now);
        return 0;
      }

      const sent = await createShortageAlert(shortages, userId, orgId);
      setLastCheckTimestamp(now);
      return sent ? 1 : 0;
    } catch (err) {
      log.error('Error in equipment shortage check:', err);
      setLastCheckTimestamp(now);
      return 0;
    } finally {
      processingRef.current = false;
    }
  }, [profile?.organization_id, profile?.id, profile?.role, calculateShortage, hasRecentAlert, createShortageAlert]);

  return { checkAndAlert, calculateShortage };
}
