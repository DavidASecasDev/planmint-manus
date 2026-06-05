import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SuperAdminLayout } from './SuperAdminLayout';
import { apiInvoke } from '@/lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, User, Mail, Calendar, Building2, Shield, Clock,
  CheckCircle, XCircle, AlertCircle, Activity, Key, ChevronRight,
  Trash2, KeyRound
} from 'lucide-react';
import { useSuperAdminActions } from '@/hooks/useSuperAdminActions';
import { ResetPasswordDialog } from '@/components/super-admin/ResetPasswordDialog';
import { DeleteUserDialog } from '@/components/super-admin/DeleteUserDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ROLE_LABELS } from '@/lib/roleHierarchy';
import { PERMISSION_LABELS } from '@/types/enterprise';

// ─── Types ──────────────────────────────────────────────────────────────────
interface UserDetailData {
  profile: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    role: string;
    theme_pref: string;
    organization_id: string | null;
    created_at: string;
    email: string | null;
  };
  memberships: Array<{
    id: string;
    organization_id: string;
    role: string;
    status: string;
    created_at: string;
    updated_at: string;
    organization: { id: string; name: string; status: string } | null;
  }>;
  userPermissions: Array<{
    id: string;
    organization_id: string;
    permission_key: string;
    enabled: boolean;
    created_at: string;
  }>;
  rolePermissions: Record<string, Array<{ permission_key: string; enabled: boolean }>>;
  recentActivity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    actor_role: string | null;
    created_at: string;
    organization_id: string;
    metadata_json: unknown;
    organization: { name: string } | null;
  }>;
}

// ─── Action labels (reused from AuditLogs) ──────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  'create.member': 'Miembro añadido',
  'update.member_role': 'Rol cambiado',
  'update.member_reactivated': 'Miembro reactivado',
  'update.member_suspended': 'Miembro suspendido',
  'delete.member': 'Miembro eliminado',
  'update.org_status': 'Estado org. cambiado',
  'delete.organization': 'Organización eliminada',
  'update.org_plan': 'Plan cambiado',
  'update.feedback': 'Feedback actualizado',
  'delete.feedback': 'Feedback eliminado',
  'delete.task': 'Tarea eliminada',
  'delete.area': 'Área eliminada',
  'invitation.created': 'Invitación creada',
  'invitation.revoked': 'Invitación revocada',
  'invitation.accepted': 'Invitación aceptada',
  'invitation.expired': 'Invitación expirada',
  'invitation.resent': 'Invitación reenviada',
  'org.delete_requested': 'Eliminación solicitada',
  'org.created': 'Organización creada',
  'org.updated': 'Organización actualizada',
  'feature_flag.toggle': 'Feature flag cambiado',
  'module_toggle': 'Módulo cambiado',
  'preset_apply': 'Preset aplicado',
  'sync_vehicles': 'Sincronización de vehículos',
  'create': 'Creación',
  'update': 'Actualización',
  'delete': 'Eliminación',
  'view': 'Visualización',
};

const ENTITY_LABELS: Record<string, string> = {
  organization_member: 'Miembro',
  organization: 'Organización',
  subscription: 'Suscripción',
  user_feedback: 'Feedback',
  task: 'Tarea',
  area: 'Área',
  organization_invitation: 'Invitación',
  feature_flag: 'Feature Flag',
  vehicle: 'Vehículo',
  module: 'Módulo',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: 'Activo', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
  suspended: { label: 'Suspendido', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
  pending: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: AlertCircle },
};

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito',
  STARTER: 'Starter',
  TEAM: 'Team',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
};

