import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from './SuperAdminLayout';
import { usePlatformUsers } from '@/hooks/useSuperAdmin';
import { useSuperAdminActions } from '@/hooks/useSuperAdminActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Users, User, MoreHorizontal, Building2, UserCog, Ban, CheckCircle, UserMinus, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DeleteMemberDialog } from '@/components/super-admin/DeleteMemberDialog';
import { ChangeMemberRoleDialog } from '@/components/super-admin/ChangeMemberRoleDialog';
import { AddUserToOrgDialog } from '@/components/super-admin/AddUserToOrgDialog';

export default function UsersPage() {
  const navigate = useNavigate();
  const { data: users, isLoading } = usePlatformUsers();
  const { updateMemberRole, updateMemberStatus, deleteMember, addMemberToOrg } = useSuperAdminActions();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [deleteMemberData, setDeleteMemberData] = useState<{ id: string; name: string; orgName: string } | null>(null);
  const [changeRoleData, setChangeRoleData] = useState<{ id: string; name: string; role: string } | null>(null);
  const [addToOrgData, setAddToOrgData] = useState<{ userId: string; name: string } | null>(null);

  const filteredUsers = users?.filter((user: any) => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.organization_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  }) || [];

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      owner: 'default',
      admin: 'default',
      manager: 'secondary',
      member: 'outline',
    };
    return <Badge variant={variants[role] || 'outline'}>{role}</Badge>;
  };

  const handleDeleteConfirm = () => {
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

  const handleToggleStatus = (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    updateMemberStatus.mutate({ memberId, status: newStatus as 'active' | 'suspended' });
  };

  return (
    <SuperAdminLayout title="Usuarios Globales">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  Todos los Usuarios
                </CardTitle>
                <CardDescription className="mt-2">
                  Lista global de todos los usuarios del SaaS
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{users?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuario u organización..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="suspended">Suspendidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No se encontraron usuarios
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Usuario</TableHead>
                      <TableHead>Organización</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Miembro desde</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user: any) => (
                      <TableRow key={user.member_id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
                              {(user.name || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <p>{user.name || 'Sin nombre'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => navigate(`/super-admin/organizations/${user.organization_id}`)}
                          >
                            <Building2 className="h-3 w-3 mr-1" />
                            {user.organization_name || 'Sin org'}
                          </Button>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/super-admin/users/${user.user_id}`)}>
                                <User className="h-4 w-4 mr-2" />
                                Ver detalle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/super-admin/organizations/${user.organization_id}`)}>
                                <Building2 className="h-4 w-4 mr-2" />
                                Ver organización
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAddToOrgData({
                                userId: user.user_id,
                                name: user.name || 'Usuario'
                              })}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Añadir a otra org
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setChangeRoleData({
                                id: user.member_id,
                                name: user.name || 'Usuario',
                                role: user.role
                              })}>
                                <UserCog className="h-4 w-4 mr-2" />
                                Cambiar rol
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(user.member_id, user.status)}>
                                {user.status === 'suspended' ? (
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
                                  id: user.member_id,
                                  name: user.name || 'Usuario',
                                  orgName: user.organization_name || 'Organización'
                                })}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Eliminar de org
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
      </div>

      {/* Dialogs */}
      <DeleteMemberDialog
        open={!!deleteMemberData}
        onOpenChange={(open) => !open && setDeleteMemberData(null)}
        memberName={deleteMemberData?.name || ''}
        orgName={deleteMemberData?.orgName || ''}
        onConfirm={handleDeleteConfirm}
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

      <AddUserToOrgDialog
        open={!!addToOrgData}
        onOpenChange={(open) => !open && setAddToOrgData(null)}
        userId={addToOrgData?.userId || ''}
        userName={addToOrgData?.name || ''}
        onConfirm={(organizationId, orgName, role) => {
          addMemberToOrg.mutate(
            {
              userId: addToOrgData!.userId,
              organizationId,
              role,
              userName: addToOrgData!.name,
              orgName,
            },
            { onSuccess: () => setAddToOrgData(null) }
          );
        }}
        isLoading={addMemberToOrg.isPending}
      />
    </SuperAdminLayout>
  );
}
