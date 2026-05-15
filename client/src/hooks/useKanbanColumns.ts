import { useState, useEffect, useCallback } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { KanbanColumn, DEFAULT_KANBAN_COLUMNS } from '@/types/kanban';
import { TaskStatus } from '@/types/tasks';
import { toast } from 'sonner';

export function useKanbanColumns() {
  const { profile } = useAuth();
  const { hasPermission, isAdmin, isLoading: permissionsLoading } = usePermissions();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);

  // Use specific permissions - admins or those with tasks.create can manage columns
  // Wait for permissions to load to avoid race conditions
  const canManageColumns = !permissionsLoading && (isAdmin || hasPermission('tasks.create'));

  const fetchColumns = useCallback(async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabaseQuery
        .from('kanban_columns')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Create default columns for this organization
        await createDefaultColumns(profile.organization_id);
      } else {
        setColumns(data as KanbanColumn[]);
      }
    } catch (error) {
      console.error('Error fetching kanban columns:', error);
      toast.error('Error al cargar columnas del tablero');
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  const createDefaultColumns = async (organizationId: string) => {
    try {
      const columnsToInsert = DEFAULT_KANBAN_COLUMNS.map((col) => ({
        ...col,
        organization_id: organizationId,
      }));

      const { data, error } = await supabaseQuery
        .from('kanban_columns')
        .insert(columnsToInsert)
        .select();

      if (error) throw error;

      setColumns((data || []) as KanbanColumn[]);
    } catch (error) {
      console.error('Error creating default columns:', error);
      toast.error('Error al crear columnas por defecto');
    }
  };

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const updateColumn = async (
    id: string,
    updates: Partial<Pick<KanbanColumn, 'label' | 'color' | 'is_visible' | 'sort_order'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabaseQuery
        .from('kanban_columns')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setColumns((prev) =>
        prev.map((col) => (col.id === id ? { ...col, ...updates } : col))
      );

      return true;
    } catch (error) {
      console.error('Error updating column:', error);
      toast.error('Error al actualizar columna');
      return false;
    }
  };

  const reorderColumns = async (reorderedColumns: KanbanColumn[]): Promise<boolean> => {
    try {
      const updates = reorderedColumns.map((col, index) => ({
        id: col.id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabaseQuery
          .from('kanban_columns')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      setColumns(reorderedColumns.map((col, index) => ({ ...col, sort_order: index })));
      return true;
    } catch (error) {
      console.error('Error reordering columns:', error);
      toast.error('Error al reordenar columnas');
      return false;
    }
  };

  const getVisibleColumns = () => columns.filter((col) => col.is_visible);

  return {
    columns,
    loading,
    canManageColumns,
    updateColumn,
    reorderColumns,
    getVisibleColumns,
    refetch: fetchColumns,
  };
}
