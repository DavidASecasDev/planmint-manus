import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { VehicleImportRow, ParsedVehicleImport } from '@/lib/vehicleImportTemplate';
import { planVehicleImport, buildVehicleImportUpdate } from '@/lib/vehicleImportPlan';
import type { PlateCandidate } from '@shared/vehiclePlate';

interface VehicleInsertData {
  organization_id: string;
  matricula: string;
  modelo: string | null;
  categoria: string | null;
  location_id: string | null;
  status: string;
  is_archived: boolean;
}

export function useVehicleImport() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Load every vehicle of the organization (active and archived) so identity
  // is resolved by normalized plate, not by the exact stored literal.
  const loadOrganizationVehicles = async (): Promise<PlateCandidate[]> => {
    if (!profile?.organization_id) return [];
    const { data, error } = await supabaseQuery
      .from('vehicles')
      .select('id, matricula, is_archived')
      .eq('organization_id', profile.organization_id);
    if (error) throw error;
    return (data || []) as PlateCandidate[];
  };

  // Resolve location names to IDs
  const resolveLocations = async (locationNames: string[]): Promise<Map<string, string>> => {
    if (!profile?.organization_id || locationNames.length === 0) {
      return new Map();
    }

    const uniqueNames = Array.from(new Set(locationNames.filter(Boolean)));
    if (uniqueNames.length === 0) return new Map();

    const { data, error } = await supabaseQuery
      .from('vehicle_locations')
      .select('id, name')
      .eq('organization_id', profile.organization_id);

    if (error) throw error;

    const locationMap = new Map<string, string>();
    data?.forEach((loc: any) => {
      locationMap.set(loc.name.toLowerCase(), loc.id);
    });
    return locationMap;
  };

  // Validate and prepare import data
  const validateImport = async (rows: VehicleImportRow[]): Promise<ParsedVehicleImport[]> => {
    const locationNames = rows.map(r => r.ubicacion || '').filter(Boolean);

    const [existingVehicles, locationMap] = await Promise.all([
      loadOrganizationVehicles(),
      resolveLocations(locationNames),
    ]);

    return planVehicleImport(rows, existingVehicles, new Set(locationMap.keys()));
  };

  // Import vehicles mutation
  const importVehiclesMutation = useMutation({
    mutationFn: async (parsedRows: ParsedVehicleImport[]) => {
      if (!profile?.organization_id) {
        throw new Error('No organization');
      }

      // Get location map for resolving names
      const locationNames = parsedRows.map(r => r.ubicacion || '').filter(Boolean);
      const locationMap = await resolveLocations(locationNames);

      // Re-plan against fresh data right before writing: protects against a
      // repeated import or a concurrent sync that created the unit meanwhile.
      const fresh = planVehicleImport(
        parsedRows.filter(r => r.status !== 'error'),
        await loadOrganizationVehicles(),
        new Set(locationMap.keys()),
      );

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      for (const row of fresh) {
        const locationId = row.ubicacion ? locationMap.get(row.ubicacion.toLowerCase()) || null : null;
        if (row.status === 'update' && row.existingVehicleId) {
          // Existing unit: never touch status, archive flags or the stored
          // plate literal; only fill values provided in the file.
          const update = buildVehicleImportUpdate(row, locationId);
          if (Object.keys(update).length > 0) {
            const { error } = await supabaseQuery
              .from('vehicles')
              .update(update)
              .eq('id', row.existingVehicleId)
              .eq('organization_id', profile.organization_id);
            if (error) throw error;
          }
          updated++;
        } else if (row.status === 'new') {
          const insertData: VehicleInsertData = {
            organization_id: profile.organization_id,
            matricula: row.matricula,
            modelo: row.modelo || null,
            categoria: row.categoria || null,
            location_id: locationId,
            status: 'sucio',
            is_archived: false,
          };
          const { error } = await supabaseQuery.from('vehicles').insert(insertData);
          if (error) {
            // 23505: another import/sync created the same plate key first.
            if ((error as { code?: string }).code === '23505') {
              skipped++;
              continue;
            }
            throw error;
          }
          inserted++;
        } else {
          skipped++;
        }
      }

      return { inserted, updated, skipped };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(
        `Importación completada: ${result.inserted} nuevos, ${result.updated} actualizados` +
          (result.skipped ? `, ${result.skipped} omitidos por duplicado` : '')
      );
    },
    onError: (error) => {
      console.error('Import error:', error);
      toast.error('Error al importar vehículos');
    },
  });

  return {
    validateImport,
    importVehicles: importVehiclesMutation.mutate,
    isImporting: importVehiclesMutation.isPending,
  };
}
