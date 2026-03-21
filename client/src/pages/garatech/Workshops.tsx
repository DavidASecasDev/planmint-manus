import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Search, LayoutGrid, List, Loader2, ShieldAlert, MoreHorizontal, Trash2, Phone, Mail, MapPin, Star } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useWorkshops } from '@/hooks/useWorkshops';
import { WorkshopCard } from '@/components/garatech/WorkshopCard';
import type { Workshop } from '@/types/garatech';

export default function GaratechWorkshops() {
  const navigate = useNavigate();
  const { workshops, isLoading, deleteWorkshop, updateRating, canView, canManage, permissionsLoading } = useWorkshops();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteTarget, setDeleteTarget] = useState<Workshop | null>(null);

  const handleDeleteRequest = (workshop: Workshop) => setDeleteTarget(workshop);
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteWorkshop.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteWorkshop]);

  const handleViewDetails = (workshop: Workshop) => {
    navigate(`/garatech/workshops/${workshop.id}`);
  };

  const handleRatingChange = async (workshopId: string, rating: number) => {
    await updateRating.mutateAsync({ id: workshopId, rating });
  };

  const filteredWorkshops = workshops.filter(workshop =>
    workshop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workshop.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workshop.phone?.includes(searchQuery) ||
    workshop.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = workshops.filter(w => w.is_active).length;

  if (permissionsLoading) {
    return (
      <AppLayout title="Talleres">
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!canView) {
    return (
      <AppLayout title="Talleres">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver talleres</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Talleres">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <PageHeader title="Talleres" description="Gestiona los talleres y proveedores de servicio" icon={Building2} />
          {canManage && (
            <Button onClick={() => navigate('/garatech/workshops/new')} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />Añadir Taller
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                <div><p className="text-2xl font-bold">{workshops.length}</p><p className="text-xs text-muted-foreground">Total talleres</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-green-500" /></div>
                <div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Activos</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Building2 className="h-5 w-5 text-muted-foreground" /></div>
                <div><p className="text-2xl font-bold">{workshops.length - activeCount}</p><p className="text-xs text-muted-foreground">Inactivos</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar talleres..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as 'grid' | 'list')} className="border rounded-lg p-1">
            <ToggleGroupItem value="grid" aria-label="Vista cuadrícula" className="px-3"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Vista lista" className="px-3"><List className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4"><Skeleton className="w-12 h-12 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-20" /></div></div>
                <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
              </CardContent></Card>
            ))}
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center"><Building2 className="h-8 w-8 opacity-50" /></div>
                <p className="font-medium text-lg">{searchQuery ? 'No se encontraron talleres' : 'No hay talleres registrados'}</p>
                <p className="text-sm mt-1">{searchQuery ? 'Intenta con otros términos de búsqueda' : 'Añade talleres para gestionar reparaciones'}</p>
                {!searchQuery && canManage && (
                  <Button className="mt-4" onClick={() => navigate('/garatech/workshops/new')}>
                    <Plus className="h-4 w-4 mr-2" />Añadir primer taller
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkshops.map((workshop) => (
              <WorkshopCard
                key={workshop.id}
                workshop={workshop}
                onEdit={canManage ? () => navigate(`/garatech/workshops/${workshop.id}`) : undefined}
                onDelete={canManage ? handleDeleteRequest : undefined}
                onViewDetails={handleViewDetails}
                onViewHistory={handleViewDetails}
                onRatingChange={canManage ? handleRatingChange : undefined}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Valoración</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkshops.map((workshop) => (
                    <TableRow key={workshop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(workshop)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-primary" /></div>
                          <div>
                            <div className="font-medium">{workshop.name}</div>
                            {workshop.notes && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{workshop.notes}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-3.5 w-3.5 ${star <= (workshop.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">{workshop.rating?.toFixed(1) || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {workshop.address ? (
                          <div className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{workshop.address}</div>
                        ) : <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {workshop.phone && <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3 text-muted-foreground" />{workshop.phone}</div>}
                          {workshop.email && <div className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3 text-muted-foreground" />{workshop.email}</div>}
                          {!workshop.phone && !workshop.email && <span className="text-muted-foreground">--</span>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={workshop.is_active ? 'default' : 'secondary'}>{workshop.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(workshop)}>Ver Detalles</DropdownMenuItem>
                            {canManage && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRequest(workshop)}>
                                <Trash2 className="h-4 w-4 mr-2" />Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar taller"
        description={`¿Eliminar el taller "${deleteTarget?.name || ''}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </AppLayout>
  );
}
