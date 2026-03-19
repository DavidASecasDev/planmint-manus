import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTransferBrokers } from '@/hooks/useTransferBrokers';
import { useBrokerRegistrations } from '@/hooks/useBrokerRegistrations';
import { usePermissions } from '@/hooks/usePermissions';
import { BrokerTable } from '@/components/transfers/BrokerTable';
import { BrokerDialog } from '@/components/transfers/BrokerDialog';
import { BrokerRegistrationList } from '@/components/transfers/BrokerRegistrationList';
import { Users, UserCheck, KeyRound, Plus, Search, ShieldAlert, Clock } from 'lucide-react';

export default function BrokerManagement() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { allBrokers, isLoadingAll } = useTransferBrokers();
  const { 
    pendingRequests, 
    pendingCount, 
    isLoadingPending, 
    approveRequest, 
    rejectRequest,
    isApproving,
    isRejecting
  } = useBrokerRegistrations();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('brokers');

  // Wait for permissions to load
  if (permissionsLoading) {
    return (
      <AppLayout title="Gestión de Brokers">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  // Check permission
  if (!hasPermission('transfers.manage')) {
    return (
      <AppLayout title="Gestión de Brokers">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acceso Restringido</h2>
          <p className="text-muted-foreground">No tienes permisos para gestionar brokers.</p>
        </div>
      </AppLayout>
    );
  }

  const totalBrokers = allBrokers.length;
  const activeBrokers = allBrokers.filter(b => b.is_active).length;
  const brokersWithPortal = allBrokers.filter(b => b.user_id).length;

  const filteredBrokers = allBrokers.filter(broker => {
    const query = searchQuery.toLowerCase();
    return (
      broker.name.toLowerCase().includes(query) ||
      broker.company?.toLowerCase().includes(query) ||
      broker.email?.toLowerCase().includes(query)
    );
  });

  const handleCreateNew = () => {
    setEditingBroker(null);
    setDialogOpen(true);
  };

  const handleEdit = (broker: any) => {
    setEditingBroker(broker);
    setDialogOpen(true);
  };

  return (
    <AppLayout title="Gestión de Brokers">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Brokers</h1>
            <p className="text-muted-foreground">Administra los brokers externos y su acceso al portal</p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Broker
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Brokers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBrokers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBrokers}</div>
              <p className="text-xs text-muted-foreground">
                {totalBrokers > 0 ? Math.round((activeBrokers / totalBrokers) * 100) : 0}% del total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Con Portal</CardTitle>
              <KeyRound className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{brokersWithPortal}</div>
              <p className="text-xs text-muted-foreground">
                Acceso al portal
              </p>
            </CardContent>
          </Card>

          <Card className={pendingCount > 0 ? 'border-amber-200 bg-amber-50/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
              <Clock className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">
                {pendingCount > 0 ? 'Solicitudes por revisar' : 'Sin solicitudes'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="brokers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Brokers Activos
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Solicitudes
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Brokers Tab */}
          <TabsContent value="brokers" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, empresa o email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <BrokerTable
                  brokers={filteredBrokers}
                  isLoading={isLoadingAll}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Registration Requests Tab */}
          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Solicitudes de Registro</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Revisa y aprueba las solicitudes de acceso de nuevos brokers
                </p>
              </CardHeader>
              <CardContent>
                <BrokerRegistrationList
                  requests={pendingRequests}
                  isLoading={isLoadingPending}
                  onApprove={approveRequest}
                  onReject={rejectRequest}
                  isApproving={isApproving}
                  isRejecting={isRejecting}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog */}
        <BrokerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          broker={editingBroker}
        />
      </div>
    </AppLayout>
  );
}
