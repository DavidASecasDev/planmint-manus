import { Search, Filter, X, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TaskFilters as TaskFiltersType, TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS, TASK_TYPE_OPTIONS } from '@/types/tasks';
import { Area } from '@/types/areas';
import { Tag } from '@/types/tags';
import { TagIcon } from '@/components/tags/TagIcon';
import { canFilterOtherMembers, getMembersAtOrBelow, getRoleLabel } from '@/lib/roleHierarchy';

interface OrganizationMember {
  id?: string;
  user_id?: string;
  name?: string | null;
  role?: string;
}

interface TaskFiltersProps {
  filters: TaskFiltersType;
  onFiltersChange: (filters: TaskFiltersType) => void;
  areas: Area[];
  tags: Tag[];
  members?: OrganizationMember[];
  currentUserRole?: string;
}

export function TaskFilters({ filters, onFiltersChange, areas, tags, members = [], currentUserRole }: TaskFiltersProps) {
  const activeFiltersCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.priority !== 'all' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.areaIds.length > 0 ? 1 : 0) +
    (filters.tagIds.length > 0 ? 1 : 0) +
    (filters.onlyMine ? 1 : 0) +
    (filters.showArchived ? 1 : 0) +
    (filters.assigneeId !== 'all' ? 1 : 0);

  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      status: 'all',
      priority: 'all',
      type: 'all',
      areaIds: [],
      tagIds: [],
      onlyMine: false,
      showArchived: false,
      assigneeId: 'all',
    });
  };

  const toggleAreaFilter = (areaId: string) => {
    const newAreaIds = filters.areaIds.includes(areaId)
      ? filters.areaIds.filter((id) => id !== areaId)
      : [...filters.areaIds, areaId];
    onFiltersChange({ ...filters, areaIds: newAreaIds });
  };

  const toggleTagFilter = (tagId: string) => {
    const newTagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    onFiltersChange({ ...filters, tagIds: newTagIds });
  };

  // Get members at or below current role level for filtering
  // This allows managers to see other managers' tasks (same level + below)
  const canFilterSubordinates = canFilterOtherMembers(currentUserRole);
  const filterableMembers = canFilterSubordinates 
    ? getMembersAtOrBelow(currentUserRole, members)
    : [];

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tareas..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value as TaskFiltersType['status'] })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TASK_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, priority: value as TaskFiltersType['priority'] })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {TASK_PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, type: value as TaskFiltersType['type'] })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TASK_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Member filter - only for managers+ (includes same level and below) */}
        {canFilterSubordinates && filterableMembers.length > 0 && (
          <Select
            value={filters.assigneeId}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, assigneeId: value })
            }
          >
            <SelectTrigger className="w-[180px]">
              <Users className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ver tareas de..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los miembros</SelectItem>
              {filterableMembers.map((member) => (
                <SelectItem 
                  key={member.user_id || member.id} 
                  value={member.user_id || member.id || ''}
                >
                  {member.name || 'Sin nombre'} ({getRoleLabel(member.role || 'member')})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Más filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Áreas</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {areas.filter(a => !a.is_archived).map((area) => (
                    <div key={area.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`area-${area.id}`}
                        checked={filters.areaIds.includes(area.id)}
                        onCheckedChange={() => toggleAreaFilter(area.id)}
                      />
                      <Label
                        htmlFor={`area-${area.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: area.color || '#4F46E5' }}
                        />
                        {area.name}
                      </Label>
                    </div>
                  ))}
                  {areas.filter(a => !a.is_archived).length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay áreas disponibles</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Etiquetas</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={filters.tagIds.includes(tag.id)}
                        onCheckedChange={() => toggleTagFilter(tag.id)}
                      />
                      <Label
                        htmlFor={`tag-${tag.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <TagIcon icon={tag.icon} size={14} style={{ color: tag.color }} />
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                  {tags.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay etiquetas disponibles</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="onlyMine"
                    checked={filters.onlyMine}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ ...filters, onlyMine: checked as boolean })
                    }
                  />
                  <Label htmlFor="onlyMine" className="text-sm font-normal cursor-pointer">
                    Solo mis tareas
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showArchived"
                    checked={filters.showArchived}
                    onCheckedChange={(checked) =>
                      onFiltersChange({ ...filters, showArchived: checked as boolean })
                    }
                  />
                  <Label htmlFor="showArchived" className="text-sm font-normal cursor-pointer">
                    Mostrar archivadas
                  </Label>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                  <X className="mr-2 h-4 w-4" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
