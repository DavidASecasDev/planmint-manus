/**
 * Generic Supabase Proxy Endpoint
 * 
 * Accepts a JSON description of a Supabase query and executes it using the
 * service role client (bypassing RLS). This eliminates the "double data layer"
 * problem where frontend hooks query Supabase directly with the anon key and
 * fail when RLS policies block access.
 * 
 * Supports: select, insert, update, delete, upsert
 * Filters: eq, neq, gt, gte, lt, lte, like, ilike, is, in, not, or, match
 * Modifiers: order, limit, range, single, maybeSingle, count
 * 
 * Security: Requires valid Supabase auth token. The organizationId from the
 * token is automatically injected as a filter for org-scoped tables.
 */
import { Request, Response } from "express";
import {
  getServiceClient,
  authenticateSupabaseRequest,
  AuthError,
} from "./supabaseAdmin";

// Dynamic schema cache: discovers which tables have organization_id at runtime.
// This avoids hard-coding table names (which breaks when tables are added/removed
// or don't have the expected column).
let _orgScopedTablesCache: Set<string> | null = null;
let _cacheLoadPromise: Promise<Set<string>> | null = null;

async function getOrgScopedTables(): Promise<Set<string>> {
  if (_orgScopedTablesCache) return _orgScopedTablesCache;
  if (_cacheLoadPromise) return _cacheLoadPromise;

  _cacheLoadPromise = (async () => {
    try {
      const serviceClient = getServiceClient();
      // Query the Postgres information_schema to find all tables with organization_id
      const { data, error } = await serviceClient
        .rpc('get_tables_with_column', { col_name: 'organization_id' });

      if (error || !data) {
        // Fallback: use a conservative known-good list if RPC doesn't exist
        console.warn('[supabaseProxy] Could not introspect schema, using fallback list:', error?.message);
        return getFallbackOrgScopedTables();
      }

      const tables = new Set<string>(data.map((r: any) => r.table_name));
      console.log(`[supabaseProxy] Discovered ${tables.size} org-scoped tables from schema`);
      _orgScopedTablesCache = tables;
      return tables;
    } catch (err) {
      console.warn('[supabaseProxy] Schema introspection failed, using fallback:', err);
      return getFallbackOrgScopedTables();
    } finally {
      _cacheLoadPromise = null;
    }
  })();

  return _cacheLoadPromise;
}

// Fallback list: only tables VERIFIED to have organization_id (from DB introspection on 2026-05-16)
function getFallbackOrgScopedTables(): Set<string> {
  const tables = new Set([
    'accidents', 'accident_files', 'areas', 'audit_logs', 'automation_rules',
    'damage_catalog', 'damage_reports', 'equipment_assignments', 'equipment_inventory',
    'fleet_vehicles', 'forms', 'integration_settings', 'kanban_columns', 'lost_found_items',
    'notification_preferences', 'notifications', 'operation_legs',
    'repair_comments', 'repair_history', 'repair_invoices', 'repair_photos', 'repairs',
    'reservations', 'saml_connections', 'scim_tokens',
    'tags', 'task_assignees', 'tasks', 'teams', 'team_members',
    'transfer_brokers', 'transfer_documents', 'transfer_invoice_settings',
    'transfer_item_vehicles', 'transfer_items',
    'transfer_change_history', 'transfer_providers', 'transfer_requests', 'transfer_status_history',
    'user_sessions', 'user_templates',
    'vehicle_locations', 'vehicles', 'workshops',
  ]);
  _orgScopedTablesCache = tables;
  return tables;
}

// Tables that should NEVER have org_id auto-injected (global/cross-org tables)
const GLOBAL_TABLES = new Set([
  'profiles', 'organizations', 'super_admin_alerts', 'super_admin_feature_flags',
  'super_admin_outbound_notifications', 'broker_profiles',
  'dropdown_options', 'activation_checklist',
]);

// Tables that require super_admin role
const SUPER_ADMIN_TABLES = new Set([
  'super_admin_alerts', 'super_admin_feature_flags',
  'super_admin_outbound_notifications',
]);

