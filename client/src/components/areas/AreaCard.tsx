import { useState } from 'react';
import { Area } from '@/types/areas';
import { AreaIcon } from './AreaIcon';
import { VisibilityBadge } from './VisibilityBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AreaCardProps {
  area: Area;
  canEdit: boolean;
  canDelete: boolean;
  onView: (area: Area) => void;
  onEdit: (area: Area) => void;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (id: string) => void;
}

export function AreaCard({
  area,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onArchive,
  onDelete,
}: AreaCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    onDelete(area.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card 
        className={cn(
          "group relative overflow-hidden border-border/50 transition-all duration-200",
          "hover:shadow-md hover:border-border hover:-translate-y-0.5"
        )}
      >
        <div
          className="absolute left-0 top-0 h-full w-1 transition-all group-hover:w-1.5"
          style={{ backgroundColor: area.color }}
        />
        <CardContent className="p-4 pl-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                style={{ backgroundColor: `${area.color}15` }}
              >
                <AreaIcon icon={area.icon} className="h-5 w-5" style={{ color: area.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-card-foreground truncate">
                    {area.name}
                  </h3>
                  <VisibilityBadge visibility={area.visibility || 'org'} />
                  {area.is_archived && (
                    <Badge variant="secondary" className="shrink-0 text-xs font-medium">
                      Archivada
                    </Badge>
                  )}
                </div>
                {area.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {area.description}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onView(area)} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Ver detalle
                </DropdownMenuItem>
                
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => onEdit(area)} className="gap-2">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchive(area.id, !area.is_archived)} className="gap-2">
                      {area.is_archived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4" />
                          Restaurar
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" />
                          Archivar
                        </>
                      )}
                    </DropdownMenuItem>
                  </>
                )}
                
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar área?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el área
              <strong> "{area.name}"</strong> y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
