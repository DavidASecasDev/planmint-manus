import { ReactNode, useMemo } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { usePlatformStats, usePlatformOrganizations } from '@/hooks/useSuperAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, ArrowLeftRight, Car, Ship, Home, TrendingUp, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Organization brand config
const ORG_BRANDS: Record<string, { icon: typeof Car; color: string; gradient: string }> = {
  'Azul Cars': { icon: Car, color: 'text-blue-600', gradient: 'from-blue-500/10 to-blue-600/5' },
  'Bluebnc': { icon: Ship, color: 'text-cyan-600', gradient: 'from-cyan-500/10 to-cyan-600/5' },
  'Azul Stays': { icon: Home, color: 'text-emerald-600', gradient: 'from-emerald-500/10 to-emerald-600/5' },
};

function getOrgBrand(name: string) {
  return ORG_BRANDS[name] || { icon: Building2, color: 'text-primary', gradient: 'from-primary/10 to-primary/5' };
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: organizations, isLoading: orgsLoading } = usePlatformOrganizations();

  // Fetch cross-org service requests summary
  const { data: serviceRequestStats } = useQuery({
    queryKey: ['group-service-requests-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('service_requests')
        .select('id, status, request_type, created_at, requesting_org_id, fulfilling_org_id');
      
      if (error) return { total: 0, pending: 0, approved: 0, rejected: 0, thisMonth: 0 };
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      return {
        total: data?.length || 0,
        pending: data?.filter((r: any) => r.status === 'pending').length || 0,
        approved: data?.filter((r: any) => r.status === 'approved').length || 0,
        rejected: data?.filter((r: any) => r.status === 'rejected').length || 0,
        thisMonth: data?.filter((r: any) => new Date(r.created_at) >= startOfMonth).length || 0,
      };
    },
    enabled: !!session,
  });

  // Fetch member counts per org
  const { data: orgMembers } = useQuery({
    queryKey: ['group-org-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, status');
      
      if (error) return {};
      
      const counts: Record<string, { active: number; total: number }> = {};
      data?.forEach(m => {
        if (!counts[m.organization_id]) counts[m.organization_id] = { active: 0, total: 0 };
        counts[m.organization_id].total++;
        if (m.status === 'active') counts[m.organization_id].active++;
      });
      return counts;
    },
    enabled: !!session,
  });

  return (
    <SuperAdminLayout title="Panel de Grupo">
      <div className="space-y-6">
        {/* Top Stats Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Organizaciones"
            value={organizations?.length || 0}
            icon={Building2}
            loading={orgsLoading}
            description="Empresas del grupo"
          />
          <StatCard
            title="Usuarios Totales"
            value={stats?.totalUsers || 0}
            icon={Users}
            loading={statsLoading}
            description="Miembros activos"
          />
          <StatCard
            title="Solicitudes Cross-Org"
            value={serviceRequestStats?.thisMonth || 0}
            icon={ArrowLeftRight}
            loading={!serviceRequestStats}
            description="Este mes"
          />
          <StatCard
            title="Pendientes"
            value={serviceRequestStats?.pending || 0}
            icon={Clock}
            loading={!serviceRequestStats}
            description="Solicitudes por resolver"
            highlight={serviceRequestStats?.pending ? serviceRequestStats.pending > 0 : false}
          />
        </div>

        {/* Organizations Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Organizaciones del Grupo</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orgsLoading ? (
              [1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-40" />
                </Card>
              ))
            ) : (
              organizations?.map(org => {
                const brand = getOrgBrand(org.name);
                const OrgIcon = brand.icon;
                const members = orgMembers?.[org.id];
                
                return (
                  <Card 
                    key={org.id} 
                    className={`relative overflow-hidden bg-gradient-to-br ${brand.gradient} hover:shadow-md transition-shadow cursor-pointer`}
                    onClick={() => navigate(`/super-admin/organizations/${org.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center ${brand.color}`}>
                            <OrgIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{org.name}</CardTitle>
                            <CardDescription className="text-xs">
                              Creada {format(new Date(org.created_at), "MMM yyyy", { locale: es })}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {members?.active || 0} miembros
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="text-center p-2 rounded-md bg-background/50">
                          <p className="text-lg font-bold">{members?.active || 0}</p>
                          <p className="text-xs text-muted-foreground">Activos</p>
                        </div>
                        <div className="text-center p-2 rounded-md bg-background/50">
                          <p className="text-lg font-bold">{members?.total || 0}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Service Requests Summary */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Solicitudes de Servicio Cross-Org</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/service-requests')}
            >
              Ver todas
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <MiniStatCard
              label="Total"
              value={serviceRequestStats?.total || 0}
              icon={<ArrowLeftRight className="h-4 w-4 text-muted-foreground" />}
            />
            <MiniStatCard
              label="Pendientes"
              value={serviceRequestStats?.pending || 0}
              icon={<Clock className="h-4 w-4 text-yellow-600" />}
              highlight={!!serviceRequestStats?.pending && serviceRequestStats.pending > 0}
            />
            <MiniStatCard
              label="Aprobadas"
              value={serviceRequestStats?.approved || 0}
              icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
            />
            <MiniStatCard
              label="Rechazadas"
              value={serviceRequestStats?.rejected || 0}
              icon={<XCircle className="h-4 w-4 text-red-600" />}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Button 
                variant="outline" 
                className="justify-start gap-2 h-auto py-3"
                onClick={() => navigate('/super-admin/organizations')}
              >
                <Building2 className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium text-sm">Gestionar Organizaciones</p>
                  <p className="text-xs text-muted-foreground">Configurar módulos y miembros</p>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start gap-2 h-auto py-3"
                onClick={() => navigate('/super-admin/users')}
              >
                <Users className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium text-sm">Usuarios del Grupo</p>
                  <p className="text-xs text-muted-foreground">Ver todos los miembros</p>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start gap-2 h-auto py-3"
                onClick={() => navigate('/service-requests')}
              >
                <ArrowLeftRight className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium text-sm">Solicitudes Cross-Org</p>
                  <p className="text-xs text-muted-foreground">Vehículos y transfers entre empresas</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function StatCard({ 
  title, value, icon: Icon, loading, description, highlight 
}: { 
  title: string; 
  value: number; 
  icon: typeof Building2; 
  loading: boolean; 
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-yellow-300 dark:border-yellow-700' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${highlight ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-muted'}`}>
          <Icon className={`h-5 w-5 ${highlight ? 'text-yellow-600' : 'text-muted-foreground'}`} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStatCard({ 
  label, value, icon, highlight 
}: { 
  label: string; 
  value: number; 
  icon: ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={`${highlight ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
      <CardContent className="py-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
