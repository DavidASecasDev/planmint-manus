import { useState } from 'react';
import { Plus, Upload, Pencil, Trash2, MoreHorizontal, FileSpreadsheet, Loader2, ShieldAlert } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useDamageCatalog } from '@/hooks/useDamageCatalog';
import { ImportDamageCatalog } from '@/components/garatech/ImportDamageCatalog';
import { DamageCatalogItemDialog } from '@/components/garatech/DamageCatalogItemDialog';
import { DAMAGE_CATEGORY_LABELS, type DamageCatalogItem } from '@/types/garatech';

export default function GaratechDamageCatalog() {
  const { catalog, isLoading, deleteItem, canView, canManage, permissionsLoading } = useDamageCatalog();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DamageCatalogItem | null>(null);

  const formatPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    return `${value.toLocaleString('es-ES')}€`;
  };

  const handleEdit = (item: DamageCatalogItem) => {
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  const handleDelete = async (item: DamageCatalogItem) => {
    if (confirm(`¿Eliminar "${item.name_es}" del catálogo?`)) {
      await deleteItem.mutateAsync(item.id);
    }
  };

  const handleItemDialogClose = () => {
    setItemDialogOpen(false);
    setEditingItem(null);
  };

  // Loading state
  if (permissionsLoading) {
    return (
      <AppLayout title="Catálogo de Daños">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Access denied
  if (!canView) {
    return (
      <AppLayout title="Catálogo de Daños">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver el catálogo de daños</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Catálogo de Daños">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <PageHeader
            title="Catálogo de Daños"
            description="Lista de precios por tipo de daño y nivel de gravedad"
            icon={FileSpreadsheet}
          />
          {canManage && (
            <div className="flex gap-2">
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Excel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Importar Catálogo</DialogTitle>
                  </DialogHeader>
                  <ImportDamageCatalog 
                    onComplete={() => setImportDialogOpen(false)}
                    onCancel={() => setImportDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              <Button onClick={() => setItemDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir Item
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Precios</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : catalog.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No hay items en el catálogo</p>
                <p className="text-sm mt-1">Importa un Excel o añade items manualmente</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Nivel 1</TableHead>
                    <TableHead className="text-right">Nivel 2</TableHead>
                    <TableHead className="text-right">Nivel 3</TableHead>
                    <TableHead className="text-right">Nivel 4</TableHead>
                    <TableHead className="text-right">Nivel 5</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name_es}</p>
                          {item.name_en && (
                            <p className="text-xs text-muted-foreground">{item.name_en}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {DAMAGE_CATEGORY_LABELS[item.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(item.price_level_1)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(item.price_level_2)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(item.price_level_3)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(item.price_level_4)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(item.price_level_5)}</TableCell>
                      <TableCell>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(item)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <DamageCatalogItemDialog
        open={itemDialogOpen}
        onOpenChange={handleItemDialogClose}
        item={editingItem}
      />
    </AppLayout>
  );
}
