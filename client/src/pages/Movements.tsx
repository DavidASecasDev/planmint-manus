import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Route, List, LayoutGrid } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MovementsList } from '@/components/movements/MovementsList';
import { MovementsKanban } from '@/components/movements/MovementsKanban';
import { useMovements, MovementStatus, MovementType } from '@/hooks/useMovements';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'kanban';

export default function Movements() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MovementStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<MovementType | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const { movements, isLoading, updateMovement } = useMovements({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    movement_type: typeFilter !== 'all' ? typeFilter : undefined,
    search: search || undefined,
  });

  const handleUpdateStatus = (id: string, status: MovementStatus) => {
    updateMovement.mutate({ id, status });
  };

  return (
    <AppLayout title="Movimientos">
      <div className="space-y-6">
        <PageHeader
          title="Movimientos"
          description="Gestiona entregas, recogidas y movimientos de vehículos"
          icon={Route}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'kanban' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
              <Button onClick={() => navigate('/movements/new')} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Nuevo
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar matrícula…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as MovementType | 'all')}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrega">Entrega</SelectItem>
              <SelectItem value="recogida">Recogida</SelectItem>
              <SelectItem value="escoba">Escoba</SelectItem>
              <SelectItem value="limpieza">Limpieza</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === 'list' && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MovementStatus | 'all')}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="en_curso">En curso</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {!isLoading && movements.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {movements.length} movimiento{movements.length !== 1 ? 's' : ''}
          </p>
        )}

        {viewMode === 'list' ? (
          <MovementsList movements={movements} isLoading={isLoading} />
        ) : (
          <MovementsKanban movements={movements} isLoading={isLoading} onUpdateStatus={handleUpdateStatus} />
        )}
      </div>
    </AppLayout>
  );
}
