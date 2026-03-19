import { Area, AreaFilter } from '@/types/areas';
import { AreaCard } from './AreaCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Layers } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { GridSkeleton } from '@/components/ui/loading-skeleton';

interface AreaListProps {
  areas: Area[];
  loading: boolean;
  filter: AreaFilter;
  searchQuery: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onFilterChange: (filter: AreaFilter) => void;
  onSearchChange: (query: string) => void;
  onCreateClick: () => void;
  onView: (area: Area) => void;
  onEdit: (area: Area) => void;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (id: string) => void;
}

export function AreaList({
  areas,
  loading,
  filter,
  searchQuery,
  canCreate,
  canEdit,
  canDelete,
  onFilterChange,
  onSearchChange,
  onCreateClick,
  onView,
  onEdit,
  onArchive,
  onDelete,
}: AreaListProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={Layers}
          title="Áreas"
          description="Organiza tu vida y tus proyectos en categorías personalizables."
        />
        {canCreate && (
          <Button onClick={onCreateClick} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nueva área
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar áreas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => onFilterChange(v as AreaFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="archived">Archivadas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && <GridSkeleton count={6} columns={3} />}

      {/* Empty state */}
      {!loading && areas.length === 0 && (
        <EmptyState
          icon={Layers}
          title={
            searchQuery
              ? 'No se encontraron áreas'
              : filter === 'archived'
              ? 'No hay áreas archivadas'
              : 'Aún no tienes áreas creadas'
          }
          description={
            searchQuery
              ? 'Intenta con otros términos de búsqueda.'
              : filter === 'archived'
              ? 'Las áreas archivadas aparecerán aquí.'
              : 'Las áreas te ayudan a organizar tus tareas y objetivos en categorías.'
          }
          actionLabel={!searchQuery && filter !== 'archived' && canCreate ? 'Crear tu primera área' : undefined}
          onAction={!searchQuery && filter !== 'archived' && canCreate ? onCreateClick : undefined}
        />
      )}

      {/* Areas grid */}
      {!loading && areas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <AreaCard
              key={area.id}
              area={area}
              canEdit={canEdit}
              canDelete={canDelete}
              onView={onView}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
