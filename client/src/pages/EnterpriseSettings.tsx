import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Building2, Users, Key, FileText, Settings2, Crown } from 'lucide-react';
import { EnterpriseStatusSection } from '@/components/enterprise/EnterpriseStatusSection';
import { SAMLConfigSection } from '@/components/enterprise/SAMLConfigSection';
import { SCIMTokensSection } from '@/components/enterprise/SCIMTokensSection';
import { SCIMGroupMappingsSection } from '@/components/enterprise/SCIMGroupMappingsSection';
import { SCIMUsersSection } from '@/components/enterprise/SCIMUsersSection';
import { EnterprisePoliciesSection } from '@/components/enterprise/EnterprisePoliciesSection';
import { ProvisioningLogsSection } from '@/components/enterprise/ProvisioningLogsSection';

export default function EnterpriseSettings() {
  const { profile } = useAuth();
  const { isOwner } = usePermissions();
  const { subscription } = useSubscription();

  const isTeamPlan = subscription?.plan === 'team';

  if (!isOwner) {
    return (
      <AppLayout title="Enterprise Settings">
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
              <p className="text-muted-foreground text-center">
                Solo el propietario de la organización puede acceder a la configuración Enterprise.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!isTeamPlan) {
    return (
      <AppLayout title="Enterprise Settings">
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Crown className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Plan Team requerido</h2>
              <p className="text-muted-foreground text-center mb-6">
                Las integraciones Enterprise (SAML SSO, SCIM) están disponibles en el plan Team.
              </p>
              <Button>
                <Crown className="h-4 w-4 mr-2" />
                Actualizar a Team
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Enterprise Settings">
      <div className="container mx-auto py-8 space-y-6">
        <PageHeader
          title="Enterprise Settings"
          description="Configura SAML SSO, SCIM provisioning y políticas corporativas"
        />

        <Tabs defaultValue="status" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Estado</span>
            </TabsTrigger>
            <TabsTrigger value="sso" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">SSO</span>
            </TabsTrigger>
            <TabsTrigger value="scim" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">SCIM</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Grupos</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Políticas</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <EnterpriseStatusSection />
          </TabsContent>

          <TabsContent value="sso">
            <SAMLConfigSection />
          </TabsContent>

          <TabsContent value="scim">
            <SCIMTokensSection />
          </TabsContent>

          <TabsContent value="groups">
            <SCIMGroupMappingsSection />
          </TabsContent>

          <TabsContent value="users">
            <SCIMUsersSection />
          </TabsContent>

          <TabsContent value="policies">
            <EnterprisePoliciesSection />
          </TabsContent>

          <TabsContent value="logs">
            <ProvisioningLogsSection />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
