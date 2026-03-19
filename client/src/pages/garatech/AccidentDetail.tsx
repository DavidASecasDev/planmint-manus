import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccidents } from '@/hooks/useAccidents';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import { AccidentDetailHeader } from '@/components/garatech/accident-detail/AccidentDetailHeader';
import { AccidentGeneralTab } from '@/components/garatech/accident-detail/AccidentGeneralTab';
import { AccidentPhotosTab } from '@/components/garatech/accident-detail/AccidentPhotosTab';
import { AccidentDocumentsTab } from '@/components/garatech/accident-detail/AccidentDocumentsTab';
import { AccidentNotesTab } from '@/components/garatech/accident-detail/AccidentNotesTab';
import type { Accident } from '@/types/garatech';

export default function AccidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canManage } = useAccidents();
  const [isEditing, setIsEditing] = useState(false);
  const orgId = profile?.organization_id;

  const { data: accident, isLoading } = useQuery({
    queryKey: ['accident', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('accidents')
        .select(`
          *,
          vehicle:vehicles(matricula, modelo),
          reported_by_profile:profiles!accidents_reported_by_fkey(name),
          linked_repair:repairs!accidents_linked_repair_id_fkey(id, repair_number, status)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return {
        ...data,
        vehicle: data.vehicle ? { matricula: (data.vehicle as any).matricula, modelo: (data.vehicle as any).modelo } : null,
        linked_repair: data.linked_repair && typeof data.linked_repair === 'object' && 'id' in data.linked_repair
          ? { id: (data.linked_repair as any).id, repair_number: (data.linked_repair as any).repair_number, status: (data.linked_repair as any).status }
          : null,
        severity: data.severity || 'leve',
        status: data.status || 'reportado',
        fault_assessment: data.fault_assessment || 'pendiente',
      } as Accident;
    },
    enabled: !!id && !!orgId,
  });

  if (isLoading) {
    return (
      <AppLayout title="Accidente">
        <div className="space-y-6 p-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!accident) {
    return (
      <AppLayout title="Accidente">
        <div className="text-center py-16 text-muted-foreground">
          <p>Accidente no encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/garatech/accidents')}>
            Volver al listado
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={accident.accident_number || 'Accidente'}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/accidents')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <AccidentDetailHeader accident={accident} />
          {canManage && (
            <Button 
              variant={isEditing ? "ghost" : "outline"} 
              size="sm" 
              className="ml-auto" 
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
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <AccidentGeneralTab 
              accident={accident} 
              isEditing={isEditing} 
              onSave={() => setIsEditing(false)} 
              onCancel={() => setIsEditing(false)} 
            />
          </TabsContent>
          <TabsContent value="photos">
            <AccidentPhotosTab accidentId={accident.id} canManage={canManage} />
          </TabsContent>
          <TabsContent value="documents">
            <AccidentDocumentsTab accidentId={accident.id} canManage={canManage} />
          </TabsContent>
          <TabsContent value="notes">
            <AccidentNotesTab accident={accident} canManage={canManage} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
