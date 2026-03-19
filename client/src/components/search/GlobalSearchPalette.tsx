import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { 
  CheckSquare, 
  Folder, 
  Tag, 
  ListChecks, 
  Target, 
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface GlobalSearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeIcons: Record<SearchResult['type'], React.ReactNode> = {
  task: <CheckSquare className="h-4 w-4" />,
  area: <Folder className="h-4 w-4" />,
  tag: <Tag className="h-4 w-4" />,
  subtask: <ListChecks className="h-4 w-4" />,
  milestone: <Target className="h-4 w-4" />,
  update: <MessageSquare className="h-4 w-4" />,
};

const typeLabels: Record<SearchResult['type'], string> = {
  task: 'Tareas',
  area: 'Áreas',
  tag: 'Etiquetas',
  subtask: 'Subtareas',
  milestone: 'Hitos',
  update: 'Actualizaciones',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueado',
  completed: 'Completada',
};

const priorityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const taskTypeLabels: Record<string, string> = {
  simple: 'Simple',
  goal_numeric: 'Numérico',
  goal_milestones: 'Hitos',
};

export function GlobalSearchPalette({ open, onOpenChange }: GlobalSearchPaletteProps) {
  const navigate = useNavigate();
  const { results, loading, search, clearResults } = useGlobalSearch();
  const { trackGlobalSearchUsed } = useUsageTracking();
  const [query, setQuery] = useState('');
  const hasTrackedOpen = useRef(false);

  // Track search palette open
  useEffect(() => {
    if (open && !hasTrackedOpen.current) {
      trackGlobalSearchUsed();
      hasTrackedOpen.current = true;
    }
    if (!open) {
      hasTrackedOpen.current = false;
    }
  }, [open, trackGlobalSearchUsed]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      clearResults();
      return;
    }

    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search, clearResults]);

  // Clear on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      clearResults();
    }
  }, [open, clearResults]);

  const handleSelect = useCallback((result: SearchResult) => {
    onOpenChange(false);
    
    switch (result.type) {
      case 'task':
        // Navigate to tasks page - task list will show this task
        navigate('/tasks');
        break;
      case 'area':
        navigate('/areas');
        break;
      case 'tag':
        navigate('/tags');
        break;
      case 'subtask':
      case 'milestone':
      case 'update':
        // Navigate to tasks page
        navigate('/tasks');
        break;
    }
  }, [navigate, onOpenChange]);

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<SearchResult['type'], SearchResult[]>);

  const resultOrder: SearchResult['type'][] = ['task', 'area', 'tag', 'subtask', 'milestone', 'update'];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command className="rounded-lg border shadow-md">
        <CommandInput 
          placeholder="Busca tareas, áreas, etiquetas, hitos, actualizaciones…" 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!loading && query.trim() && results.length === 0 && (
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          )}

          {!loading && resultOrder.map(type => {
            const typeResults = groupedResults[type];
            if (!typeResults?.length) return null;

            return (
              <CommandGroup key={type} heading={typeLabels[type]}>
                {typeResults.map(result => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    value={`${result.type}-${result.id}-${result.title}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-start gap-3 py-3"
                  >
                    <div 
                      className="mt-0.5 flex-shrink-0"
                      style={{ 
                        color: result.metadata?.color || undefined 
                      }}
                    >
                      {typeIcons[result.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{result.title}</span>
                        {result.type === 'task' && result.metadata && (
                          <>
                            {result.metadata.taskType && (
                              <Badge variant="outline" className="text-xs">
                                {taskTypeLabels[result.metadata.taskType] || result.metadata.taskType}
                              </Badge>
                            )}
                            {result.metadata.status && (
                              <Badge variant="secondary" className="text-xs">
                                {statusLabels[result.metadata.status] || result.metadata.status}
                              </Badge>
                            )}
                            {result.metadata.priority && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  result.metadata.priority === 'urgent' ? 'border-destructive text-destructive' :
                                  result.metadata.priority === 'high' ? 'border-orange-500 text-orange-500' : ''
                                }`}
                              >
                                {priorityLabels[result.metadata.priority] || result.metadata.priority}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {result.subtitle}
                        </p>
                      )}
                      {result.type === 'update' && result.metadata?.authorName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Por {result.metadata.authorName}
                          {result.metadata.createdAt && (
                            <> · {format(new Date(result.metadata.createdAt), 'dd MMM yyyy', { locale: es })}</>
                          )}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
