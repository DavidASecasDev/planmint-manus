import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTransition } from '@/components/ui/skeleton-transition';
import { Plus, Ship, Loader2, ShieldAlert, Download, List, Columns3 } from 'lucide-react';
import { useTransferRequests } from '@/hooks/useTransferRequests';
import { useTransferBrokers } from '@/hooks/useTransferBrokers';
import { usePermissions } from '@/hooks/usePermissions';
import { TransferRequestCard } from '@/components/transfers/TransferRequestCard';
import { TransfersKanban } from '@/components/transfers/TransfersKanban';
import { TransferFilters } from '@/components/transfers/TransferFilters';
import { downloadTransfersCsv } from '@/utils/exportTransfersCsv';
import { toast } from 'sonner';
import type { TransferFilters as TFilters } from '@/types/transfers';

type ViewMode = 'list' | 'kanban';

export default function Transfers() {
  const navigate = useNavigate();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('transfers_view_mode') as ViewMode) || 'list';
  });
  
  const canView = !permissionsLoading && hasPermission('transfers.view');
  const canCreate = !permissionsLoading && (hasPermission('transfers.create') || hasPermission('transfers.manage'));
  const canManage = !permissionsLoading && hasPermission('transfers.manage');
  const canDelete = !permissionsLoading && hasPermission('transfers.delete');
  
  const [filters, setFilters] = usePersistedFilters<TFilters>({
    search: '',
    broker: '',
    status: 'all',
    serviceType: 'all',
    dateFrom: '',
    dateTo: '',
    showArchived: false,
  });

  const { requests, isLoading, deleteRequest, archiveRequest, unarchiveRequest, updateStatus } = useTransferRequests(filters);
  const { brokers: allBrokerRecords } = useTransferBrokers();

  // Get broker names from the full transfer_brokers table (not just from existing requests)
  const brokers = useMemo(() => {
    return allBrokerRecords.map(b => b.name).sort();
  }, [allBrokerRecords]);

  const handleExportCsv = () => {
    if (requests.length === 0) {
      toast.info('No hay solicitudes para exportar');
      return;
    }
    downloadTransfersCsv(requests);
    toast.success(`${requests.length} solicitudes exportadas a CSV`);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('transfers_view_mode', mode);
  };

  // Loading state for permissions
  if (permissionsLoading) {
    return (
      <AppLayout title="Transfers">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Access denied
  if (!canView) {
    return (
      <AppLayout title="Transfers">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver transfers</p>
        </div>
      </AppLayout>
    );
  }

  const transfersSkeleton = (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="flex items-center gap-2 flex-wrap">
        <Skeleton className="h-9 flex-1 max-w-xs rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Count skeleton */}
      <Skeleton className="h-4 w-40 rounded-md" />

      {/* Transfer cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 p-4 space-y-3"
            style={{ opacity: 1 - i * 0.12 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout title="Transfers">
      <div className={`${viewMode === 'kanban' ? 'px-4 md:px-6' : 'container max-w-5xl'} py-6`}>
        <SkeletonTransition isLoading={isLoading} skeleton={transfersSkeleton}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Ship className="h-6 w-6" />
                  Transfers
                </h1>
                <p className="text-muted-foreground">Gestión de traslados para brokers de yates</p>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => handleViewModeChange('list')}
                    className={`p-2 transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                    title="Vista lista"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleViewModeChange('kanban')}
                    className={`p-2 transition-colors ${
                      viewMode === 'kanban'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                    title="Vista Kanban"
                  >
                    <Columns3 className="h-4 w-4" />
                  </button>
                </div>

                {requests.length > 0 && (
                  <Button variant="outline" onClick={handleExportCsv} className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                )}
                {canCreate && (
                  <Button onClick={() => navigate('/transfers/new')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Solicitud
                  </Button>
                )}
              </div>
            </div>

            <TransferFilters 
              filters={filters} 
              onFiltersChange={setFilters}
              brokers={brokers}
            />

            {/* Results count */}
            {requests.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {requests.length} solicitud{requests.length !== 1 ? 'es' : ''} encontrada{requests.length !== 1 ? 's' : ''}
              </p>
            )}

            {requests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Ship className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg mb-1">Sin solicitudes de transfer</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Crea tu primera solicitud de transfer para empezar
                  </p>
                  {canCreate && (
                    <Button onClick={() => navigate('/transfers/new')} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Nueva Solicitud
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : viewMode === 'kanban' ? (
              <TransfersKanban requests={requests} onStatusChange={updateStatus} brokers={brokers} />
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <TransferRequestCard
                    key={request.id}
                    request={request}
                    onClick={() => navigate(`/transfers/${request.id}`)}
                    onDelete={deleteRequest}
                    onArchive={archiveRequest}
                    onUnarchive={unarchiveRequest}
                    canDelete={canDelete}
                    canManage={canManage}
                  />
                ))}
              </div>
            )}
          </div>
        </SkeletonTransition>
      </div>
    </AppLayout>
  );
}
