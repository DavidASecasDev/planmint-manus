import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useState } from 'react';

export function useDataExport() {
  const { profile } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = (data: any, filename: string) => {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportTasks = async () => {
    if (!profile?.organization_id) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabaseQuery
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          type,
          due_date,
          created_at,
          updated_at,
          is_archived,
          goal_target_value,
          goal_unit,
          assigned_to,
          created_by
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const headers = [
        'ID', 'Título', 'Descripción', 'Estado', 'Prioridad', 'Tipo',
        'Fecha límite', 'Creada', 'Actualizada', 'Archivada',
        'Meta valor', 'Meta unidad', 'Asignado a', 'Creada por'
      ];

      const rows = data.map((task: any) => [
        task.id,
        task.title,
        task.description || '',
        task.status,
        task.priority,
        task.type,
        task.due_date || '',
        task.created_at,
        task.updated_at,
        task.is_archived ? 'Sí' : 'No',
        task.goal_target_value || '',
        task.goal_unit || '',
        task.assigned_to || '',
        task.created_by,
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      downloadCSV(csvContent, `tasks_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Tareas exportadas correctamente');
    } catch (error) {
      toast.error('Error al exportar tareas');
    } finally {
      setIsExporting(false);
    }
  };

  const exportAreas = async () => {
    if (!profile?.organization_id) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabaseQuery
        .from('areas')
        .select('id, name, description, color, icon, is_archived, created_at')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;

      const headers = ['ID', 'Nombre', 'Descripción', 'Color', 'Icono', 'Archivada', 'Creada'];
      const rows = data.map((area: any) => [
        area.id,
        area.name,
        area.description || '',
        area.color || '',
        area.icon || '',
        area.is_archived ? 'Sí' : 'No',
        area.created_at,
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      downloadCSV(csvContent, `areas_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Áreas exportadas correctamente');
    } catch (error) {
      toast.error('Error al exportar áreas');
    } finally {
      setIsExporting(false);
    }
  };

  const exportTags = async () => {
    if (!profile?.organization_id) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabaseQuery
        .from('tags')
        .select('id, name, color, icon, created_at')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;

      const headers = ['ID', 'Nombre', 'Color', 'Icono', 'Creada'];
      const rows = data.map((tag: any) => [
        tag.id,
        tag.name,
        tag.color,
        tag.icon,
        tag.created_at,
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      downloadCSV(csvContent, `tags_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Etiquetas exportadas correctamente');
    } catch (error) {
      toast.error('Error al exportar etiquetas');
    } finally {
      setIsExporting(false);
    }
  };

  const exportAutomations = async () => {
    if (!profile?.organization_id) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabaseQuery
        .from('automation_rules')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;

      // Sanitize - remove user IDs from actions
      const sanitizedData = data.map((rule: any) => ({
        name: rule.name,
        trigger_type: rule.trigger_type,
        is_active: rule.is_active,
        throttle_minutes: rule.throttle_minutes,
        conditions_json: rule.conditions_json,
        actions_json: rule.actions_json,
      }));

      downloadJSON(sanitizedData, `automations_${new Date().toISOString().split('T')[0]}.json`);
      toast.success('Automatizaciones exportadas correctamente');
    } catch (error) {
      toast.error('Error al exportar automatizaciones');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    exportTasks,
    exportAreas,
    exportTags,
    exportAutomations,
  };
}
