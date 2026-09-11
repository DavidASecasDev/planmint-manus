import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface DependencyRow {
  id: string;
  depends_on_task_id: string;
  task: { id: string; title: string; status: string } | null;
}

export function TaskDependenciesPanel({ taskId }: { taskId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: async (): Promise<{ supported: boolean; rows: DependencyRow[] }> => {
      const { data: rows, error } = await (supabase as any).from('task_dependencies')
        .select('id,depends_on_task_id,task:tasks!task_dependencies_depends_on_task_id_fkey(id,title,status)')
        .eq('task_id', taskId);
      if (error) {
        const unavailable = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '');
        if (unavailable) return { supported: false, rows: [] };
        throw error;
      }
      return { supported: true, rows: (rows ?? []) as DependencyRow[] };
    },
    retry: false,
  });

  if (isLoading) return null;
  if (!data?.supported) return <p className="text-xs text-muted-foreground">Dependencias disponibles cuando se aplique la migración aditiva.</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Dependencias</h3></div>
      {data.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin dependencias. Cada paso mantiene su estado independiente.</p>
      ) : data.rows.map(row => (
        <div key={row.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="truncate">{row.task?.title ?? 'Tarea relacionada'}</span>
          <Badge variant={row.task?.status === 'completed' ? 'secondary' : 'outline'}>{row.task?.status === 'completed' ? 'Hecha' : 'Pendiente'}</Badge>
        </div>
      ))}
    </div>
  );
}
