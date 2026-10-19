import { normalizeVehiclePlate, resolveVehicleByPlate, type PlateCandidate } from '@shared/vehiclePlate';
import type { VehicleImportRow, ParsedVehicleImport } from '@/lib/vehicleImportTemplate';

/**
 * Pure import planner for operational vehicles.
 * Identity = normalized plate within the current organization, so a file row
 * "9772nns" matches an existing "9772 NNS" instead of creating a second unit.
 * Archived or ambiguous matches are reported as errors (never resurrected or
 * merged implicitly). Duplicate keys inside the same file are rejected.
 */
export function planVehicleImport(
  rows: VehicleImportRow[],
  existing: PlateCandidate[],
  locationNames: ReadonlySet<string>,
): ParsedVehicleImport[] {
  const seenKeys = new Set<string>();
  return rows.map((row) => {
    const matricula = (row.matricula || '').trim().toUpperCase();
    if (!matricula) {
      return { ...row, matricula, status: 'error' as const, errorMessage: 'Matrícula requerida' };
    }
    if (!/^[A-Z0-9]{4,10}$/.test(matricula)) {
      return { ...row, matricula, status: 'error' as const, errorMessage: 'Formato de matrícula inválido' };
    }
    const key = normalizeVehiclePlate(matricula);
    if (seenKeys.has(key)) {
      return { ...row, matricula, status: 'error' as const, errorMessage: 'Matrícula repetida en el archivo' };
    }
    seenKeys.add(key);

    if (row.ubicacion && !locationNames.has(row.ubicacion.toLowerCase())) {
      return { ...row, matricula, status: 'error' as const, errorMessage: `Ubicación "${row.ubicacion}" no encontrada` };
    }

    const resolution = resolveVehicleByPlate(matricula, existing);
    if (resolution.kind === 'active') {
      return { ...row, matricula, status: 'update' as const, existingVehicleId: resolution.vehicle.id };
    }
    if (resolution.kind === 'archived') {
      return {
        ...row,
        matricula,
        status: 'error' as const,
        errorMessage: `Existe archivado como "${resolution.vehicle.matricula}"; restáuralo desde Archivados`,
      };
    }
    if (resolution.kind === 'ambiguous') {
      return {
        ...row,
        matricula,
        status: 'error' as const,
        errorMessage: 'Hay varias fichas con esta matrícula; revísalo antes de importar',
      };
    }
    return { ...row, matricula, status: 'new' as const };
  });
}

/** Only non-empty values from the file update an existing vehicle. */
export function buildVehicleImportUpdate(
  row: VehicleImportRow,
  locationId: string | null,
): Record<string, string> {
  const update: Record<string, string> = {};
  if (row.modelo && row.modelo.trim()) update.modelo = row.modelo.trim();
  if (row.categoria && row.categoria.trim()) update.categoria = row.categoria.trim();
  if (locationId) update.location_id = locationId;
  return update;
}
