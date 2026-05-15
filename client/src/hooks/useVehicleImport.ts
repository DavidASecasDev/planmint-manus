import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { VehicleImportRow, ParsedVehicleImport } from '@/lib/vehicleImportTemplate';

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

  // Check which vehicles already exist
  const checkExistingVehicles = async (matriculas: string[]): Promise<Map<string, string>> => {
    if (!profile?.organization_id || matriculas.length === 0) {
      return new Map();
    }

    const { data, error } = await supabaseQuery
      .from('vehicles')
      .select('id, matricula')
      .eq('organization_id', profile.organization_id)
      .in('matricula', matriculas);

    if (error) throw error;

    const existingMap = new Map<string, string>();
    data?.forEach((v: any) => existingMap.set(v.matricula.toUpperCase(), v.id));
    return existingMap;
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
    const matriculas = rows.map(r => r.matricula.toUpperCase());
    const locationNames = rows.map(r => r.ubicacion || '').filter(Boolean);

    const [existingVehicles, locationMap] = await Promise.all([
      checkExistingVehicles(matriculas),
      resolveLocations(locationNames),
    ]);

    return rows.map(row => {
      const matricula = row.matricula.toUpperCase();
      
      // Validate matricula
      if (!matricula) {
        return {
          ...row,
          matricula,
          status: 'error' as const,
          errorMessage: 'Matrícula requerida',
        };
      }

      // Check if valid format (basic validation)
      if (!/^[A-Z0-9]{4,10}$/.test(matricula)) {
        return {
          ...row,
          matricula,
          status: 'error' as const,
          errorMessage: 'Formato de matrícula inválido',
        };
      }

      // Check if exists
      const existingId = existingVehicles.get(matricula);

      // Validate location if provided
      if (row.ubicacion && !locationMap.has(row.ubicacion.toLowerCase())) {
        return {
          ...row,
          matricula,
          status: 'error' as const,
          errorMessage: `Ubicación "${row.ubicacion}" no encontrada`,
        };
      }

      return {
        ...row,
        matricula,
        status: existingId ? 'update' as const : 'new' as const,
        existingVehicleId: existingId,
      };
    });
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

      // Filter out errors
      const validRows = parsedRows.filter(r => r.status !== 'error');

      // Prepare insert/update data
      const vehiclesData: VehicleInsertData[] = validRows.map(row => ({
        organization_id: profile.organization_id!,
        matricula: row.matricula,
        modelo: row.modelo || null,
        categoria: row.categoria || null,
        location_id: row.ubicacion ? locationMap.get(row.ubicacion.toLowerCase()) || null : null,
        status: 'sucio',
        is_archived: false,
      }));

      // Upsert vehicles (update on conflict with matricula)
      const { error } = await supabaseQuery
        .from('vehicles')
        .upsert(vehiclesData, {
          onConflict: 'organization_id,matricula',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      return {
        inserted: validRows.filter(r => r.status === 'new').length,
        updated: validRows.filter(r => r.status === 'update').length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(
        `Importación completada: ${result.inserted} nuevos, ${result.updated} actualizados`
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
