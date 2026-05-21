import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import type { DamageCatalogItem, DamageCatalogFormData, DamageCategory } from '@/types/garatech';

export function useDamageCatalog() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Permission flags
  const canView = !permissionsLoading && hasPermission('garatech.view');
  const canManage = !permissionsLoading && hasPermission('garatech.manage');

  // Fetch all catalog items
  const catalogQuery = useQuery({
    queryKey: ['damage-catalog', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabaseQuery
        .from('damage_catalog')
        .select('*')
        .eq('organization_id', orgId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as DamageCatalogItem[];
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutes - damage catalog rarely changes
  });

  // Check existing items by name (for import preview)
  const checkExistingItems = async (names: string[]): Promise<Set<string>> => {
    if (!orgId || names.length === 0) return new Set();
    
    const { data } = await supabaseQuery
      .from('damage_catalog')
      .select('name_es')
      .eq('organization_id', orgId)
      .in('name_es', names);
    
    return new Set(data?.map((d: any) => d.name_es.toLowerCase()) || []);
  };

  // Create catalog item
  const createItem = useMutation({
    mutationFn: async (formData: DamageCatalogFormData) => {
      if (!orgId) throw new Error('No organization');
      
      const { data, error } = await supabaseQuery
        .from('damage_catalog')
        .insert({
          organization_id: orgId,
          ...formData,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-catalog', orgId] });
      toast.success('Item añadido al catálogo');
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Update catalog item
  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DamageCatalogFormData> }) => {
      const { error } = await supabaseQuery
        .from('damage_catalog')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-catalog', orgId] });
      toast.success('Item actualizado');
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete catalog item
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseQuery
        .from('damage_catalog')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-catalog', orgId] });
      toast.success('Item eliminado');
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Import catalog items (upsert)
  const importCatalog = useMutation({
    mutationFn: async (items: Partial<DamageCatalogFormData>[]) => {
      if (!orgId) throw new Error('No organization');
      
      const toInsert = items.map((item, idx) => ({
        organization_id: orgId,
        name_es: item.name_es!,
        name_en: item.name_en || null,
        price_level_1: item.price_level_1 ?? null,
        price_level_2: item.price_level_2 ?? null,
        price_level_3: item.price_level_3 ?? null,
        price_level_4: item.price_level_4 ?? null,
        price_level_5: item.price_level_5 ?? null,
        category: (item.category || 'general') as DamageCategory,
        is_active: true,
        position: idx + 1,
      }));
      
      const { error } = await supabaseQuery
        .from('damage_catalog')
        .upsert(toInsert, { 
          onConflict: 'organization_id,name_es',
          ignoreDuplicates: false,
        });
      
      if (error) throw error;
      return { imported: toInsert.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['damage-catalog', orgId] });
      toast.success(`${result.imported} items importados correctamente`);
    },
    onError: (error: Error) => {
      toast.error(`Error al importar: ${error.message}`);
    },
  });

  // Get price for a specific level
  const getPrice = (item: DamageCatalogItem, level: number): number | null => {
    const priceKey = `price_level_${level}` as keyof DamageCatalogItem;
    const price = item[priceKey];
    return typeof price === 'number' ? price : null;
  };

  // Group items by category
  const groupedCatalog = catalogQuery.data?.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<DamageCategory, DamageCatalogItem[]>) || {};

  return {
    catalog: catalogQuery.data || [],
    groupedCatalog,
    isLoading: catalogQuery.isLoading,
    error: catalogQuery.error,
    checkExistingItems,
    createItem,
    updateItem,
    deleteItem,
    importCatalog,
    getPrice,
    canView,
    canManage,
    permissionsLoading,
  };
}
