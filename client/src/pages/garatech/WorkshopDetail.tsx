import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useRepairs } from '@/hooks/useRepairs';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Building2, Pencil, X, MapPin, Phone, Mail, Calendar, Star, Wrench, CheckCircle2, DollarSign, Car } from 'lucide-react';
import { WorkshopEditForm } from '@/components/garatech/workshop-detail/WorkshopEditForm';
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, REPAIR_TYPE_LABELS } from '@/types/garatech';
import type { Workshop } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function WorkshopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canManage, updateRating } = useWorkshops();
  const { repairs } = useRepairs();
  const [isEditing, setIsEditing] = useState(false);
  const orgId = profile?.organization_id;

  const { data: workshop, isLoading } = useQuery({
    queryKey: ['workshop', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Workshop;
    },
    enabled: !!id && !!orgId,
  });

  if (isLoading) {
    return (
      <AppLayout title="Taller">
        <div className="space-y-6 p-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!workshop) {
    return (
      <AppLayout title="Taller">
        <div className="text-center py-16 text-muted-foreground">
          <p>Taller no encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/garatech/workshops')}>
            Volver al listado
          </Button>
        </div>
      </AppLayout>
    );
  }

  const workshopRepairs = repairs.filter(r => r.workshop_id === workshop.id);
  const completedRepairs = workshopRepairs.filter(r => r.status === 'finalizado');
  const totalCost = workshopRepairs.reduce((sum, r) => sum + (r.cost_final || r.cost_estimate || 0), 0);

  const handleRatingChange = async (rating: number) => {
    if (canManage) {
      await updateRating.mutateAsync({ id: workshop.id, rating });
    }
  };

  return (
    <AppLayout title={workshop.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/garatech/workshops')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">{workshop.name}</h1>
            </div>
          </div>
          <Badge variant={workshop.is_active ? 'default' : 'secondary'}>
            {workshop.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
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

        {isEditing ? (
          <WorkshopEditForm
            workshop={workshop}
            onSave={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact & Rating */}
            <Card>
              <CardHeader><CardTitle className="text-base">Información de Contacto</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRatingChange(star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                      disabled={!canManage}
                    >
                      <Star className={`h-5 w-5 ${star <= (workshop.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-300'}`} />
                    </button>
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">{workshop.rating?.toFixed(1) || '—'}</span>
                </div>
                {workshop.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{workshop.address}</span>
                  </div>
                )}
                {workshop.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a href={`tel:${workshop.phone}`} className="text-primary hover:underline">{workshop.phone}</a>
                  </div>
                )}
                {workshop.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a href={`mailto:${workshop.email}`} className="text-primary hover:underline">{workshop.email}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Añadido el {format(new Date(workshop.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </span>
                </div>
                {workshop.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm">{workshop.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader><CardTitle className="text-base">Estadísticas</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Wrench className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-semibold">{workshopRepairs.length}</p>
                    <p className="text-xs text-muted-foreground">Reparaciones</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-lg font-semibold">{completedRepairs.length}</p>
                    <p className="text-xs text-muted-foreground">Completadas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-lg font-semibold">{totalCost > 0 ? `${totalCost.toLocaleString()}€` : '—'}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Repair History */}
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Historial de Reparaciones</CardTitle></CardHeader>
              <CardContent>
                {workshopRepairs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Sin reparaciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workshopRepairs
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((repair) => (
                        <div
                          key={repair.id}
                          className="p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/garatech/repairs/${repair.id}`)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{repair.vehicle?.matricula || 'Sin vehículo'}</span>
                            </div>
                            <Badge className={`text-xs ${REPAIR_STATUS_COLORS[repair.status]}`}>
                              {REPAIR_STATUS_LABELS[repair.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{repair.description}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(repair.created_at), "d MMM yyyy", { locale: es })}
                              </span>
                              <Badge variant="outline" className="text-xs">{REPAIR_TYPE_LABELS[repair.repair_type]}</Badge>
                            </div>
                            {(repair.cost_final || repair.cost_estimate) && (
                              <span className="font-medium text-foreground">
                                {(repair.cost_final || repair.cost_estimate)?.toLocaleString()}€
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
