import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Ship, Loader2, ShieldAlert } from 'lucide-react';
import { useTransferRequests } from '@/hooks/useTransferRequests';
import { usePermissions } from '@/hooks/usePermissions';
import { TransferRequestCard } from '@/components/transfers/TransferRequestCard';
import { TransferFilters } from '@/components/transfers/TransferFilters';
import type { TransferFilters as TFilters } from '@/types/transfers';

export default function Transfers() {
  const navigate = useNavigate();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  
  const canView = !permissionsLoading && hasPermission('transfers.view');
  const canCreate = !permissionsLoading && (hasPermission('transfers.create') || hasPermission('transfers.manage'));
  const canManage = !permissionsLoading && hasPermission('transfers.manage');
  const canDelete = !permissionsLoading && hasPermission('transfers.delete');
  
  const [filters, setFilters] = usePersistedFilters<TFilters>({
    search: '',
    broker: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  const { requests, isLoading, deleteRequest } = useTransferRequests(filters);

  // Get unique brokers for filter dropdown
  const brokers = useMemo(() => {
    const unique = new Set(requests.map(r => r.broker_name));
    return Array.from(unique).sort();
  }, [requests]);

  // Loading state
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

  return (
    <AppLayout title="Transfers">
      <div className="container max-w-5xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ship className="h-6 w-6" />
              Transfers
            </h1>
            <p className="text-muted-foreground">Gestión de traslados para brokers de yates</p>
          </div>
          {canCreate && (
            <Button onClick={() => navigate('/transfers/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Solicitud
            </Button>
          )}
        </div>

        <TransferFilters 
          filters={filters} 
          onFiltersChange={setFilters}
          brokers={brokers}
        />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : requests.length === 0 ? (
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
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <TransferRequestCard
                key={request.id}
                request={request}
                onClick={() => navigate(`/transfers/${request.id}`)}
                onDelete={deleteRequest}
                canDelete={canDelete}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