interface QueryFilter {
  method: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'not' | 'or' | 'match';
  column?: string;
  value?: any;
  // For 'not' filter: not(column, operator, value)
  operator?: string;
  // For 'or' filter: or(filterString, options?)
  filterString?: string;
}

interface QueryOrder {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

interface QueryDescriptor {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  select?: string;
  filters?: QueryFilter[];
  order?: QueryOrder[];
  limit?: number;
  range?: [number, number];
  single?: boolean;
  maybeSingle?: boolean;
  count?: 'exact' | 'planned' | 'estimated';
  // For insert/update/upsert
  data?: Record<string, any> | Record<string, any>[];
  // For upsert
  onConflict?: string;
  // Skip org_id auto-injection (for hooks that handle it themselves)
  skipOrgFilter?: boolean;
  // head: true means only return count, no data rows
  head?: boolean;
}

function applyFilters(query: any, filters: QueryFilter[]): any {
  let q = query;
  for (const f of filters) {
    switch (f.method) {
      case 'eq':
        q = q.eq(f.column!, f.value);
        break;
      case 'neq':
        q = q.neq(f.column!, f.value);
        break;
      case 'gt':
        q = q.gt(f.column!, f.value);
        break;
      case 'gte':
        q = q.gte(f.column!, f.value);
        break;
      case 'lt':
        q = q.lt(f.column!, f.value);
        break;
      case 'lte':
        q = q.lte(f.column!, f.value);
        break;
      case 'like':
        q = q.like(f.column!, f.value);
        break;
      case 'ilike':
        q = q.ilike(f.column!, f.value);
        break;
      case 'is':
        q = q.is(f.column!, f.value);
        break;
      case 'in':
        q = q.in(f.column!, f.value);
        break;
      case 'not':
        q = q.not(f.column!, f.operator!, f.value);
        break;
      case 'or':
        q = q.or(f.filterString!);
        break;
      case 'match':
        q = q.match(f.value);
        break;
    }
  }
  return q;
}

function applyModifiers(query: any, desc: QueryDescriptor): any {
  let q = query;

  if (desc.order) {
    for (const o of desc.order) {
      q = q.order(o.column, {
        ascending: o.ascending ?? true,
        ...(o.nullsFirst !== undefined ? { nullsFirst: o.nullsFirst } : {}),
      });
    }
  }

  if (desc.limit !== undefined) {
    q = q.limit(desc.limit);
  }

  if (desc.range) {
    q = q.range(desc.range[0], desc.range[1]);
  }

  if (desc.single) {
    q = q.single();
  } else if (desc.maybeSingle) {
    q = q.maybeSingle();
  }

  return q;
}

export async function handleSupabaseQuery(req: Request, res: Response) {
  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    const desc: QueryDescriptor = req.body;

    if (!desc.table) {
      return res.status(400).json({ data: null, error: "Missing 'table' in request body" });
    }

    if (!desc.operation) {
      return res.status(400).json({ data: null, error: "Missing 'operation' in request body" });
    }

    // Security: check super_admin access
    if (SUPER_ADMIN_TABLES.has(desc.table)) {
      const serviceClient = getServiceClient();
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('is_super_admin')
        .eq('id', userId)
        .single();
      
      if (!profile?.is_super_admin) {
        return res.status(403).json({ data: null, error: "Super admin access required" });
      }
    }

    const serviceClient = getServiceClient();
    const orgScopedTables = await getOrgScopedTables();
    let query: any;

    switch (desc.operation) {
      case 'select': {
        const selectOpts: any = {};
        if (desc.count) selectOpts.count = desc.count;
        if (desc.head) selectOpts.head = true;
        query = serviceClient.from(desc.table).select(desc.select || '*', selectOpts);
        break;
      }
      case 'insert': {
        if (!desc.data) {
          return res.status(400).json({ data: null, error: "Missing 'data' for insert operation" });
        }
        // Auto-inject organization_id for org-scoped tables
        if (orgScopedTables.has(desc.table) && organizationId && !desc.skipOrgFilter) {
          if (Array.isArray(desc.data)) {
            desc.data = desc.data.map(row => ({ organization_id: organizationId, ...row }));
          } else {
            desc.data = { organization_id: organizationId, ...desc.data };
          }
        }
        query = serviceClient.from(desc.table).insert(desc.data);
        if (desc.select) {
          query = query.select(desc.select);
        }
        break;
      }
      case 'update': {
        if (!desc.data) {
          return res.status(400).json({ data: null, error: "Missing 'data' for update operation" });
        }
        query = serviceClient.from(desc.table).update(desc.data);
        if (desc.select) {
          query = query.select(desc.select);
        }
        break;
      }
      case 'delete': {
        query = serviceClient.from(desc.table).delete();
        break;
      }
      case 'upsert': {
        if (!desc.data) {
          return res.status(400).json({ data: null, error: "Missing 'data' for upsert operation" });
        }
        const upsertOpts: any = {};
        if (desc.onConflict) upsertOpts.onConflict = desc.onConflict;
        query = serviceClient.from(desc.table).upsert(desc.data, upsertOpts);
        if (desc.select) {
          query = query.select(desc.select);
        }
        break;
      }
      default:
        return res.status(400).json({ data: null, error: `Unsupported operation: ${desc.operation}` });
    }

    // Auto-inject organization_id filter for org-scoped tables on reads/updates/deletes
    if (
      orgScopedTables.has(desc.table) &&
      organizationId &&
      !desc.skipOrgFilter &&
      desc.operation !== 'insert'
    ) {
      query = query.eq('organization_id', organizationId);
    }

    // Apply user-specified filters
    if (desc.filters) {
      query = applyFilters(query, desc.filters);
    }

    // Apply modifiers (order, limit, range, single, maybeSingle)
    query = applyModifiers(query, desc);

    const { data, error, count } = await query;

    if (error) {
      console.error(`[supabaseProxy] ${desc.operation} on ${desc.table} error:`, error);
      return res.status(500).json({ data: null, error: error.message, count: null });
    }

    // Post-insert hook: notify owner when transfer items with baby seats are created
    // Run asynchronously so it doesn't block the response
    if (desc.operation === 'insert' && desc.table === 'transfer_items' && !error) {
      const hookData = desc.data;
      const hookOrgId = organizationId;
      // Fire and forget - don't await
      void (async () => {
        try {
        const insertedItems = Array.isArray(hookData) ? hookData : [hookData];
        const itemsWithBabySeats = insertedItems.filter((item: any) => item.baby_seats_count && item.baby_seats_count > 0);
        if (itemsWithBabySeats.length > 0) {
          const totalTransferSeats = itemsWithBabySeats.reduce((sum: number, item: any) => sum + (item.baby_seats_count || 0), 0);
          const getGroup = (w: number) => w < 9 ? 'Grupo 0' : w < 18 ? 'Grupo 1' : w <= 36 ? 'Grupo 2' : 'Grupo 3';

          // Get the request info for context
          const requestId = insertedItems[0]?.request_id;
          let clientInfo = '';
          let transferDate = '';
          if (requestId) {
            const { data: reqData } = await serviceClient
              .from('transfer_requests')
              .select('client_name, request_number')
              .eq('id', requestId)
              .single();
            if (reqData) {
              clientInfo = ` - Cliente: ${reqData.client_name} (${reqData.request_number})`;
            }
          }
          // Get the transfer date from the first item
          transferDate = insertedItems[0]?.transfer_date || '';

          // Build transfer seat details
          const transferSeatDetails = itemsWithBabySeats.map((item: any) => {
            if (item.baby_seats) {
              const seats = typeof item.baby_seats === 'string' ? JSON.parse(item.baby_seats) : item.baby_seats;
              return seats.map((s: any, i: number) => `  - Silla ${i + 1}: ${s.age} a\u00f1os, ${s.weight} kg (${getGroup(s.weight)})`).join('\n');
            }
            return `  - ${item.baby_seats_count} sillita(s)`;
          }).join('\n');

          // Query reservations for the same day to get consolidated seat count
          let reservationSeatsTotal = 0;
          let reservationDetails = '';
          if (transferDate && organizationId) {
            const SEAT_KEYWORDS = ['silla', 'sillita', 'beb\u00e9', 'bebe', 'baby', 'child', 'booster', 'infant', 'infante', 'elevador', 'reci\u00e9n nacido', 'recien nacido', 'newborn', 'ni\u00f1o', 'nino', 'grupo 0', 'grupo 1', 'grupo 2', 'grupo 3', 'portabeb\u00e9s', 'portabebes'];
            const isBabySeatExtra = (name: string) => {
              const lower = name.toLowerCase();
              return SEAT_KEYWORDS.some((kw) => lower.includes(kw));
            };
            const { data: reservations } = await serviceClient
              .from('reservations')
              .select('id, cliente, extras_contratados')
              .eq('organization_id', organizationId)
              .lte('desde', transferDate + 'T23:59:59')
              .gte('hasta', transferDate + 'T00:00:00')
              .not('estado', 'in', '("Cancelada","No Show")');
            if (reservations && reservations.length > 0) {
              const resWithSeats: string[] = [];
              (reservations as any[]).forEach((r: any) => {
                let extras: any[] = [];
                try { extras = typeof r.extras_contratados === 'string' ? JSON.parse(r.extras_contratados) : (r.extras_contratados || []); } catch { extras = []; }
                let resSeats = 0;
                extras.forEach((e: any) => {
                  const name = e.nombre || e.name || '';
                  if (isBabySeatExtra(name)) {
                    resSeats += e.cantidad ?? e.quantity ?? 1;
                  }
                });
                if (resSeats > 0) {
                  reservationSeatsTotal += resSeats;
                  resWithSeats.push(`  - ${r.cliente || 'Reserva'}: ${resSeats} sillita(s)`);
                }
              });
              if (resWithSeats.length > 0) {
                reservationDetails = resWithSeats.join('\n');
              }
            }
          }

          // Also count other transfers for the same day
          let otherTransferSeats = 0;
          if (transferDate && organizationId) {
            const { data: otherItems } = await serviceClient
              .from('transfer_items')
              .select('baby_seats_count')
              .eq('organization_id', organizationId)
              .eq('transfer_date', transferDate)
              .gt('baby_seats_count', 0)
              .neq('request_id', requestId || '');
            if (otherItems) {
              otherTransferSeats = (otherItems as any[]).reduce((sum: number, it: any) => sum + (it.baby_seats_count || 0), 0);
            }
          }

          const grandTotal = totalTransferSeats + reservationSeatsTotal + otherTransferSeats;
          const dateLabel = transferDate ? ` para el ${transferDate}` : '';

          // Build consolidated content
          let content = `Se ha creado un transfer que requiere ${totalTransferSeats} sillita${totalTransferSeats > 1 ? 's' : ''} de beb\u00e9${dateLabel}.\n\n`;
          content += `\u{1F4CB} RESUMEN DEL D\u00cdA${dateLabel}:\n`;
          content += `  \u2022 Total sillitas necesarias: ${grandTotal}\n`;
          content += `  \u2022 Transfers: ${totalTransferSeats + otherTransferSeats} (este: ${totalTransferSeats}${otherTransferSeats > 0 ? `, otros: ${otherTransferSeats}` : ''})\n`;
          if (reservationSeatsTotal > 0) {
            content += `  \u2022 Reservas: ${reservationSeatsTotal}\n`;
          }
          content += `\n\u{1F6D2} Detalle de este transfer:\n${transferSeatDetails}`;
          if (reservationDetails) {
            content += `\n\n\u{1F697} Sillitas en reservas del d\u00eda:\n${reservationDetails}`;
          }

          const { notifyOwner } = await import('./_core/notification');
          notifyOwner({
            title: `\u{1F476} ${grandTotal} sillita${grandTotal > 1 ? 's' : ''} total${grandTotal > 1 ? 'es' : ''} el d\u00eda${dateLabel}${clientInfo}`,
            content,
          }).catch((e: any) => console.error('[supabaseProxy] Baby seat notification error:', e));
        }
      } catch (hookErr) {
        console.error('[supabaseProxy] Post-insert hook error (non-blocking):', hookErr);
      }
      })();
    }
    return res.json({ data, error: null, count: count ?? null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[supabaseProxy] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}
