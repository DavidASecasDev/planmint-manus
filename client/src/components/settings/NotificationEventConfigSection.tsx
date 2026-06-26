import { useState, useEffect, useCallback } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users, UserCheck, CalendarCheck, Sparkles, Bus, AlertTriangle, Plus, XCircle, Paintbrush } from 'lucide-react';

// Operational notification events with metadata
const OPERATIONAL_EVENTS = [
  { key: 'rental_assigned', label: 'Asignación Rental', description: 'Cuando se asigna un empleado a una entrega/devolución', icon: UserCheck },
  { key: 'escoba_assigned', label: 'Asignación Escoba', description: 'Cuando se asigna un empleado como escoba', icon: Paintbrush },
  { key: 'hora_confirmada', label: 'Hora Confirmada', description: 'Cuando se confirma la hora de una operación', icon: CalendarCheck },
  { key: 'vehiculo_listo', label: 'Vehículo Listo', description: 'Cuando un vehículo termina la preparación', icon: Sparkles },
  { key: 'shuttle_programado', label: 'Shuttle Programado', description: 'Cuando se marca una operación como shuttle', icon: Bus },
  { key: 'refuerzo_necesario', label: 'Refuerzo Necesario', description: 'Cuando se detecta que se necesitan refuerzos', icon: AlertTriangle },
  { key: 'nueva_reserva', label: 'Nueva Reserva', description: 'Cuando se crea una nueva reserva', icon: Plus },
  { key: 'reserva_cancelada', label: 'Reserva Cancelada', description: 'Cuando se cancela o archiva una reserva', icon: XCircle },
] as const;

interface EventConfig {
  id?: string;
  event_key: string;
  team_id: string | null;
  enabled: boolean;
}

interface Team {
  id: string;
  name: string;
}

export function NotificationEventConfigSection() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [configs, setConfigs] = useState<EventConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.organization_id) return;

    try {
      // Fetch teams
      const { data: teamsData } = await supabaseQuery
        .from('teams')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
        .order('name', { ascending: true });

      // Fetch existing configs
      const { data: configsData } = await supabaseQuery
        .from('notification_event_config')
        .select('*')
        .eq('organization_id', profile.organization_id);

      setTeams(teamsData || []);
      setConfigs(configsData || []);
    } catch (error) {
      console.error('Error fetching notification event config:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getConfigForEventTeam = (eventKey: string, teamId: string): boolean => {
    const config = configs.find(c => c.event_key === eventKey && c.team_id === teamId);
    // Default: enabled if no explicit config exists
    return config ? config.enabled : true;
  };

  const handleToggle = async (eventKey: string, teamId: string, enabled: boolean) => {
    if (!profile?.organization_id) return;

    const saveKey = `${eventKey}-${teamId}`;
    setSaving(saveKey);

    try {
      const existingConfig = configs.find(c => c.event_key === eventKey && c.team_id === teamId);

      if (existingConfig?.id) {
        // Update existing
        await supabaseQuery
          .from('notification_event_config')
          .update({ enabled })
          .eq('id', existingConfig.id);

        setConfigs(prev => prev.map(c => c.id === existingConfig.id ? { ...c, enabled } : c));
      } else {
        // Insert new
        const { data } = await supabaseQuery
          .from('notification_event_config')
          .insert({
            organization_id: profile.organization_id,
            event_key: eventKey,
            team_id: teamId,
            enabled,
          })
          .select()
          .single();

        if (data) {
          setConfigs(prev => [...prev, data]);
        }
      }

      toast.success('Configuración actualizada');
    } catch (error) {
      console.error('Error updating notification event config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay equipos configurados.</p>
        <p className="text-xs mt-1">Crea equipos en la sección de Equipo para configurar notificaciones por rol.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Configura qué eventos de notificación recibe cada equipo. Los miembros de cada equipo recibirán las notificaciones marcadas (pueden desactivarlas individualmente en sus preferencias personales).
        </p>
      </div>

      {/* Matrix: events × teams */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 pr-4 font-medium text-muted-foreground min-w-[200px]">Evento</th>
              {teams.map(team => (
                <th key={team.id} className="text-center py-3 px-2 font-medium min-w-[100px]">
                  <Badge variant="outline" className="text-xs">
                    {team.name}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OPERATIONAL_EVENTS.map(event => {
              const Icon = event.icon;
              return (
                <tr key={event.key} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  </td>
                  {teams.map(team => {
                    const isEnabled = getConfigForEventTeam(event.key, team.id);
                    const isSaving = saving === `${event.key}-${team.id}`;
                    return (
                      <td key={team.id} className="text-center py-3 px-2">
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggle(event.key, team.id, checked)}
                            className="mx-auto"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
