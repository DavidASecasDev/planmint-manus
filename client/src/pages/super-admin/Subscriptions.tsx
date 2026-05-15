import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from './SuperAdminLayout';
import { usePlatformOrganizations, usePlatformStats } from '@/hooks/useSuperAdmin';
import { supabase } from '@/integrations/supabase/client';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, ExternalLink, MoreHorizontal, RefreshCw, Search, TrendingUp, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { normalizeSubscriptionStatus } from '@/lib/billing';
import { toast } from 'sonner';

export default function Subscriptions() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: organizations, isLoading: orgsLoading, refetch: refetchOrgs } = usePlatformOrganizations();

  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openingPortalOrgId, setOpeningPortalOrgId] = useState<string | null>(null);
  const [syncingOrgId, setSyncingOrgId] = useState<string | null>(null);

  const handleOpenOrgCustomerPortal = async (organizationId: string) => {
    setOpeningPortalOrgId(organizationId);
    try {
      const { data, error } = await supabase.functions.invoke('superadmin-customer-portal', {
        body: { organization_id: organizationId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No se pudo obtener la URL del portal');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al abrir el portal del cliente';
      console.error('superadmin-customer-portal error:', err);
      toast.error(msg);
    } finally {
      setOpeningPortalOrgId(null);
    }
  };

  const handleSyncSubscription = async (organizationId: string) => {
    setSyncingOrgId(organizationId);
    try {
      const { data, error } = await supabase.functions.invoke('superadmin-sync-subscription', {
        body: { organization_id: organizationId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Suscripción sincronizada: plan ${data.plan?.toUpperCase()}, estado ${data.status}`);
      // Refresh data without reloading the page
      refetchOrgs?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al sincronizar la suscripción';
      console.error('superadmin-sync-subscription error:', err);
      toast.error(msg);
    } finally {
      setSyncingOrgId(null);
    }
  };

  const paidOrgs = organizations?.filter(org => 
    org.subscription?.plan && org.subscription.plan !== 'free'
  ) || [];

  const filteredOrgs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (organizations || []).filter((org) => {
      const matchesSearch = !q || org.name.toLowerCase().includes(q);
      const matchesPlan = planFilter === 'all' || org.subscription?.plan === planFilter;
      const normalizedStatus = normalizeSubscriptionStatus(org.subscription?.status);
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [organizations, planFilter, searchQuery, statusFilter]);

  const getStatusBadge = (status: string | undefined) => {
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
        return <Badge variant="secondary">{status || 'Sin estado'}</Badge>;
    }
  };

  return (
    <SuperAdminLayout title="Suscripciones">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Planes de Pago
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{paidOrgs.length}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Plan Pro
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.planBreakdown?.pro || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Plan Team
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.planBreakdown?.team || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan Distribution */}
        {stats?.planBreakdown && (
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Planes</CardTitle>
              <CardDescription>Desglose por tipo de plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.planBreakdown).map(([plan, count]) => (
                  <div 
                    key={plan} 
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card"
                  >
                    <Badge 
                      variant={plan === 'free' ? 'secondary' : 'default'}
                      className="text-sm px-3 py-1"
                    >
                      {plan.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="text-2xl font-bold">{String(count)}</p>
                      <p className="text-xs text-muted-foreground">organizaciones</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Todas las Suscripciones</CardTitle>
            <CardDescription>Lista completa de organizaciones y sus planes</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
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
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="trialing">Trial</SelectItem>
                  <SelectItem value="past_due">Pago pendiente</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="unknown">Sin estado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {orgsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !organizations?.length ? (
              <p className="text-muted-foreground text-center py-8">No hay organizaciones</p>
            ) : filteredOrgs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No se encontraron suscripciones con esos filtros
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organización</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Próxima Facturación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgs.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>
                          <Badge variant={org.subscription?.plan === 'free' ? 'secondary' : 'default'}>
                            {org.subscription?.plan?.toUpperCase() || 'FREE'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(org.subscription?.status)}</TableCell>
                        <TableCell>
                          {org.subscription?.billing_interval || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {org.subscription?.current_period_end
                            ? format(new Date(org.subscription.current_period_end), "d MMM yyyy", { locale: es })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={!org.subscription?.stripe_customer_id || openingPortalOrgId === org.id}
                                onClick={() => handleOpenOrgCustomerPortal(org.id)}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Abrir portal cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!org.subscription?.stripe_customer_id || syncingOrgId === org.id}
                                onClick={() => handleSyncSubscription(org.id)}
                              >
                                <RefreshCw className={`h-4 w-4 mr-2 ${syncingOrgId === org.id ? 'animate-spin' : ''}`} />
                                {syncingOrgId === org.id ? 'Sincronizando...' : 'Sincronizar con Stripe'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/super-admin/organizations/${org.id}`)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver organización
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate('/super-admin/alerts')}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ir a alertas
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
    </SuperAdminLayout>
  );
}
