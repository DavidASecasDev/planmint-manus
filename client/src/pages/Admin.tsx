import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Navigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePermissions, useOrganizationMembers, OrgRole } from '@/hooks/usePermissions';
import { getDefaultPermissionsForRole as getDefaultPermissionsForRoleFn } from '@shared/permissionDefaults';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MoreHorizontal, Shield, UserPlus, Users, Crown, AlertTriangle, Settings, Layers, Bug, Trash2, Eye, Key } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PERMISSION_CATEGORIES as PERMISSION_CATEGORIES_DEF } from '@/lib/permissionDefinitions';
import { MemberPermissionsEditor } from '@/components/admin/MemberPermissionsEditor';
import { RoleEditor } from '@/components/admin/RoleEditor';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { ResetMemberPasswordDialog } from '@/components/admin/ResetMemberPasswordDialog';
import { EffectivePermissionsView } from '@/components/admin/EffectivePermissionsView';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const systemRoleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Miembro',
  read_only: 'Solo lectura',
};

const roleBadgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'default',
  manager: 'secondary',
  member: 'outline',
  read_only: 'outline',
};

export default function Admin() {
  const { profile, user } = useAuth();
  const { canAccessAdminPanel, isLoading: permissionsLoading, role: myRole, isOwner } = usePermissions();
  const { members, isLoading: membersLoading, updateMemberRole, updateMemberStatus, removeMember, resetMemberPassword, isResettingPassword, isUpdating } = useOrganizationMembers();
  const { customRoles } = useCustomRoles();

  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [changeRoleDialog, setChangeRoleDialog] = useState<{ memberId: string; currentRole: OrgRole; userId: string } | null>(null);
  const [newRole, setNewRole] = useState<OrgRole>('member');
  const [permissionsDialog, setPermissionsDialog] = useState<{ userId: string; userName: string } | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ userId: string; userName: string } | null>(null);

  if (permissionsLoading) {
    return (
      <AppLayout title="Administración">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!canAccessAdminPanel) {
    return <Navigate to="/dashboard" replace />;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleChangeRole = () => {
    if (!changeRoleDialog) return;
    updateMemberRole({ memberId: changeRoleDialog.memberId, role: newRole });
    setChangeRoleDialog(null);
  };

  const handleToggleStatus = (memberId: string, currentStatus: 'active' | 'suspended') => {
    updateMemberStatus({ memberId, status: currentStatus === 'active' ? 'suspended' : 'active' });
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar a este miembro? Esta acción no se puede deshacer.')) {
      removeMember(memberId);
    }
  };

  const ownerCount = members.filter(m => m.role === 'owner').length;

  return (
    <AppLayout title="Administración">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Administración</h1>
            <p className="text-muted-foreground">Gestiona los miembros y permisos de tu organización</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/settings/admin/trash">
                <Trash2 className="h-4 w-4 mr-2" />
                Papelera
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/settings/admin/diagnostics">
                <Bug className="h-4 w-4 mr-2" />
                Diagnóstico
              </Link>
            </Button>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Crear usuario
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total miembros</p>
                  <p className="text-2xl font-bold">{members.length}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Owners</p>
                  <p className="text-2xl font-bold">{members.filter(m => m.role === 'owner').length}</p>
                </div>
                <Crown className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Admins</p>
                  <p className="text-2xl font-bold">{members.filter(m => m.role === 'admin').length}</p>
                </div>
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Suspendidos</p>
                  <p className="text-2xl font-bold">{members.filter(m => m.status === 'suspended').length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Miembros</TabsTrigger>
            <TabsTrigger value="roles">
              <Layers className="h-4 w-4 mr-2" />
              Roles
            </TabsTrigger>

            <TabsTrigger value="defaults">Permisos por defecto</TabsTrigger>
            <TabsTrigger value="effective">
              <Eye className="h-4 w-4 mr-2" />
              Permisos efectivos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Miembros de la organización</CardTitle>
                <CardDescription>
                  Gestiona los roles y permisos de cada miembro
                </CardDescription>
              </CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Miembro</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const isMe = member.user_id === user?.id;
                        const isOnlyOwner = member.role === 'owner' && ownerCount === 1;
                        const canChangeRole = (isOwner || (myRole === 'admin' && member.role !== 'owner')) && !isOnlyOwner;
                        const canSuspend = !isMe && member.role !== 'owner';
                        const canRemove = isOwner && !isMe && !isOnlyOwner;

                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                    {getInitials(member.profile?.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {member.profile?.name || 'Sin nombre'}
                                    {isMe && <span className="text-muted-foreground ml-2">(tú)</span>}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const isSystemRole = ['owner', 'admin', 'manager', 'member', 'read_only'].includes(member.role);
                                const customRole = !isSystemRole ? customRoles.find(r => r.name === member.role || r.id === member.role.replace('custom:', '')) : null;
                                const label = isSystemRole ? systemRoleLabels[member.role] : (customRole?.name || member.role);
                                const variant = isSystemRole ? roleBadgeVariants[member.role] : 'secondary';
                                return (
                                  <Badge variant={variant}>
                                    {member.role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
                                    {!isSystemRole && <Shield className="h-3 w-3 mr-1" />}
                                    {label}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={member.status === 'active' ? 'outline' : 'destructive'}>
                                {member.status === 'active' ? 'Activo' : 'Suspendido'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(member.created_at), 'PP', { locale: es })}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={isUpdating}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canChangeRole && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setChangeRoleDialog({
                                          memberId: member.id,
                                          currentRole: member.role as OrgRole,
                                          userId: member.user_id,
                                        });
                                        setNewRole(member.role as OrgRole);
                                      }}
                                    >
                                      Cambiar rol
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => setPermissionsDialog({
                                      userId: member.user_id,
                                      userName: member.profile?.name || 'Usuario',
                                    })}
                                  >
                                    <Settings className="h-4 w-4 mr-2" />
                                    Gestionar permisos
                                  </DropdownMenuItem>
                                  {!isMe && (
                                    <DropdownMenuItem
                                      onClick={() => setResetPasswordDialog({
                                        userId: member.user_id,
                                        userName: member.profile?.name || 'Usuario',
                                      })}
                                    >
                                      <Key className="h-4 w-4 mr-2" />
                                      Cambiar contraseña
                                    </DropdownMenuItem>
                                  )}
                                  {canSuspend && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleToggleStatus(member.id, member.status as 'active' | 'suspended')}
                                      >
                                        {member.status === 'active' ? 'Suspender' : 'Reactivar'}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canRemove && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => handleRemoveMember(member.id)}
                                      >
                                        Eliminar de la organización
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="roles" className="mt-6">
            <RoleEditor />
          </TabsContent>

          <TabsContent value="defaults" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Permisos por defecto por rol del sistema</CardTitle>
                <CardDescription>
                  Estos son los permisos predeterminados para los roles del sistema. Los overrides individuales tienen prioridad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RolePermissionsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="effective" className="mt-6">
            <EffectivePermissionsView />
          </TabsContent>
        </Tabs>

        {/* Change Role Dialog */}
        <Dialog open={!!changeRoleDialog} onOpenChange={() => setChangeRoleDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cambiar rol</DialogTitle>
              <DialogDescription>
                Selecciona el nuevo rol para este miembro
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={newRole} onValueChange={(v) => setNewRole(v as OrgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner" disabled={!isOwner}>Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Miembro</SelectItem>
                  <SelectItem value="read_only">Solo lectura</SelectItem>
                  {customRoles.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Roles personalizados
                      </div>
                      {customRoles.map(role => (
                        <SelectItem key={role.id} value={`custom:${role.id}`}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setChangeRoleDialog(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleChangeRole} disabled={isUpdating}>
                  {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permissions Editor Dialog */}
        <Dialog open={!!permissionsDialog} onOpenChange={() => setPermissionsDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Permisos de {permissionsDialog?.userName}</DialogTitle>
              <DialogDescription>
                Gestiona los permisos individuales. Los overrides tienen prioridad sobre los permisos del rol.
              </DialogDescription>
            </DialogHeader>
            {permissionsDialog && (
              <MemberPermissionsEditor
                userId={permissionsDialog.userId}
                memberRole={members.find(m => m.user_id === permissionsDialog.userId)?.role as OrgRole}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <CreateUserDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />

        {/* Reset Member Password Dialog */}
        <ResetMemberPasswordDialog
          open={!!resetPasswordDialog}
          onOpenChange={(open) => { if (!open) setResetPasswordDialog(null); }}
          memberName={resetPasswordDialog?.userName || ''}
          onConfirm={(newPassword) => {
            if (resetPasswordDialog) {
              resetMemberPassword(
                { targetUserId: resetPasswordDialog.userId, newPassword },
                { onSuccess: () => setResetPasswordDialog(null) }
              );
            }
          }}
          isLoading={isResettingPassword}
        />
      </div>
    </AppLayout>
  );
}

const RolePermissionsTable = React.forwardRef<HTMLDivElement>(function RolePermissionsTable(_props, ref) {
  const { rolePermissions, isLoading, toggleRolePermission, isUpdating } = useRolePermissions();
  const { customRoles, updateRoleAsync, isUpdating: isUpdatingCustom } = useCustomRoles();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build column list: system roles with custom roles inserted between manager and member
  type ColDef = { key: string; label: string; isSystem: boolean; isOwner: boolean; customRole?: any };
  const columns: ColDef[] = [
    { key: 'owner', label: 'Owner', isSystem: true, isOwner: true },
    { key: 'admin', label: 'Admin', isSystem: true, isOwner: false },
    { key: 'manager', label: 'Manager', isSystem: true, isOwner: false },
    // Custom roles go here
    ...customRoles.map(cr => ({
      key: `custom:${cr.id}`,
      label: cr.name,
      isSystem: false,
      isOwner: false,
      customRole: cr,
    })),
    { key: 'member', label: 'Miembro', isSystem: true, isOwner: false },
    { key: 'read_only', label: 'Solo lectura', isSystem: true, isOwner: false },
  ];

  const getPermissionValue = (col: ColDef, permissionKey: string): boolean => {
    if (col.isSystem) {
      // System role: check role_permissions table, fall back to shared defaults
      const perm = rolePermissions.find(rp => rp.role === col.key && rp.permission_key === permissionKey);
      if (perm) return perm.enabled;
      return getDefaultPermissionsForRoleFn(col.key as OrgRole)[permissionKey] ?? false;
    } else {
      // Custom role: read from permissions_json (flattened)
      const cr = col.customRole;
      if (!cr?.permissions_json) return false;
      const flat = flattenCustomRolePermissionsFn(cr.permissions_json as Record<string, any>);
      return flat[permissionKey] ?? false;
    }
  };

  const handleToggle = async (col: ColDef, permissionKey: string, currentValue: boolean) => {
    if (col.isOwner) {
      toast({
        title: "No permitido",
        description: "Los permisos del Owner no pueden ser modificados.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (col.isSystem) {
        await toggleRolePermission(col.key, permissionKey, currentValue);
      } else {
        // Custom role: update permissions_json
        const cr = col.customRole;
        const pj = { ...(cr.permissions_json || {}) } as Record<string, any>;
        // permissionKey is like "schedules.view" → category="schedules", action="view"
        const [category, action] = permissionKey.split('.');
        if (!pj[category]) pj[category] = {};
        pj[category] = { ...pj[category], [action]: !currentValue };
        await updateRoleAsync({ id: cr.id, permissions: pj as any });
      }
      toast({
        title: "Permiso actualizado",
        description: `El permiso ha sido ${!currentValue ? 'activado' : 'desactivado'}.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el permiso.",
        variant: "destructive"
      });
    }
  };

  const isBusy = isUpdating || isUpdatingCustom;

  return (
    <Accordion type="multiple" defaultValue={PERMISSION_CATEGORIES_DEF.map(c => c.id)} className="space-y-2">
      {PERMISSION_CATEGORIES_DEF.map((category) => {
        const Icon = category.icon;

        return (
          <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-2">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{category.label}</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {category.permissions.length} permisos
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%] min-w-[200px]">Permiso</TableHead>
                      {columns.map(col => (
                        <TableHead key={col.key} className="text-center min-w-[80px]">
                          <span className={col.isSystem ? '' : 'text-blue-600 font-semibold'}>
                            {col.label}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.permissions.map(perm => (
                      <TableRow key={perm.key}>
                        <TableCell>
                          <div>
                            <span className="font-medium text-sm">{perm.label}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                          </div>
                        </TableCell>
                        {columns.map(col => {
                          const isEnabled = getPermissionValue(col, perm.key);
                          return (
                            <TableCell key={col.key} className="text-center">
                              <button
                                onClick={() => handleToggle(col, perm.key, isEnabled)}
                                disabled={isBusy || col.isOwner}
                                className={`transition-opacity ${col.isOwner ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:opacity-80'}`}
                                title={col.isOwner ? 'Los permisos del Owner no pueden ser modificados' : 'Click para cambiar'}
                              >
                                {isEnabled ? (
                                  <Badge variant="default" className="bg-green-500">✓</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">✗</Badge>
                                )}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
});

// Re-export for the import
import { useRolePermissions } from '@/hooks/usePermissions';
import { flattenCustomRolePermissions as flattenCustomRolePermissionsFn } from '@shared/permissionDefaults';
