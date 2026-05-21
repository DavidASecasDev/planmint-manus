import { useQuery } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';

export interface VehicleSelectOption {
  id: string;
  matricula: string;
  modelo: string | null;
  is_archived: boolean;
}

/**
 * Lightweight hook that fetches ALL vehicles (active + archived) for use in
 * select dropdowns (damage reports, accidents, repairs, etc.).
 * 
 * Unlike useVehicles(), this does NOT load cleaning tasks, fleet info,
 * reservations, or locations — only the minimal fields needed for a selector.
 */
export function useAllVehiclesForSelect() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['all-vehicles-select', orgId],
    queryFn: async (): Promise<VehicleSelectOption[]> => {
      if (!orgId) return [];

      const { data, error } = await supabaseQuery
        .from('vehicles')
        .select('id, matricula, modelo, is_archived')
        .eq('organization_id', orgId)
        .order('is_archived', { ascending: true })
        .order('matricula', { ascending: true });

      if (error) throw error;
      return (data || []).map((v: any) => ({
        ...v,
        is_archived: v.is_archived ?? false,
      }));
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - vehicle list for selects doesn't change often
  });

  const activeVehicles = vehicles.filter(v => !v.is_archived);
  const archivedVehicles = vehicles.filter(v => v.is_archived);

  return {
    vehicles,
    activeVehicles,
    archivedVehicles,
    isLoading,
  };
}
