import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useEquipmentInventory, useEquipmentAssignments } from '@/hooks/useEquipment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTransition } from '@/components/ui/skeleton-transition';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Baby,
  Plus,
  Search,
  Package,
  Wrench,
  XCircle,
  CheckCircle2,
  ArrowRightLeft,
  History,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  EQUIPMENT_TIPO_LABELS,
  EQUIPMENT_ESTADO_LABELS,
  EQUIPMENT_ESTADO_COLORS,
  EQUIPMENT_KANBAN_COLUMNS,
  type EquipmentItem,
  type EquipmentTipo,
  type EquipmentEstado,
} from '@/types/equipment';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Column icon mapping ── */
const COLUMN_ICONS: Record<EquipmentEstado, typeof CheckCircle2> = {
  disponible: CheckCircle2,
  asignada: ArrowRightLeft,
  mantenimiento: Wrench,
  baja: XCircle,
};

const COLUMN_HEADER_COLORS: Record<EquipmentEstado, string> = {
  disponible: 'border-emerald-400/60',
  asignada: 'border-blue-400/60',
  mantenimiento: 'border-amber-400/60',
  baja: 'border-red-400/60',
};

/* ── Main Page ── */
export default function FleetEquipment() {
  const {
    items,
    isLoading,
    stats,
    createItem,
    updateItem,
    deleteItem,
    changeStatus,
    returnFromReservation,
  } = useEquipmentInventory();

  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<EquipmentTipo | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    tipo: 'silla_bebe' as EquipmentTipo,
    nombre: '',
    codigo: '',
    notas: '',
    fecha_compra: '',
  });

  // Return form state
  const [returnCondition, setReturnCondition] = useState('bueno');
  const [returnNotes, setReturnNotes] = useState('');

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        if (tipoFilter !== 'all' && i.tipo !== tipoFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            i.codigo.toLowerCase().includes(s) ||
            i.nombre.toLowerCase().includes(s) ||
            (i.vehicle_matricula || '').toLowerCase().includes(s)
          );
        }
        return true;
      });
  }, [items, search, tipoFilter]);

  const byStatus = useMemo(() => {
    const map: Record<EquipmentEstado, EquipmentItem[]> = {
      disponible: [],
      asignada: [],
      mantenimiento: [],
      baja: [],
    };
    filtered.forEach((i) => map[i.estado].push(i));
    return map;
  }, [filtered]);

  const resetForm = () => {
    setFormData({ tipo: 'silla_bebe', nombre: '', codigo: '', notas: '', fecha_compra: '' });
  };

  const handleCreate = () => {
    createItem.mutate(
      {
        tipo: formData.tipo,
        nombre: formData.nombre || EQUIPMENT_TIPO_LABELS[formData.tipo],
        codigo: formData.codigo,
        notas: formData.notas || undefined,
        fecha_compra: formData.fecha_compra || undefined,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleEdit = () => {
    if (!selectedItem) return;
    updateItem.mutate(
      {
        id: selectedItem.id,
        nombre: formData.nombre,
        codigo: formData.codigo,
        notas: formData.notas || null,
        fecha_compra: formData.fecha_compra || null,
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          setSelectedItem(null);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    deleteItem.mutate(selectedItem.id, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        setDetailOpen(false);
        setSelectedItem(null);
      },
    });
  };

  const handleReturn = () => {
    if (!selectedItem) return;
    returnFromReservation.mutate(
      {
        equipmentId: selectedItem.id,
        conditionIn: returnCondition,
        notes: returnNotes || undefined,
      },
      {
        onSuccess: () => {
          setReturnOpen(false);
          setDetailOpen(false);
          setSelectedItem(null);
          setReturnCondition('bueno');
          setReturnNotes('');
        },
      }
    );
  };

  const openDetail = (item: EquipmentItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const openEdit = (item: EquipmentItem) => {
    setFormData({
      tipo: item.tipo,
      nombre: item.nombre,
      codigo: item.codigo,
      notas: item.notas || '',
      fecha_compra: item.fecha_compra || '',
    });
    setSelectedItem(item);
    setEditOpen(true);
  };

  /* ── Skeleton ── */
  const skeleton = (
    <div className="space-y-4">
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            {[1, 2].map((card) => (
              <Skeleton key={card} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout title="Equipamiento">
      <div className="container max-w-7xl py-6 space-y-6">
        <PageHeader
          title="Equipamiento"
          description="Gestión de sillitas, GPS y otros extras"
          icon={Baby}
          actions={
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo equipo
            </Button>
          }
        />

        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {EQUIPMENT_KANBAN_COLUMNS.map((estado) => {
            const Icon = COLUMN_ICONS[estado];
            const count = byStatus[estado].length;
            return (
              <Card key={estado} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${EQUIPMENT_ESTADO_COLORS[estado].split(' ').slice(0, 1).join(' ')}`}>
                    <Icon className={`h-4 w-4 ${EQUIPMENT_ESTADO_COLORS[estado].split(' ').slice(1, 2).join(' ')}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {EQUIPMENT_ESTADO_LABELS[estado]}
                    </p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, nombre o matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              variant={tipoFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoFilter('all')}
              className="h-8 text-xs"
            >
              Todos
            </Button>
            {(['silla_bebe', 'silla_infantes', 'elevador'] as EquipmentTipo[]).map((tipo) => (
              <Button
                key={tipo}
                variant={tipoFilter === tipo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTipoFilter(tipo)}
                className="h-8 text-xs"
              >
                {EQUIPMENT_TIPO_LABELS[tipo]}
              </Button>
            ))}
          </div>
        </div>

        {/* Kanban board */}
        <SkeletonTransition isLoading={isLoading} skeleton={skeleton}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {EQUIPMENT_KANBAN_COLUMNS.map((estado) => {
              const Icon = COLUMN_ICONS[estado];
              const columnItems = byStatus[estado];
              return (
                <div key={estado} className="space-y-2">
                  {/* Column header */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-card border-l-4 ${COLUMN_HEADER_COLORS[estado]}`}>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{EQUIPMENT_ESTADO_LABELS[estado]}</span>
                    <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                      {columnItems.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 min-h-[80px]">
                    <AnimatePresence mode="popLayout">
                      {columnItems.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card
                            className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => openDetail(item)}
                          >
                            <CardContent className="p-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-primary">
                                  {item.codigo}
                                </span>
                                <Badge className={`text-[10px] px-1.5 h-5 ${EQUIPMENT_ESTADO_COLORS[item.estado]}`}>
                                  {EQUIPMENT_TIPO_LABELS[item.tipo]}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium truncate">{item.nombre}</p>
                              {item.vehicle_matricula && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  🚗 {item.vehicle_matricula}
                                </p>
                              )}
                              {item.notas && (
                                <p className="text-xs text-muted-foreground truncate">{item.notas}</p>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {columnItems.length === 0 && (
                      <div className="flex items-center justify-center h-16 rounded-lg border border-dashed text-xs text-muted-foreground">
                        Sin elementos
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SkeletonTransition>

        {/* ── Create Dialog ── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo equipo</DialogTitle>
              <DialogDescription>Registra una nueva unidad de equipamiento</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData((f) => ({ ...f, tipo: v as EquipmentTipo }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EQUIPMENT_TIPO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código / Etiqueta *</Label>
                <Input
                  placeholder="Ej: SB-001"
                  value={formData.codigo}
                  onChange={(e) => setFormData((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  placeholder={EQUIPMENT_TIPO_LABELS[formData.tipo]}
                  value={formData.nombre}
                  onChange={(e) => setFormData((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de compra</Label>
                <Input
                  type="date"
                  value={formData.fecha_compra}
                  onChange={(e) => setFormData((f) => ({ ...f, fecha_compra: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  placeholder="Notas opcionales..."
                  value={formData.notas}
                  onChange={(e) => setFormData((f) => ({ ...f, notas: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.codigo || createItem.isPending}
              >
                {createItem.isPending ? 'Creando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit Dialog ── */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar equipo</DialogTitle>
              <DialogDescription>Modifica los datos de esta unidad</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código / Etiqueta</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de compra</Label>
                <Input
                  type="date"
                  value={formData.fecha_compra}
                  onChange={(e) => setFormData((f) => ({ ...f, fecha_compra: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={formData.notas}
                  onChange={(e) => setFormData((f) => ({ ...f, notas: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEdit} disabled={updateItem.isPending}>
                {updateItem.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Detail Sheet ── */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="font-mono text-primary">{selectedItem?.codigo}</span>
                {selectedItem && (
                  <Badge className={EQUIPMENT_ESTADO_COLORS[selectedItem.estado]}>
                    {EQUIPMENT_ESTADO_LABELS[selectedItem.estado]}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>{selectedItem?.nombre}</SheetDescription>
            </SheetHeader>

            {selectedItem && (
              <div className="mt-6 space-y-6">
                {/* Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Información
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Tipo</p>
                      <p className="font-medium">{EQUIPMENT_TIPO_LABELS[selectedItem.tipo]}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Estado</p>
                      <p className="font-medium">{EQUIPMENT_ESTADO_LABELS[selectedItem.estado]}</p>
                    </div>
                    {selectedItem.vehicle_matricula && (
                      <div>
                        <p className="text-muted-foreground text-xs">Vehículo</p>
                        <p className="font-medium">{selectedItem.vehicle_matricula}</p>
                      </div>
                    )}
                    {selectedItem.fecha_compra && (
                      <div>
                        <p className="text-muted-foreground text-xs">Fecha compra</p>
                        <p className="font-medium">
                          {format(new Date(selectedItem.fecha_compra), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    )}
                    {selectedItem.fecha_ultima_revision && (
                      <div>
                        <p className="text-muted-foreground text-xs">Última revisión</p>
                        <p className="font-medium">
                          {format(new Date(selectedItem.fecha_ultima_revision), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedItem.notas && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Notas</p>
                      <p className="text-sm bg-muted/50 rounded-lg p-2">{selectedItem.notas}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Acciones
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(selectedItem)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    {selectedItem.estado === 'asignada' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReturnOpen(true)}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                        Devolver
                      </Button>
                    )}
                    {selectedItem.estado === 'mantenimiento' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          changeStatus.mutate({ id: selectedItem.id, estado: 'disponible' })
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Marcar disponible
                      </Button>
                    )}
                    {selectedItem.estado === 'disponible' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          changeStatus.mutate({ id: selectedItem.id, estado: 'mantenimiento' })
                        }
                      >
                        <Wrench className="h-3.5 w-3.5 mr-1" />
                        A mantenimiento
                      </Button>
                    )}
                    {selectedItem.estado !== 'baja' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          changeStatus.mutate({ id: selectedItem.id, estado: 'baja' })
                        }
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Dar de baja
                      </Button>
                    )}
                    {selectedItem.estado === 'baja' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          changeStatus.mutate({ id: selectedItem.id, estado: 'disponible' })
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Reactivar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </div>

                {/* Assignment History */}
                <EquipmentHistorySection equipmentId={selectedItem.id} />
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* ── Return Dialog ── */}
        <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Devolver equipo</DialogTitle>
              <DialogDescription>
                Devolviendo {selectedItem?.codigo} — {selectedItem?.nombre}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Estado al devolver</Label>
                <Select value={returnCondition} onValueChange={setReturnCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bueno">Bueno</SelectItem>
                    <SelectItem value="aceptable">Aceptable</SelectItem>
                    <SelectItem value="dañado">Dañado</SelectItem>
                    <SelectItem value="reparar">Necesita reparación</SelectItem>
                  </SelectContent>
                </Select>
                {(returnCondition === 'dañado' || returnCondition === 'reparar') && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Se moverá automáticamente a Mantenimiento
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  placeholder="Observaciones sobre el estado..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReturn} disabled={returnFromReservation.isPending}>
                {returnFromReservation.isPending ? 'Devolviendo...' : 'Confirmar devolución'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirm ── */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar equipo</DialogTitle>
              <DialogDescription>
                ¿Seguro que quieres eliminar {selectedItem?.codigo}? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
                {deleteItem.isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

/* ── Assignment History Section ── */
function EquipmentHistorySection({ equipmentId }: { equipmentId: string }) {
  const { assignments, isLoading } = useEquipmentAssignments(equipmentId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />
        Historial de asignaciones
      </h4>
      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sin asignaciones registradas</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="text-xs bg-muted/40 rounded-lg p-2.5 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {format(new Date(a.assigned_at), 'dd MMM yyyy HH:mm', { locale: es })}
                </span>
                {a.returned_at ? (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    Devuelto
                  </Badge>
                ) : (
                  <Badge className="text-[10px] h-4 bg-blue-100 text-blue-800">
                    Activa
                  </Badge>
                )}
              </div>
              {a.vehicle_matricula && (
                <p className="text-muted-foreground">Vehículo: {a.vehicle_matricula}</p>
              )}
              {a.returned_at && (
                <p className="text-muted-foreground">
                  Devuelto: {format(new Date(a.returned_at), 'dd MMM yyyy HH:mm', { locale: es })}
                  {a.condition_in && ` — ${a.condition_in}`}
                </p>
              )}
              {a.notes && <p className="text-muted-foreground italic">{a.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
