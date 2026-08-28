export interface SesDraftFilters {
  dateFrom: string;
  dateTo: string;
  status: string;
  search: string;
}

const VALID_STATUSES = new Set([
  'all', 'pending_sync', 'incomplete', 'ready', 'batched',
  'uploaded_pending_result', 'accepted', 'error', 'needs_revision',
]);

function isDateInput(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function sanitizeSesFilterPreferences(
  value: unknown,
  fallback: SesDraftFilters,
): SesDraftFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Record<string, unknown>;
  const dateFrom = isDateInput(candidate.dateFrom) ? candidate.dateFrom : fallback.dateFrom;
  const dateTo = isDateInput(candidate.dateTo) ? candidate.dateTo : fallback.dateTo;
  const status = typeof candidate.status === 'string' && VALID_STATUSES.has(candidate.status)
    ? candidate.status
    : fallback.status;
  const search = typeof candidate.search === 'string' ? candidate.search.slice(0, 100) : fallback.search;
  return { dateFrom, dateTo, status, search };
}

export function serializeSesFilters(filters: SesDraftFilters): string {
  return JSON.stringify(filters);
}
