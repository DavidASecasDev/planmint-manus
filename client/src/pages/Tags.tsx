import { useState } from 'react';
import { Plus, Tag as TagIconLucide } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { Tag } from '@/types/tags';
import { AppLayout } from '@/components/layout/AppLayout';
import { TagIcon } from '@/components/tags/TagIcon';
import { TagForm } from '@/components/tags/TagForm';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { GridSkeleton } from '@/components/ui/loading-skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

export default function Tags() {
  const { tags, loading, canManageTags, createTag, updateTag, deleteTag } = useTags();
  const { canCreateTag } = usePlanLimits();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');

  const handleCreateNew = () => {
    const limitCheck = canCreateTag();
    if (!limitCheck.allowed) {
      setLimitMessage(limitCheck.message);
      setUpgradeModalOpen(true);
      return;
    }
    setSelectedTag(null);
    setFormOpen(true);
  };

  const handleEdit = (tag: Tag) => {
    setSelectedTag(tag);
    setFormOpen(true);
  };

  const handleDeleteClick = (tag: Tag) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (tagToDelete) {
      await deleteTag(tagToDelete.id);
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    }
  };

  const handleFormSubmit = async (data: { name: string; color: string; icon: string }) => {
    if (selectedTag) {
      await updateTag(selectedTag.id, data);
    } else {
      await createTag(data);
    }
  };

  return (
    <AppLayout title="Etiquetas">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Etiquetas"
          description="Crea etiquetas reutilizables para clasificar tus tareas por temas, clientes, contexto y más."
          icon={TagIconLucide}
          actions={
            canManageTags && (
              <Button onClick={handleCreateNew} size="lg" className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Nueva etiqueta
              </Button>
            )
          }
        />

        {/* Content */}
        {loading ? (
          <GridSkeleton count={6} columns={3} />
        ) : tags.length === 0 ? (
          <EmptyState
            icon={TagIconLucide}
            title="No hay etiquetas creadas"
            description="Las etiquetas te permiten clasificar y filtrar tus tareas de forma flexible. Crea tu primera etiqueta para empezar."
            action={
              canManageTags
                ? {
                    label: 'Crear primera etiqueta',
                    onClick: handleCreateNew,
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => (
              <Card key={tag.id} className="group border-border/50 shadow-sm hover-lift transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${tag.color}15` }}
                      >
                        <TagIcon icon={tag.icon} size={22} style={{ color: tag.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{tag.name}</p>
                        <div
                          className="w-8 h-1.5 rounded-full mt-1.5"
                          style={{ backgroundColor: tag.color }}
                        />
                      </div>
                    </div>

                    {canManageTags && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(tag)} className="gap-2.5 cursor-pointer">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(tag)}
                            className="gap-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <TagForm
          open={formOpen}
          onOpenChange={setFormOpen}
          tag={selectedTag}
          onSubmit={handleFormSubmit}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar etiqueta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esto quitará la etiqueta "{tagToDelete?.name}" de todas las tareas donde esté asignada.
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <UpgradeModal
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          limitMessage={limitMessage}
        />
      </div>
    </AppLayout>
  );
}
