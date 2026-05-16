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
    'damage_catalog', 'damage_reports', 'equipment_inventory',
    'fleet_vehicles', 'forms', 'integration_settings', 'kanban_columns',
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

    return res.json({ data, error: null, count: count ?? null });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ data: null, error: err.message });
    }
    console.error("[supabaseProxy] Error:", err);
    return res.status(500).json({ data: null, error: "Internal server error" });
  }
}
