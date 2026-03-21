import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, MoreHorizontal, Pencil, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAccidents } from '@/hooks/useAccidents';
import { AccidentFormDialog } from '@/components/garatech/AccidentFormDialog';
import { ACCIDENT_SEVERITY_COLORS, ACCIDENT_SEVERITY_LABELS, ACCIDENT_STATUS_LABELS, type Accident, type AccidentSeverity, type AccidentStatus } from '@/types/garatech';

export default function GaratechAccidents() {
  const navigate = useNavigate();
  const { accidents, isLoading, deleteAccident, canView, canManage, permissionsLoading } = useAccidents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccident, setEditingAccident] = useState<Accident | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Accident | null>(null);

  const handleCreate = () => {
    setEditingAccident(null);
    setDialogOpen(true);
  };

  const handleEdit = (accident: Accident) => {
    setEditingAccident(accident);
    setDialogOpen(true);
  };

  const handleDeleteRequest = (accident: Accident) => setDeleteTarget(accident);
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteAccident.mutateAsync(deleteTarget.id);
    } catch (error) {
      // Error handled in hook
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteAccident]);

  const getSeverityBadgeStyle = (severity: string | null) => {
    const key = (severity || 'leve') as AccidentSeverity;
    const colors = ACCIDENT_SEVERITY_COLORS[key] || ACCIDENT_SEVERITY_COLORS.leve;
    return { backgroundColor: colors.bg, color: colors.text };
  };

  // Loading state
  if (permissionsLoading) {
    return (
      <AppLayout title="Accidentes">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Access denied
  if (!canView) {
    return (
      <AppLayout title="Accidentes">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver accidentes</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Accidentes">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <PageHeader
            title="Accidentes"
            description="Registro y seguimiento de accidentes de la flota"
            icon={AlertTriangle}
          />
          {canManage && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Accidente
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : accidents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No hay accidentes registrados</p>
                <p className="text-sm mt-1">Los accidentes de vehículos aparecerán aquí</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Parte</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Gravedad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accidents.map((accident) => (
                    <TableRow 
                      key={accident.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/garatech/accidents/${accident.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {accident.accident_number || '—'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(accident.accident_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        {accident.vehicle ? (
                          <div>
                            <p className="font-medium">{accident.vehicle.matricula}</p>
                            <p className="text-xs text-muted-foreground">
                              {accident.vehicle.modelo}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          style={getSeverityBadgeStyle(accident.severity)}
                          className="border-0"
                        >
                          {ACCIDENT_SEVERITY_LABELS[accident.severity as AccidentSeverity] || accident.severity}
                          {accident.has_injuries && ' + Heridos'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ACCIDENT_STATUS_LABELS[accident.status as AccidentStatus] || accident.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {accident.location || '—'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManage && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(accident)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDeleteRequest(accident)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar accidente"
        description={`¿Eliminar el accidente del ${deleteTarget ? format(new Date(deleteTarget.accident_date), 'dd/MM/yyyy') : ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      <AccidentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accident={editingAccident}
      />
    </AppLayout>
  );
}
