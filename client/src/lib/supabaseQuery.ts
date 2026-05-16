/**
 * supabaseQuery — Drop-in replacement for `supabase.from(table)` that routes
 * queries through our backend proxy endpoint instead of hitting Supabase
 * directly with the anon key.
 *
 * This eliminates RLS-related failures when the frontend session token is
 * stale or when RLS policies are misconfigured.
 *
 * Usage (almost identical to Supabase client):
 *
 *   // Before:
 *   const { data, error } = await supabase
 *     .from('transfer_requests')
 *     .select('*')
 *     .eq('organization_id', orgId)
 *     .order('created_at', { ascending: false });
 *
 *   // After:
 *   const { data, error } = await supabaseQuery
 *     .from('transfer_requests')
 *     .select('*')
 *     .eq('organization_id', orgId)
 *     .order('created_at', { ascending: false });
 *
 * The org_id filter is auto-injected by the backend for org-scoped tables,
 * so you can often omit it. But including it explicitly won't cause issues
 * (the backend just adds a redundant filter).
 */
import { apiInvoke } from './apiClient';

interface QueryFilter {
  method: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'not' | 'or' | 'match';
  column?: string;
  value?: any;
  operator?: string;
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
  filters: QueryFilter[];
  order: QueryOrder[];
  limit?: number;
  range?: [number, number];
  single?: boolean;
  maybeSingle?: boolean;
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
  data?: Record<string, any> | Record<string, any>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
  skipOrgFilter?: boolean;
}

interface QueryResult<T = any> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

/**
 * Fluent query builder that mirrors the Supabase PostgREST client API.
 * When awaited or when .then() is called, it sends the query descriptor
 * to the backend proxy endpoint.
 */
class SupabaseQueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private desc: QueryDescriptor;

  constructor(table: string) {
    this.desc = {
      table,
      operation: 'select',
      filters: [],
      order: [],
    };
  }

  // ─── Operation methods ───────────────────────────────────────────────

  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    // Only set operation to 'select' if we're not chaining after insert/update/upsert.
    // In Supabase, .select() after .insert()/.update()/.upsert() means "return these columns"
    // but does NOT change the operation type.
    const isWriteOp = ['insert', 'update', 'upsert'].includes(this.desc.operation);
    if (!isWriteOp) {
      this.desc.operation = 'select';
    }
    // Always store the select columns (defaults to '*' when called without args)
    this.desc.select = columns || '*';
    if (options?.count) this.desc.count = options.count;
    if (options?.head) this.desc.head = options.head;
    return this;
  }

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this.desc.operation = 'insert';
    this.desc.data = data;
    return this;
  }

  update(data: Record<string, any>): this {
    this.desc.operation = 'update';
    this.desc.data = data;
    return this;
  }

  delete(options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    this.desc.operation = 'delete';
    if (options?.count) this.desc.count = options.count;
    return this;
  }

  upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this.desc.operation = 'upsert';
    this.desc.data = data;
    if (options?.onConflict) this.desc.onConflict = options.onConflict;
    if (options?.ignoreDuplicates !== undefined) this.desc.ignoreDuplicates = options.ignoreDuplicates;
    return this;
  }

  // ─── Filter methods ──────────────────────────────────────────────────

  eq(column: string, value: any): this {
    this.desc.filters.push({ method: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any): this {
    this.desc.filters.push({ method: 'neq', column, value });
    return this;
  }

  gt(column: string, value: any): this {
    this.desc.filters.push({ method: 'gt', column, value });
    return this;
  }

  gte(column: string, value: any): this {
    this.desc.filters.push({ method: 'gte', column, value });
    return this;
  }

  lt(column: string, value: any): this {
    this.desc.filters.push({ method: 'lt', column, value });
    return this;
  }

  lte(column: string, value: any): this {
    this.desc.filters.push({ method: 'lte', column, value });
    return this;
  }

  like(column: string, value: string): this {
    this.desc.filters.push({ method: 'like', column, value });
    return this;
  }

  ilike(column: string, value: string): this {
    this.desc.filters.push({ method: 'ilike', column, value });
    return this;
  }

  is(column: string, value: null | boolean): this {
    this.desc.filters.push({ method: 'is', column, value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.desc.filters.push({ method: 'in', column, value: values });
    return this;
  }

  not(column: string, operator: string, value: any): this {
    this.desc.filters.push({ method: 'not', column, operator, value });
    return this;
  }

  or(filterString: string): this {
    this.desc.filters.push({ method: 'or', filterString });
    return this;
  }

  match(query: Record<string, any>): this {
    this.desc.filters.push({ method: 'match', value: query });
    return this;
  }

  // ─── Modifier methods ────────────────────────────────────────────────

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.desc.order.push({
      column,
      ascending: options?.ascending,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this.desc.limit = count;
    return this;
  }

  range(from: number, to: number): this {
    this.desc.range = [from, to];
    return this;
  }

  single(): SupabaseQueryBuilder<T> {
    this.desc.single = true;
    return this;
  }

  maybeSingle(): SupabaseQueryBuilder<T | null> {
    this.desc.maybeSingle = true;
    return this as any;
  }

  /**
   * Skip the automatic organization_id filter injection.
   * Use when the hook handles org filtering itself or queries cross-org data.
   */
  skipOrgFilter(): this {
    this.desc.skipOrgFilter = true;
    return this;
  }

  // ─── Execution ───────────────────────────────────────────────────────

  private async execute(): Promise<QueryResult<T>> {
    const result = await apiInvoke<{ data: T; error: any; count?: number | null }>('supabase-query', {
      body: this.desc as any,
    });

    if (result.error) {
      return { data: null, error: result.error, count: null };
    }

    // The proxy returns { data, error, count } inside result.data
    const proxyResult = result.data;
    if (!proxyResult) {
      return { data: null, error: null, count: null };
    }

    return {
      data: proxyResult.data as T,
      error: proxyResult.error ? { message: proxyResult.error } : null,
      count: proxyResult.count,
    };
  }

  /**
   * Implement PromiseLike so the builder can be awaited directly:
   *   const { data, error } = await supabaseQuery.from('table').select('*');
   */
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Entry point — mirrors `supabase.from(table)`.
 *
 * Usage:
 *   import { supabaseQuery } from '@/lib/supabaseQuery';
 *   const { data, error } = await supabaseQuery.from('my_table').select('*').eq('id', '123');
 */
export const supabaseQuery = {
  from<T = any>(table: string): SupabaseQueryBuilder<T> {
    return new SupabaseQueryBuilder<T>(table);
  },
};
