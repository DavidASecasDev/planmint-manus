import { Area, VISIBILITY_OPTIONS } from '@/types/areas';
import { AreaIcon } from './AreaIcon';
import { VisibilityBadge } from './VisibilityBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Pencil, Archive, ArchiveRestore, Calendar, Users, Shield, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AreaDetailProps {
  area: Area | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onEdit: (area: Area) => void;
  onArchive: (id: string, archive: boolean) => void;
}

export function AreaDetail({
  area,
  open,
  onOpenChange,
  canEdit,
  onEdit,
  onArchive,
}: AreaDetailProps) {
  if (!area) return null;

  const getVisibilityLabel = () => {
    const option = VISIBILITY_OPTIONS.find(o => o.value === area.visibility);
    return option?.label || 'Todos en la organización';
  };

  const getVisibilityIcon = () => {
    switch (area.visibility) {
      case 'admins':
        return <Shield className="h-4 w-4" />;
      case 'custom':
        return <Settings className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${area.color}20` }}
            >
              <AreaIcon
                icon={area.icon}
                className="h-7 w-7"
                style={{ color: area.color }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="truncate">{area.name}</SheetTitle>
                <VisibilityBadge visibility={area.visibility || 'org'} />
                {area.is_archived && (
                  <Badge variant="secondary">Archivada</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  Creada el {format(new Date(area.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Descripción
            </h4>
            <p className="text-foreground">
              {area.description || 'Sin descripción'}
            </p>
          </div>

          {/* Visibility */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Visibilidad
            </h4>
            <div className="flex items-center gap-2 text-foreground">
              {getVisibilityIcon()}
              <span>{getVisibilityLabel()}</span>
            </div>
          </div>

          {/* Color & Icon */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Color
              </h4>
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: area.color }}
                />
                <span className="text-sm font-mono">{area.color}</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Icono
              </h4>
              <div className="flex items-center gap-2">
                <AreaIcon icon={area.icon} className="h-5 w-5" />
                <span className="text-sm capitalize">{area.icon}</span>
              </div>
            </div>
          </div>

          {/* Stats placeholder for future phases */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Estadísticas
            </h4>
            <p className="text-sm text-muted-foreground">
              Las estadísticas de tareas estarán disponibles en próximas fases.
            </p>
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(area);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onArchive(area.id, !area.is_archived);
                  onOpenChange(false);
                }}
              >
                {area.is_archived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Restaurar
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivar
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
