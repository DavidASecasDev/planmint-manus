/**
 * Fleet Vehicle Lookup Helper
 * 
 * Uses fleet_vehicles as the single source of truth for plate verification.
 * Falls back to the operational vehicles table for vehicle_id (FK compatibility).
 */
import { supabase } from '@/integrations/supabase/client';

export interface FleetLookupResult {
  found: boolean;
  fleetVehicleId: string | null;
  operationalVehicleId: string | null;
  matricula: string;
}

/**
 * Look up a vehicle by plate number.
 * 1. Searches fleet_vehicles (source of truth) first.
 * 2. Also checks vehicles table for operational vehicle_id (FK compatibility).
 * 
 * @param plate - The plate number to search for (spaces are stripped)
 * @param orgId - The organization ID to scope the search
 * @returns FleetLookupResult with IDs from both tables
 */
export async function lookupVehicleByPlate(
  plate: string,
  orgId: string
): Promise<FleetLookupResult> {
  const cleanPlate = plate.replace(/\s+/g, '');

  // 1. Search fleet_vehicles (source of truth)
  const { data: fleetVehicles, error: fleetError } = await supabase
    .from('fleet_vehicles')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('matricula', cleanPlate)
    .limit(1);

  if (fleetError) {
    throw new Error('Error al verificar la matrícula. Inténtalo de nuevo.');
  }

  // 2. Also check operational vehicles table (for FK compatibility with vehicle_movements etc.)
  const { data: opVehicles } = await supabase
    .from('vehicles')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('matricula', cleanPlate)
    .is('archived_at', null)
    .limit(1);

  const fleetVehicleId = fleetVehicles?.[0]?.id ?? null;
  const operationalVehicleId = opVehicles?.[0]?.id ?? null;

  return {
    found: !!(fleetVehicleId || operationalVehicleId),
    fleetVehicleId,
    operationalVehicleId,
    matricula: cleanPlate,
  };
}
