/**
 * Vehicle plate identity helpers.
 *
 * A plate literal is preserved exactly as stored (legitimate formats such as
 * "E200-1" or "9772 NNS" are never rewritten). Identity comparisons, however,
 * use a normalized key: uppercase ASCII letters and digits only, so that
 * "9772 NNS", "9772nns" and "9772-NNS" are recognised as the same unit.
 *
 * Must stay byte-for-byte equivalent to the SQL function
 * public.normalize_vehicle_plate(text):
 *   upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g'))
 */
export function normalizeVehiclePlate(plate: string | null | undefined): string {
  if (!plate) return "";
  return plate.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export type PlateCandidate = {
  id: string;
  matricula: string;
  is_archived?: boolean | null;
};

export type PlateResolution<T extends PlateCandidate> =
  | { kind: "active"; vehicle: T }
  | { kind: "archived"; vehicle: T }
  | { kind: "none" }
  | { kind: "ambiguous"; reason: string; candidates: T[] };

/**
 * Resolve which existing operational vehicle a plate refers to, within one
 * organization's candidate list. Never guesses:
 *  - exactly one active candidate  -> that vehicle
 *  - several active candidates     -> ambiguous (caller must not create/merge)
 *  - no active, one archived non-alias candidate -> archived (may be restored)
 *  - archived aliases of a consolidated unit are never restored
 */
export function resolveVehicleByPlate<T extends PlateCandidate>(
  plate: string | null | undefined,
  candidates: T[],
  aliasVehicleIds: ReadonlySet<string> = new Set(),
): PlateResolution<T> {
  const key = normalizeVehiclePlate(plate);
  if (!key) return { kind: "ambiguous", reason: "empty_plate", candidates: [] };
  const matches = candidates.filter((c) => normalizeVehiclePlate(c.matricula) === key);
  const active = matches.filter((c) => c.is_archived !== true);
  if (active.length === 1) return { kind: "active", vehicle: active[0] };
  if (active.length > 1) return { kind: "ambiguous", reason: "multiple_active", candidates: active };
  const archived = matches.filter((c) => c.is_archived === true && !aliasVehicleIds.has(c.id));
  if (archived.length === 1) return { kind: "archived", vehicle: archived[0] };
  if (archived.length > 1) return { kind: "ambiguous", reason: "multiple_archived", candidates: archived };
  if (matches.length > 0) {
    // Only consolidated aliases exist with this plate but no active canonical
    // record: do not resurrect the alias and do not create a third record.
    return { kind: "ambiguous", reason: "alias_without_active_canonical", candidates: matches };
  }
  return { kind: "none" };
}

export function isUniqueViolation(error: { code?: string | null } | null | undefined): boolean {
  return !!error && error.code === "23505";
}
