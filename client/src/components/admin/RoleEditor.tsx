import { useState } from 'react';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { RolePermissions, DEFAULT_ROLE_PERMISSIONS, CustomRole } from '@/types/enterprise';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2, Shield, Loader2, Lock } from 'lucide-react';
import { PERMISSION_LABELS as ENTERPRISE_PERMISSION_LABELS } from '@/types/enterprise';

// Map from centralized category structure to RolePermissions nested keys
// We use enterprise.ts PERMISSION_LABELS which is the authoritative mapping for RoleEditor
const ROLE_EDITOR_CATEGORIES: {
  id: string;
  label: string;
  icon: import('lucide-react').LucideIcon;
  categoryKey: keyof RolePermissions;
  actions: { key: string; label: string; description: string }[];
}[] = [];

// Build from enterprise PERMISSION_LABELS + descriptions
import {
  ListTodo, FolderOpen, Tag, FileText, ArrowLeftRight, Wrench, Car,
  CalendarDays, Clock, BarChart3, Layout, Zap, Users, CreditCard,
  Shield as ShieldIcon, Route, ClipboardCheck, Truck, PackageSearch, type LucideIcon,
} from 'lucide-react';

const CATEGORY_META: Record<string, { label: string; icon: LucideIcon; description: Record<string, string> }> = {
  tasks: {
    label: 'Tareas',
    icon: ListTodo,
    description: {
      read: 'Permite ver tareas en áreas visibles',
      create: 'Permite crear nuevas tareas',
      update: 'Permite editar tareas existentes',
      delete: 'Permite eliminar tareas permanentemente',
      change_status: 'Permite cambiar estado / mover en kanban',
      manage_columns: 'Permite crear/editar/eliminar columnas del kanban',
    },
  },
  areas: {
    label: 'Áreas',
    icon: FolderOpen,
    description: {
      read: 'Permite ver áreas de trabajo',
      manage: 'Permite crear, editar y eliminar áreas',
      manage_access_rules: 'Permite gestionar reglas de acceso personalizado',
    },
  },
  tags: {
    label: 'Etiquetas',
    icon: Tag,
    description: {
      read: 'Permite ver etiquetas existentes',
      create: 'Permite crear nuevas etiquetas',
      update: 'Permite editar etiquetas existentes',
      delete: 'Permite eliminar etiquetas',
      manage: 'Permite gestionar todas las etiquetas',
    },
  },
  forms: {
    label: 'Formularios',
    icon: FileText,
    description: {
      view: 'Permite ver formularios',
      create: 'Permite crear nuevos formularios',
      update: 'Permite editar formularios existentes',
      delete: 'Permite eliminar formularios',
      view_responses: 'Permite ver respuestas enviadas',
      manage: 'Permite gestionar todos los formularios',
    },
  },
  transfers: {
    label: 'Transfers',
    icon: ArrowLeftRight,
    description: {
      view: 'Permite ver transfers',
      create: 'Permite crear nuevas solicitudes',
      update: 'Permite editar datos de solicitudes',
      change_status: 'Permite cambiar estado de solicitudes',
      delete: 'Permite eliminar transfers',
      manage_pricing: 'Permite editar precios de items',
      manage_brokers: 'Permite gestionar brokers y proveedores',
      manage: 'Permite gestionar todos los transfers',
    },
  },
  garatech: {
    label: 'Garatech (Taller)',
    icon: Wrench,
    description: {
      view: 'Permite acceder al módulo de taller',
      create: 'Permite crear nuevas reparaciones',
      update: 'Permite editar datos de reparaciones',
      change_status: 'Permite cambiar estado de reparaciones',
      edit_dates: 'Permite editar fechas de reparaciones',
      manage_catalog: 'Permite gestionar catálogo de daños y talleres',
      manage_accidents: 'Permite gestionar siniestros',
      manage: 'Permite gestionar todo el módulo',
    },
  },
  vehicles: {
    label: 'Vehículos',
    icon: Car,
    description: {
      view: 'Permite ver vehículos',
      create: 'Permite dar de alta vehículos',
      update: 'Permite editar datos de vehículos',
      archive: 'Permite archivar/desarchivar vehículos',
      manage_daily_tasks: 'Permite gestionar tareas diarias',
      manage: 'Permite gestionar todos los vehículos',
    },
  },
  reservations: {
    label: 'Reservas',
    icon: CalendarDays,
    description: {
      view: 'Permite acceder al módulo de reservas',
      create: 'Permite crear nuevas reservas',
      manage: 'Permite editar y cancelar reservas',
    },
  },
  time_tracking: {
    label: 'Control horario',
    icon: Clock,
    description: {
      view: 'Permite ver registros de fichajes propios',
      view_team: 'Permite ver fichajes de otros miembros',
      create: 'Permite registrar fichajes manualmente',
      manage: 'Permite gestionar fichajes de otros',
    },
  },
  reports: {
    label: 'Reportes',
    icon: BarChart3,
    description: {
      view: 'Permite ver informes y estadísticas',
      export: 'Permite exportar reportes a Excel/PDF',
      view_financial: 'Permite ver datos financieros',
    },
  },
  templates: {
    label: 'Plantillas',
    icon: Layout,
    description: {
      read: 'Permite ver plantillas existentes',
      manage: 'Permite crear y gestionar plantillas',
      delete: 'Permite eliminar plantillas publicadas',
    },
  },
  automations: {
    label: 'Automatizaciones',
    icon: Zap,
    description: {
      read: 'Permite ver reglas de automatización',
      view: 'Permite ver reglas existentes',
      create: 'Permite crear nuevas reglas',
      manage: 'Permite editar y eliminar automatizaciones',
    },
  },
  team: {
    label: 'Miembros',
    icon: Users,
    description: {
      read: 'Permite ver el listado de miembros',
      manage: 'Permite gestionar miembros y roles',
      suspend: 'Permite suspender/reactivar miembros',
    },
  },
  billing: {
    label: 'Facturación',
    icon: CreditCard,
    description: {
      read: 'Permite ver información de facturación',
      view: 'Permite ver suscripción (solo lectura)',
      manage: 'Permite gestionar suscripción y pagos',
    },
  },
  integrations: {
    label: 'Integraciones',
    icon: ShieldIcon,
    description: {
      read: 'Permite ver configuración de integraciones',
      manage: 'Permite gestionar claves de API',
    },
  },
  audit_logs: {
    label: 'Auditoría',
    icon: ShieldIcon,
    description: { read: 'Permite ver registros de auditoría' },
  },
  movements: {
    label: 'Movimientos',
    icon: Route,
    description: {
      view: 'Permite ver el listado de movimientos',
      create: 'Permite registrar entregas, recogidas y movimientos',
      manage: 'Permite editar y cancelar movimientos',
      delete: 'Permite eliminar movimientos permanentemente',
      edit_photos: 'Permite añadir, editar y eliminar fotos',
      upload_receipt: 'Permite subir recibos y justificantes',
    },
  },
  daily_tasks: {
    label: 'Tareas diarias',
    icon: ClipboardCheck,
    description: {
      view: 'Permite ver las tareas diarias asignadas',
      view_other_days: 'Permite ver tareas de días anteriores y futuros',
      complete: 'Permite marcar tareas como completadas',
      manage: 'Permite crear, editar y eliminar tareas diarias',
    },
  },
  fleet: {
    label: 'Flota e inspecciones',
    icon: Truck,
    description: {
      view: 'Permite ver el listado de vehículos e inspecciones',
      manage: 'Permite gestionar inspecciones y datos de flota',
      import: 'Permite importar vehículos desde archivos Excel',
      gps: 'Permite acceder a la vista de localizadores GPS en tiempo real',
    },
  },
  schedules: {
    label: 'Programación',
    icon: Clock,
    description: {
      view: 'Permite ver la cuadrícula semanal de turnos',
      assign: 'Permite asignar y quitar turnos a empleados',
      manage_templates: 'Permite crear, editar y eliminar plantillas de turno',
      view_directiva: 'Permite ver los horarios del equipo Directiva',
      manage_notes: 'Permite crear, ver y eliminar notas internas en horarios',
      manage: 'Acceso completo a programación',
    },
  },
  lost_found: {
    label: 'Objetos Perdidos',
    icon: PackageSearch,
    description: {
      view: 'Permite ver el listado de objetos perdidos',
      create: 'Permite registrar nuevos objetos encontrados',
      update: 'Permite editar datos y cambiar estado de objetos',
      manage: 'Acceso completo: eliminar y gestionar todos los objetos',
    },
  },
};

