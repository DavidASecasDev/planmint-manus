import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Shield, 
  Plus, 
  Pencil, 
  Trash2, 
  Lock,
  Loader2,
  Users
} from 'lucide-react';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  CustomRole, 
  RolePermissions, 
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_LABELS 
} from '@/types/enterprise';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { EmptyState } from '@/components/ui/empty-state';

export function RolesSection() {
  const { roles, systemRoles, customRoles, isLoading, createRole, updateRole, deleteRole, isCreating, isUpdating } = useCustomRoles();
  const { isTeamPlan } = useSubscription();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);

  const handleOpenCreate = () => {
    if (!isTeamPlan) {
      setShowUpgradeModal(true);
      return;
    }
    setName('');
    setDescription('');
    setPermissions(DEFAULT_ROLE_PERMISSIONS);
    setShowCreateDialog(true);
  };

  const handleOpenEdit = (role: CustomRole) => {
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description || '');
    setPermissions(role.permissions_json);
  };

  const handleCreate = () => {
    createRole({ name, description, permissions });
    setShowCreateDialog(false);
  };

  const handleUpdate = () => {
    if (!editingRole) return;
    updateRole({ id: editingRole.id, name, description, permissions });
    setEditingRole(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este rol?')) {
      deleteRole(id);
    }
  };

  const togglePermission = (module: string, action: string) => {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module as keyof RolePermissions],
        [action]: !prev[module as keyof RolePermissions]?.[action as keyof typeof prev[keyof RolePermissions]],
      },
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Roles del sistema</CardTitle>
          </div>
          <CardDescription>
            Roles predefinidos que no se pueden modificar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {systemRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{role.name}</p>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Roles personalizados</CardTitle>
              {!isTeamPlan && <Badge variant="secondary">Team</Badge>}
            </div>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Crear rol
            </Button>
          </div>
          <CardDescription>
            Crea roles con permisos específicos para tu organización
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customRoles.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Sin roles personalizados"
              description={
                isTeamPlan 
                  ? "Crea tu primer rol personalizado"
                  : "Actualiza a Team para crear roles personalizados"
              }
              action={
                isTeamPlan 
                  ? { label: 'Crear rol', onClick: handleOpenCreate, icon: Plus }
                  : { label: 'Actualizar a Team', onClick: () => setShowUpgradeModal(true) }
              }
            />
          ) : (
            <div className="space-y-3">
              {customRoles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{role.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {role.description || 'Sin descripción'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(role)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(role.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={showCreateDialog || !!editingRole} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingRole(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Editar rol' : 'Crear rol'}
            </DialogTitle>
            <DialogDescription>
              Define los permisos para este rol
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Supervisor"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe qué puede hacer este rol..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Permisos</Label>
              <ScrollArea className="h-[300px] border rounded-lg p-3">
                <Accordion type="multiple" className="w-full">
                  {Object.entries(PERMISSION_LABELS).map(([module, actions]) => (
                    <AccordionItem key={module} value={module}>
                      <AccordionTrigger className="text-sm capitalize">
                        {module === 'audit_logs' ? 'Auditoría' : module === 'schedules' ? 'Programación' : module === 'tasks' ? 'Tareas' : module === 'areas' ? 'Áreas' : module === 'tags' ? 'Etiquetas' : module === 'automations' ? 'Automatizaciones' : module === 'integrations' ? 'Integraciones' : module === 'billing' ? 'Facturación' : module === 'templates' ? 'Plantillas' : module === 'team' ? 'Equipo' : module === 'reports' ? 'Reportes' : module === 'reservations' ? 'Reservas' : module === 'transfers' ? 'Transfers' : module === 'forms' ? 'Formularios' : module === 'vehicles' ? 'Vehículos' : module === 'time_tracking' ? 'Fichajes' : module === 'movements' ? 'Movimientos' : module === 'daily_tasks' ? 'Tareas Diarias' : module === 'fleet' ? 'Flota' : module === 'members' ? 'Miembros' : module === 'security' ? 'Seguridad' : module === 'lost_found' ? 'Objetos Perdidos' : module === 'garatech' ? 'Garatech' : module}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {Object.entries(actions).map(([action, label]) => (
                            <div key={action} className="flex items-center justify-between">
                              <span className="text-sm">{label}</span>
                              <Switch
                                checked={permissions[module as keyof RolePermissions]?.[action as keyof typeof permissions[keyof RolePermissions]] || false}
                                onCheckedChange={() => togglePermission(module, action)}
                              />
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingRole(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={editingRole ? handleUpdate : handleCreate}
              disabled={!name.trim() || isCreating || isUpdating}
            >
              {(isCreating || isUpdating) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRole ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza a Team para crear roles personalizados"
        suggestedPlan="team"
      />
    </div>
  );
}