// ─── Module labels for permission categories ────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
  tasks: 'Tareas',
  areas: 'Áreas',
  tags: 'Etiquetas',
  automations: 'Automatizaciones',
  integrations: 'Integraciones',
  billing: 'Facturación',
  audit_logs: 'Auditoría',
  templates: 'Plantillas',
  team: 'Equipo',
  reports: 'Reportes',
  reservations: 'Reservas',
  garatech: 'Garatech',
  transfers: 'Transfers',
  forms: 'Formularios',
  vehicles: 'Vehículos',
  time_tracking: 'Fichajes',
  movements: 'Movimientos',
  daily_tasks: 'Tareas diarias',
  fleet: 'Flota',
  members: 'Miembros',
  security: 'Seguridad',
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function UserDetail() {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('memberships');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const { resetUserPassword, deleteUser } = useSuperAdminActions();

  const { data: userData, isLoading } = useQuery({
    queryKey: ['super-admin-user-detail', userId],
    queryFn: async () => {
      const res = await apiInvoke<{ data: UserDetailData; error: null }>('super-admin/get-user-detail', {
        body: { userId },
      });
      if (res.error) throw new Error(res.error.message);
      // apiInvoke wraps the response body, so res.data is { data: {...}, error: null }
      const inner = (res.data as any)?.data || res.data;
      return inner as UserDetailData;
    },
    enabled: !!userId,
  });

  // ─── Compute effective permissions per org ──────────────────────────────
  const effectivePermissions = useMemo(() => {
    if (!userData) return {};
    const result: Record<string, Record<string, boolean>> = {};

    for (const membership of userData.memberships) {
      const orgId = membership.organization_id;
      const rolePerms = userData.rolePermissions[membership.role] || [];
      const permsMap: Record<string, boolean> = {};

      // Start with role defaults
      for (const rp of rolePerms) {
        permsMap[rp.permission_key] = rp.enabled;
      }

      // Apply user-level overrides
      const userOverrides = userData.userPermissions.filter(
        (up) => up.organization_id === orgId
      );
      for (const override of userOverrides) {
        permsMap[override.permission_key] = override.enabled;
      }

      result[orgId] = permsMap;
    }
    return result;
  }, [userData]);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SuperAdminLayout title="Detalle de usuario">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </SuperAdminLayout>
    );
  }

  if (!userData) {
    return (
      <SuperAdminLayout title="Detalle de usuario">
        <div className="text-center py-12 text-muted-foreground">
          No se encontró el usuario
        </div>
      </SuperAdminLayout>
    );
  }

  const { profile, memberships, recentActivity } = userData;

  return (
    <SuperAdminLayout title={`Usuario: ${profile.name || 'Sin nombre'}`}>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a usuarios
        </Button>

        {/* Profile header card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
                {(profile.name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold">{profile.name || 'Sin nombre'}</h2>
                  {profile.email && (
                    <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Mail className="h-4 w-4" />
                      {profile.email}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    Rol global: <Badge variant="outline" className="ml-1">{profile.role}</Badge>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Registrado: {format(new Date(profile.created_at), "d MMM yyyy", { locale: es })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {memberships.length} organización{memberships.length !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <p className="text-xs text-muted-foreground">ID: {profile.id.slice(0, 8)}...</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResetPassword(true)}
                  >
                    <KeyRound className="h-4 w-4 mr-1" />
                    Cambiar contraseña
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteUser(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar usuario
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="memberships" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Membresías ({memberships.length})
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Permisos
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Actividad ({recentActivity.length})
            </TabsTrigger>
          </TabsList>

          {/* ─── Memberships tab ─────────────────────────────────────────── */}
          <TabsContent value="memberships" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Organizaciones</CardTitle>
                <CardDescription>
                  Todas las organizaciones a las que pertenece este usuario
                </CardDescription>
              </CardHeader>
              <CardContent>
                {memberships.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Este usuario no pertenece a ninguna organización
                  </p>
                ) : (
                  <div className="space-y-3">
                    {memberships.map((m) => {
                      const statusCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending;
                      const StatusIcon = statusCfg.icon;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{m.organization?.name || 'Sin nombre'}</p>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                                <span>Estado: {m.organization?.status || '—'}</span>
                                <span>·</span>
                                <span>Desde {format(new Date(m.created_at), "d MMM yyyy", { locale: es })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">
                              {ROLE_LABELS[m.role] || m.role}
                            </Badge>
                            <Badge variant="outline" className={statusCfg.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusCfg.label}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/super-admin/organizations/${m.organization_id}`)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Permissions tab ─────────────────────────────────────────── */}
          <TabsContent value="permissions" className="space-y-4">
            {memberships.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Sin membresías — no hay permisos que mostrar
                </CardContent>
              </Card>
            ) : (
              memberships.map((m) => {
                const orgPerms = effectivePermissions[m.organization_id] || {};
                const userOverrides = userData.userPermissions.filter(
                  (up) => up.organization_id === m.organization_id
                );
                const overrideKeys = new Set(userOverrides.map((o) => o.permission_key));

                // Group permissions by module
                const groupedPerms: Record<string, Array<{ key: string; action: string; enabled: boolean; isOverride: boolean }>> = {};
                for (const [fullKey, enabled] of Object.entries(orgPerms)) {
                  const parts = fullKey.split('.');
                  const module = parts[0];
                  const action = parts.slice(1).join('.');
                  if (!groupedPerms[module]) groupedPerms[module] = [];
                  groupedPerms[module].push({
                    key: fullKey,
                    action,
                    enabled,
                    isOverride: overrideKeys.has(fullKey),
                  });
                }

                return (
                  <Card key={m.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {m.organization?.name || 'Sin nombre'}
                          </CardTitle>
                          <CardDescription>
                            Rol: <strong>{ROLE_LABELS[m.role] || m.role}</strong>
                            {userOverrides.length > 0 && (
                              <span className="ml-2 text-amber-600">
                                · {userOverrides.length} permiso{userOverrides.length !== 1 ? 's' : ''} personalizado{userOverrides.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/super-admin/organizations/${m.organization_id}`)}
                        >
                          Ver org
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(groupedPerms).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No hay permisos configurados para el rol "{ROLE_LABELS[m.role] || m.role}"
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {Object.entries(groupedPerms)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([module, perms]) => (
                              <div key={module} className="border rounded-lg p-3">
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-1.5">
                                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                  {MODULE_LABELS[module] || module}
                                </h4>
                                <div className="space-y-1">
                                  {perms
                                    .sort((a, b) => a.action.localeCompare(b.action))
                                    .map((perm) => {
                                      const label =
                                        PERMISSION_LABELS[module]?.[perm.action] || perm.action;
                                      return (
                                        <TooltipProvider key={perm.key}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div
                                                className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                                                  perm.isOverride
                                                    ? 'bg-amber-500/5 border border-amber-500/20'
                                                    : ''
                                                }`}
                                              >
                                                <span className="flex items-center gap-1.5">
                                                  {perm.isOverride && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                  )}
                                                  {label}
                                                </span>
                                                {perm.enabled ? (
                                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                                ) : (
                                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                                )}
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                {perm.key}: {perm.enabled ? 'Habilitado' : 'Deshabilitado'}
                                                {perm.isOverride ? ' (personalizado)' : ' (por rol)'}
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      );
                                    })}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ─── Activity tab ────────────────────────────────────────────── */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actividad reciente</CardTitle>
                <CardDescription>
                  Últimas 50 acciones realizadas por este usuario
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No hay actividad registrada para este usuario
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Fecha</TableHead>
                          <TableHead>Organización</TableHead>
                          <TableHead>Acción</TableHead>
                          <TableHead>Entidad</TableHead>
                          <TableHead>Rol</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentActivity.map((log) => (
                          <TableRow key={log.id} className="hover:bg-muted/30">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: es })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {log.organization ? (
                                <Button
                                  variant="link"
                                  className="p-0 h-auto text-xs"
                                  onClick={() => navigate(`/super-admin/organizations/${log.organization_id}`)}
                                >
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {typeof log.organization === 'object' && log.organization !== null
                                    ? (log.organization as any).name || '—'
                                    : '—'}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {ACTION_LABELS[log.action] || log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {ENTITY_LABELS[log.entity_type] || log.entity_type}
                              {log.entity_id && (
                                <span className="text-muted-foreground ml-1">
                                  ({log.entity_id.slice(0, 8)}...)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {log.actor_role === 'super_admin' ? (
                                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
                                    Super Admin
                                  </Badge>
                                ) : (
                                  ROLE_LABELS[log.actor_role || ''] || log.actor_role || '—'
                                )}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={showResetPassword}
        onOpenChange={setShowResetPassword}
        userName={profile.name || profile.email || 'Usuario'}
        onConfirm={(newPassword) => {
          resetUserPassword.mutate(
            { userId: profile.id, newPassword },
            { onSuccess: () => setShowResetPassword(false) }
          );
        }}
        isLoading={resetUserPassword.isPending}
      />

      {/* Delete User Dialog */}
      <DeleteUserDialog
        open={showDeleteUser}
        onOpenChange={setShowDeleteUser}
        userName={profile.name || 'Sin nombre'}
        userEmail={profile.email || ''}
        onConfirm={() => {
          deleteUser.mutate(
            { userId: profile.id },
            { onSuccess: () => navigate('/super-admin/users') }
          );
        }}
        isLoading={deleteUser.isPending}
      />
    </SuperAdminLayout>
  );
}