interface RoleFormData {
  name: string;
  description: string;
  permissions: RolePermissions;
}

const INITIAL_FORM: RoleFormData = {
  name: '',
  description: '',
  permissions: DEFAULT_ROLE_PERMISSIONS,
};

export function RoleEditor() {
  const { roles, systemRoles, customRoles, isLoading, createRole, updateRole, deleteRole, isCreating, isUpdating } = useCustomRoles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [formData, setFormData] = useState<RoleFormData>(INITIAL_FORM);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setFormData(INITIAL_FORM);
    setDialogOpen(true);
  };

  const handleOpenEdit = (role: CustomRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions_json,
    });
    setDialogOpen(true);
  };

  const handleDelete = (role: CustomRole) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el rol "${role.name}"? Los usuarios con este rol perderán sus permisos.`)) {
      deleteRole(role.id);
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingRole) {
      updateRole({
        id: editingRole.id,
        name: formData.name,
        description: formData.description || undefined,
        permissions: formData.permissions,
      });
    } else {
      createRole({
        name: formData.name,
        description: formData.description || undefined,
        permissions: formData.permissions,
      });
    }
    setDialogOpen(false);
  };

  const togglePermission = (category: keyof RolePermissions, action: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: {
          ...prev.permissions[category],
          [action]: !prev.permissions[category][action as keyof typeof prev.permissions[typeof category]],
        },
      },
    }));
  };

  const toggleAllInCategory = (category: keyof RolePermissions, allEnabled: boolean) => {
    const categoryPerms = formData.permissions[category];
    const newPerms: Record<string, boolean> = {};
    Object.keys(categoryPerms).forEach(key => {
      newPerms[key] = !allEnabled;
    });
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: newPerms,
      },
    }));
  };

  const countEnabledPermissions = (permissions: RolePermissions): number => {
    let count = 0;
    Object.values(permissions).forEach(category => {
      Object.values(category).forEach(value => {
        if (value) count++;
      });
    });
    return count;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Roles personalizados</h3>
          <p className="text-sm text-muted-foreground">
            Crea roles con permisos específicos para tu organización
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Crear rol
        </Button>
      </div>

      {/* System Roles Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Roles del sistema
          </CardTitle>
          <CardDescription>
            Estos roles vienen predefinidos y no pueden eliminarse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['owner', 'admin', 'manager', 'member', 'read_only'].map(role => (
              <Badge key={role} variant="secondary">
                {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : role === 'read_only' ? 'Solo lectura' : 'Miembro'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles personalizados ({customRoles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay roles personalizados</p>
              <p className="text-sm">Crea un rol para definir permisos específicos</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRoles.map(role => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {countEnabledPermissions(role.permissions_json)} activos
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(role)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(role)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar rol' : 'Crear nuevo rol'}</DialogTitle>
            <DialogDescription>
              Define el nombre, descripción y permisos del rol
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del rol *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Supervisor de Ventas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe qué puede hacer este rol..."
                  rows={2}
                />
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <Label>Permisos</Label>
              <Accordion type="multiple" className="w-full space-y-2">
                {Object.entries(ENTERPRISE_PERMISSION_LABELS).map(([category, actions]) => {
                  const meta = CATEGORY_META[category];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const categoryPerms = formData.permissions[category as keyof RolePermissions] || {};
                  const enabledCount = Object.values(categoryPerms).filter(Boolean).length;
                  const totalCount = Object.keys(actions).length;
                  const allEnabled = enabledCount === totalCount && totalCount > 0;
                  const someEnabled = enabledCount > 0 && !allEnabled;

                  return (
                    <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline text-sm">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{meta.label}</span>
                          <Badge variant="outline" className="text-xs font-normal">
                            {enabledCount}/{totalCount}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1 pt-2">
                          {/* Select All */}
                          {totalCount > 1 && (
                            <div className="flex items-center gap-3 py-2 px-3 border-b border-border/50 mb-2">
                              <Checkbox
                                checked={allEnabled}
                                {...(someEnabled ? { 'data-state': 'indeterminate' } : {})}
                                onCheckedChange={() => toggleAllInCategory(category as keyof RolePermissions, allEnabled)}
                              />
                              <span className="text-sm font-medium text-muted-foreground">Seleccionar todos</span>
                            </div>
                          )}
                          {Object.entries(actions).map(([action, label]) => {
                            const isEnabled = categoryPerms?.[action as keyof typeof categoryPerms] ?? false;
                            const description = meta.description[action] || '';
                            
                            return (
                              <div key={action} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50">
                                <div className="flex-1 min-w-0 mr-4">
                                  <span className="text-sm font-medium">{label}</span>
                                  {description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                                  )}
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => togglePermission(category as keyof RolePermissions, action)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim() || isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRole ? 'Guardar cambios' : 'Crear rol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
