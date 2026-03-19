import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from './SuperAdminLayout';
import { usePlatformOrganizations } from '@/hooks/useSuperAdmin';
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
import { Search, Eye, Building2, MoreHorizontal, Ban, CheckCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SuspendOrgDialog } from '@/components/super-admin/SuspendOrgDialog';
import { DeleteOrgDialog } from '@/components/super-admin/DeleteOrgDialog';
import { normalizeSubscriptionStatus } from '@/lib/billing';

export default function Organizations() {
  const navigate = useNavigate();
  const { data: organizations, isLoading } = usePlatformOrganizations();
  const { updateOrgStatus, deleteOrganization } = useSuperAdminActions();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog states
  const [suspendOrg, setSuspendOrg] = useState<{ id: string; name: string; status: string } | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<{ id: string; name: string } | null>(null);

  const filteredOrgs = organizations?.filter((org) => {
    const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = planFilter === 'all' || org.subscription?.plan === planFilter;
    const matchesStatus = statusFilter === 'all' || (org as any).status === statusFilter || 
      (statusFilter === 'active' && !(org as any).status);
    return matchesSearch && matchesPlan && matchesStatus;
  }) || [];

  const getSubscriptionStatusBadge = (status: string | undefined) => {
    switch (normalizeSubscriptionStatus(status)) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Activo</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Pago pendiente</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">Sin suscripción</Badge>;
    }
  };

  const getOrgStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'suspended':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Suspendida</Badge>;
      case 'deleted':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Eliminada</Badge>;
      default:
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Activa</Badge>;
    }
  };

  const handleSuspendConfirm = () => {
    if (suspendOrg) {
      const newStatus = suspendOrg.status === 'suspended' ? 'active' : 'suspended';
      updateOrgStatus.mutate(
        { orgId: suspendOrg.id, status: newStatus as 'active' | 'suspended' },
        { onSuccess: () => setSuspendOrg(null) }
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteOrg) {
      deleteOrganization.mutate(
        { orgId: deleteOrg.id, orgName: deleteOrg.name },
        { onSuccess: () => {
          setDeleteOrg(null);
          navigate('/super-admin/organizations');
        }}
      );
    }
  };

  return (
    <SuperAdminLayout title="Organizaciones">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  Todas las Organizaciones
                </CardTitle>
                <CardDescription className="mt-2">
                  Gestiona y visualiza todas las organizaciones del SaaS
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{organizations?.length || 0}</p>
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
                  placeholder="Buscar organización..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="suspended">Suspendidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No se encontraron organizaciones
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Organización</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Estado Org</TableHead>
                      <TableHead>Suscripción</TableHead>
                      <TableHead>Miembros</TableHead>
                      <TableHead>Creada</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgs.map((org) => (
                      <TableRow key={org.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            {org.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={org.subscription?.plan === 'free' ? 'secondary' : 'default'}>
                            {org.subscription?.plan?.toUpperCase() || 'FREE'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getOrgStatusBadge((org as any).status)}</TableCell>
                        <TableCell>{getSubscriptionStatusBadge(org.subscription?.status)}</TableCell>
                        <TableCell>{org.memberCount}</TableCell>
                        <TableCell>
                          {format(new Date(org.created_at), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/super-admin/organizations/${org.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setSuspendOrg({ 
                                  id: org.id, 
                                  name: org.name, 
                                  status: (org as any).status || 'active' 
                                })}
                              >
                                {(org as any).status === 'suspended' ? (
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
                              <DropdownMenuItem 
                                onClick={() => setDeleteOrg({ id: org.id, name: org.name })}
                                className="text-destructive focus:text-destructive"
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <SuspendOrgDialog
        open={!!suspendOrg}
        onOpenChange={(open) => !open && setSuspendOrg(null)}
        orgName={suspendOrg?.name || ''}
        currentStatus={suspendOrg?.status || 'active'}
        onConfirm={handleSuspendConfirm}
        isLoading={updateOrgStatus.isPending}
      />

      <DeleteOrgDialog
        open={!!deleteOrg}
        onOpenChange={(open) => !open && setDeleteOrg(null)}
        orgName={deleteOrg?.name || ''}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteOrganization.isPending}
      />
    </SuperAdminLayout>
  );
}
