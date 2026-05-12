import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from './SuperAdminLayout';
import { useOrganizationDetails } from '@/hooks/useSuperAdmin';
import { useSuperAdminActions } from '@/hooks/useSuperAdminActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft, Building2, Users, ListTodo, FolderKanban, MessageSquare, 
  CreditCard, MoreHorizontal, UserCog, Ban, CheckCircle, UserMinus, Trash2, Settings, UserPlus 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DeleteMemberDialog } from '@/components/super-admin/DeleteMemberDialog';
import { ChangeMemberRoleDialog } from '@/components/super-admin/ChangeMemberRoleDialog';
import { SuspendOrgDialog } from '@/components/super-admin/SuspendOrgDialog';
import { DeleteOrgDialog } from '@/components/super-admin/DeleteOrgDialog';
import { ChangePlanDialog } from '@/components/super-admin/ChangePlanDialog';
import { OrgModulesSection } from '@/components/super-admin/OrgModulesSection';
import { OrgPresetSection } from '@/components/super-admin/OrgPresetSection';
import { ModuleHistorySection } from '@/components/super-admin/ModuleHistorySection';
import { OrgFeatureFlagsSection } from '@/components/super-admin/OrgFeatureFlagsSection';
import { AddMemberDialog } from '@/components/super-admin/AddMemberDialog';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: org, isLoading } = useOrganizationDetails(id);
  const { 
    addMemberToOrg, updateMemberRole, updateMemberStatus, deleteMember,
    updateOrgStatus, deleteOrganization, updateOrgPlan 
  } = useSuperAdminActions();

  // Dialog states
  const [deleteMemberData, setDeleteMemberData] = useState<{ id: string; name: string } | null>(null);
  const [changeRoleData, setChangeRoleData] = useState<{ id: string; name: string; role: string } | null>(null);
  const [showSuspendOrg, setShowSuspendOrg] = useState(false);
  const [showDeleteOrg, setShowDeleteOrg] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  if (isLoading) {
    return (
      <SuperAdminLayout title="Cargando...">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </SuperAdminLayout>
    );
  }

  if (!org) {
    return (
      <SuperAdminLayout title="Organización no encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No se encontró la organización</p>
          <Button onClick={() => navigate('/super-admin/organizations')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </SuperAdminLayout>
    );
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      owner: 'default',
      admin: 'default',
      manager: 'secondary',
      member: 'outline',
    };
    return <Badge variant={variants[role] || 'outline'}>{role}</Badge>;
  };

  const handleDeleteMemberConfirm = () => {
    if (deleteMemberData) {
      deleteMember.mutate(
        { memberId: deleteMemberData.id, memberName: deleteMemberData.name },
        { onSuccess: () => setDeleteMemberData(null) }
      );
    }
  };

  const handleChangeRoleConfirm = (newRole: string) => {
    if (changeRoleData) {
      updateMemberRole.mutate(
        { memberId: changeRoleData.id, newRole },
        { onSuccess: () => setChangeRoleData(null) }
      );
    }
  };

  const handleToggleMemberStatus = (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    updateMemberStatus.mutate({ memberId, status: newStatus as 'active' | 'suspended' });
  };

  const handleSuspendOrgConfirm = () => {
    const newStatus = (org as any).status === 'suspended' ? 'active' : 'suspended';
    updateOrgStatus.mutate(
      { orgId: org.id, status: newStatus as 'active' | 'suspended' },
      { onSuccess: () => setShowSuspendOrg(false) }
    );
  };

  const handleDeleteOrgConfirm = () => {
    deleteOrganization.mutate(
      { orgId: org.id, orgName: org.name },
      { onSuccess: () => navigate('/super-admin/organizations') }
    );
  };

  const handleChangePlanConfirm = (newPlan: string) => {
    updateOrgPlan.mutate(
      { orgId: org.id, plan: newPlan },
      { onSuccess: () => setShowChangePlan(false) }
    );
  };

  return (
    <SuperAdminLayout title={org.name}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/super-admin/organizations')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Organizaciones
        </Button>

        {/* Header Card with Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{org.name}</CardTitle>
                  <CardDescription>
                    Creada el {format(new Date(org.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={org.subscription?.plan === 'free' ? 'secondary' : 'default'}
                  className="text-lg px-4 py-1"
                >
                  {org.subscription?.plan?.toUpperCase() || 'FREE'}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowChangePlan(true)}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Cambiar plan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowSuspendOrg(true)}>
                      {(org as any).status === 'suspended' ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          <span className="text-green-600">Reactivar organización</span>
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4 mr-2 text-orange-600" />
                          <span className="text-orange-600">Suspender organización</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteOrg(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar organización
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Miembros</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{org.members.length}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tareas</CardTitle>
              <ListTodo className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{org.taskCount}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Áreas</CardTitle>
              <FolderKanban className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{org.areaCount}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Feedback</CardTitle>
              <MessageSquare className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{org.feedback.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Suscripción
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-medium">{org.subscription?.plan?.toUpperCase() || 'FREE'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-medium">{org.subscription?.status || 'active'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Intervalo</p>
                <p className="font-medium">{org.subscription?.billing_interval || 'N/A'}</p>
              </div>
              {org.subscription?.current_period_end && (
                <div>
                  <p className="text-sm text-muted-foreground">Próxima facturación</p>
                  <p className="font-medium">
                    {format(new Date(org.subscription.current_period_end), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
              )}
              {org.subscription?.stripe_customer_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Stripe Customer ID</p>
                  <p className="font-mono text-xs">{org.subscription.stripe_customer_id}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members Table with Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Miembros ({org.members.length})
                </CardTitle>
                <CardDescription>Gestiona los miembros de esta organización</CardDescription>
              </div>
              <Button onClick={() => setShowAddMember(true)} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Añadir miembro
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {org.members.length === 0 ? (
              <p className="text-muted-foreground">No hay miembros</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Usuario</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {org.members.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                              {(member.profiles?.name || 'U')[0].toUpperCase()}
                            </div>
                            {member.profiles?.name || 'Sin nombre'}
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(member.role)}</TableCell>
                        <TableCell>
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(member.created_at), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setChangeRoleData({
                                id: member.id,
                                name: member.profiles?.name || 'Usuario',
                                role: member.role
                              })}>
                                <UserCog className="h-4 w-4 mr-2" />
                                Cambiar rol
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleMemberStatus(member.id, member.status)}>
                                {member.status === 'suspended' ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                    <span className="text-green-600">Reactivar</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-4 w-4 mr-2 text-orange-600" />
                                    <span className="text-orange-600">Suspender</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setDeleteMemberData({
                                  id: member.id,
                                  name: member.profiles?.name || 'Usuario'
                                })}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preset Section */}
        <OrgPresetSection 
          organizationId={org.id} 
          organizationName={org.name}
          currentModules={org.modules || {}}
        />

        {/* Modules Section */}
        <OrgModulesSection organizationId={org.id} />

        {/* Feature Flags Section */}
        <OrgFeatureFlagsSection 
          organizationId={org.id} 
          organizationName={org.name}
        />

        {/* Module History */}
        <ModuleHistorySection organizationId={org.id} />

        {org.feedback.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Feedback Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {org.feedback.map((fb: any) => (
                  <div key={fb.id} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={
                        fb.feedback_type === 'bug' ? 'destructive' :
                        fb.feedback_type === 'suggestion' ? 'default' : 'secondary'
                      }>
                        {fb.feedback_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(fb.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    <p className="text-sm">{fb.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <DeleteMemberDialog
        open={!!deleteMemberData}
        onOpenChange={(open) => !open && setDeleteMemberData(null)}
        memberName={deleteMemberData?.name || ''}
        orgName={org.name}
        onConfirm={handleDeleteMemberConfirm}
        isLoading={deleteMember.isPending}
      />

      <ChangeMemberRoleDialog
        open={!!changeRoleData}
        onOpenChange={(open) => !open && setChangeRoleData(null)}
        memberName={changeRoleData?.name || ''}
        currentRole={changeRoleData?.role || 'member'}
        onConfirm={handleChangeRoleConfirm}
        isLoading={updateMemberRole.isPending}
      />

      <SuspendOrgDialog
        open={showSuspendOrg}
        onOpenChange={setShowSuspendOrg}
        orgName={org.name}
        currentStatus={(org as any).status || 'active'}
        onConfirm={handleSuspendOrgConfirm}
        isLoading={updateOrgStatus.isPending}
      />

      <DeleteOrgDialog
        open={showDeleteOrg}
        onOpenChange={setShowDeleteOrg}
        orgName={org.name}
        onConfirm={handleDeleteOrgConfirm}
        isLoading={deleteOrganization.isPending}
      />

      <ChangePlanDialog
        open={showChangePlan}
        onOpenChange={setShowChangePlan}
        orgName={org.name}
        currentPlan={org.subscription?.plan || 'free'}
        onConfirm={handleChangePlanConfirm}
        isLoading={updateOrgPlan.isPending}
      />

      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        organizationId={org.id}
        orgName={org.name}
        existingMemberIds={org.members.map((m: any) => m.user_id)}
        onConfirm={(userId, userName, role) => {
          addMemberToOrg.mutate(
            { userId, organizationId: org.id, role, userName, orgName: org.name },
            { onSuccess: () => setShowAddMember(false) }
          );
        }}
        isLoading={addMemberToOrg.isPending}
      />
    </SuperAdminLayout>
  );
}
