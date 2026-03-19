import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRepairs } from '@/hooks/useRepairs';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, X, Wrench, Car } from 'lucide-react';
import { RepairGeneralTab } from '@/components/garatech/repair-detail/RepairGeneralTab';
import { RepairCommentsTab } from '@/components/garatech/repair-detail/RepairCommentsTab';
import { RepairHistoryTab } from '@/components/garatech/repair-detail/RepairHistoryTab';
import { RepairPhotosTab } from '@/components/garatech/repair-detail/RepairPhotosTab';
import { RepairInvoicesTab } from '@/components/garatech/repair-detail/RepairInvoicesTab';
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, REPAIR_TYPE_LABELS } from '@/types/garatech';
import type { Repair } from '@/types/garatech';

export default function RepairDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canManage } = useRepairs();
  const [isEditing, setIsEditing] = useState(false);
  const orgId = profile?.organization_id;

  const { data: repair, isLoading } = useQuery({
    queryKey: ['repair', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('repairs')
        .select(`
          *,
          vehicle:vehicles(matricula, modelo),
          workshop:workshops(name),
          created_by_profile:profiles!repairs_created_by_fkey(name)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Repair;
    },
    enabled: !!id && !!orgId,
  });

  if (isLoading) {
    return (
      <AppLayout title="Reparación">
        <div className="space-y-6 p-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!repair) {
    return (
      <AppLayout title="Reparación">
        <div className="text-center py-16 text-muted-foreground">
          <p>Reparación no encontrada</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/garatech/repairs')}>
            Volver al listado
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={repair.repair_number || 'Reparación'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/repairs')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">
                {repair.repair_number || `Reparación #${repair.id.slice(0, 8)}`}
              </h1>
            </div>
            {repair.vehicle && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Car className="h-4 w-4" />
                <span className="font-medium">{repair.vehicle.matricula}</span>
                <span>·</span>
                <span>{repair.vehicle.modelo}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={REPAIR_STATUS_COLORS[repair.status]}>
              {REPAIR_STATUS_LABELS[repair.status]}
            </Badge>
            <Badge variant="outline">
              {REPAIR_TYPE_LABELS[repair.repair_type]}
            </Badge>
          </div>
          {canManage && (
            <Button
              variant={isEditing ? "ghost" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <><X className="h-4 w-4 mr-2" />Cancelar</>
              ) : (
                <><Pencil className="h-4 w-4 mr-2" />Editar</>
              )}
            </Button>
          )}
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="comments">Comentarios</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <RepairGeneralTab
              repair={repair}
              isEditing={isEditing}
              onSave={() => setIsEditing(false)}
              onCancel={() => setIsEditing(false)}
            />
          </TabsContent>
          <TabsContent value="comments">
            <RepairCommentsTab repairId={repair.id} />
          </TabsContent>
          <TabsContent value="history">
            <RepairHistoryTab repairId={repair.id} />
          </TabsContent>
          <TabsContent value="photos">
            <RepairPhotosTab repairId={repair.id} />
          </TabsContent>
          <TabsContent value="invoices">
            <RepairInvoicesTab repairId={repair.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
