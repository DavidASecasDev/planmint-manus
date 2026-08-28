import { z } from 'zod';

export const SesFilterPreferencesSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum([
    'all', 'pending_sync', 'incomplete', 'ready', 'batched',
    'uploaded_pending_result', 'accepted', 'error', 'needs_revision',
  ]),
  search: z.string().max(100),
}).strict();

export type SesFilterPreferences = z.infer<typeof SesFilterPreferencesSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function readSesFilterPreferences(metadata: unknown): SesFilterPreferences | null {
  if (!isRecord(metadata) || !isRecord(metadata.planmint_preferences)) return null;
  const parsed = SesFilterPreferencesSchema.safeParse(metadata.planmint_preferences.ses_hospedajes_filters);
  return parsed.success ? parsed.data : null;
}

export function mergeSesFilterPreferences(
  metadata: unknown,
  filters: SesFilterPreferences,
): Record<string, unknown> {
  const currentMetadata = isRecord(metadata) ? metadata : {};
  const currentPlanmintPreferences = isRecord(currentMetadata.planmint_preferences)
    ? currentMetadata.planmint_preferences
    : {};
  return {
    ...currentMetadata,
    planmint_preferences: {
      ...currentPlanmintPreferences,
      ses_hospedajes_filters: filters,
    },
  };
}
