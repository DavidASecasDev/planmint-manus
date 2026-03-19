import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Clock, Filter, ExternalLink, BellOff } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/loading-skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAllReminders } from '@/hooks/useReminders';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ReminderForm } from '@/components/reminders/ReminderForm';
import { getRecurrenceLabel, RecurrenceType, RECURRENCE_TYPE_OPTIONS, ReminderWithTask } from '@/types/reminders';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { TaskStatus } from '@/types/tasks';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Reminders() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { reminders, loading, filters, setFilters, refetch } = useAllReminders();
  const [editingReminder, setEditingReminder] = useState<ReminderWithTask | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use permissions from RPC instead of profile.role
  const canEdit = !permissionsLoading && hasPermission('tasks.update');

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      toast.success('Recordatorio actualizado');
      refetch();
    } catch (error) {
      console.error('Error toggling reminder:', error);
      toast.error('Error al actualizar recordatorio');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Recordatorio eliminado');
      refetch();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error('Error al eliminar recordatorio');
    }
  };

  const handleUpdate = async (data: {
    remind_at: string;
    recurrence_type: RecurrenceType;
    recurrence_interval?: number;
    is_active?: boolean;
  }) => {
    if (!editingReminder) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          remind_at: data.remind_at,
          recurrence_type: data.recurrence_type,
          recurrence_interval: data.recurrence_type === 'once' ? null : (data.recurrence_interval || 1),
          is_active: data.is_active,
        })
        .eq('id', editingReminder.id);

      if (error) throw error;
      toast.success('Recordatorio actualizado');
      setFormOpen(false);
      setEditingReminder(null);
      refetch();
    } catch (error) {
      console.error('Error updating reminder:', error);
      toast.error('Error al actualizar recordatorio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseForm = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingReminder(null);
    }
  };

  const expiredReminders = reminders.filter(r => isPast(new Date(r.remind_at)));
  const upcomingReminders = reminders.filter(r => !isPast(new Date(r.remind_at)));

  return (
    <AppLayout title="Recordatorios">
      <div className="space-y-6">
        <PageHeader
          icon={Bell}
          title="Recordatorios"
          description="Aquí verás los próximos recordatorios de tus tareas."
        />

        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="active-only"
                  checked={filters.activeOnly}
                  onCheckedChange={(checked) => 
                    setFilters(prev => ({ ...prev, activeOnly: checked }))
                  }
                />
                <Label htmlFor="active-only" className="text-sm cursor-pointer">Solo activos</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="my-tasks"
                  checked={filters.myTasksOnly}
                  onCheckedChange={(checked) => 
                    setFilters(prev => ({ ...prev, myTasksOnly: checked }))
                  }
                />
                <Label htmlFor="my-tasks" className="text-sm cursor-pointer">Solo mis tareas</Label>
              </div>

              <Select
                value={filters.recurrenceType}
                onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, recurrenceType: value as 'all' | RecurrenceType }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo de recurrencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {RECURRENCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <ListSkeleton count={4} />
        ) : reminders.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No hay recordatorios"
            description="No se encontraron recordatorios con los filtros seleccionados. Los recordatorios se crean desde el detalle de cada tarea."
          />
        ) : (
          <div className="space-y-6">
            {/* Upcoming Reminders */}
            {upcomingReminders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Próximos ({upcomingReminders.length})
                </h2>
                <div className="space-y-2">
                  {upcomingReminders.map((reminder) => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      canEdit={canEdit}
                      onNavigate={() => navigate(`/tasks?id=${reminder.task.id}`)}
                      onEdit={() => {
                        setEditingReminder(reminder);
                        setFormOpen(true);
                      }}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Expired Reminders */}
            {expiredReminders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                  <BellOff className="h-5 w-5" />
                  Vencidos ({expiredReminders.length})
                </h2>
                <div className="space-y-2">
                  {expiredReminders.map((reminder) => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      canEdit={canEdit}
                      isExpired
                      onNavigate={() => navigate(`/tasks?id=${reminder.task.id}`)}
                      onEdit={() => {
                        setEditingReminder(reminder);
                        setFormOpen(true);
                      }}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <ReminderForm
          open={formOpen}
          onOpenChange={handleCloseForm}
          onSubmit={handleUpdate}
          reminder={editingReminder}
          isLoading={isSubmitting}
        />
      </div>
    </AppLayout>
  );
}

interface ReminderCardProps {
  reminder: ReminderWithTask;
  canEdit: boolean;
  isExpired?: boolean;
  onNavigate: () => void;
  onEdit: () => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}

function ReminderCard({
  reminder,
  canEdit,
  isExpired = false,
  onNavigate,
  onEdit,
  onToggle,
  onDelete,
}: ReminderCardProps) {
  const remindDate = new Date(reminder.remind_at);

  return (
    <Card className={`transition-all duration-200 hover-lift ${!reminder.is_active ? 'opacity-60' : ''} ${isExpired ? 'border-destructive/30' : 'border-border/50'}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              !reminder.is_active ? 'bg-muted' : isExpired ? 'bg-destructive/10' : 'bg-primary/10'
            }`}>
              {reminder.is_active ? (
                <Bell className={`h-4 w-4 ${isExpired ? 'text-destructive' : 'text-primary'}`} />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {format(remindDate, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                </span>
                <Badge variant="outline" className="text-xs font-normal">
                  {getRecurrenceLabel(reminder.recurrence_type, reminder.recurrence_interval)}
                </Badge>
                {!reminder.is_active && (
                  <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                )}
                {isExpired && reminder.is_active && (
                  <Badge variant="destructive" className="text-xs">Vencido</Badge>
                )}
              </div>

              <div 
                className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors group"
                onClick={onNavigate}
              >
                <span className="truncate font-medium group-hover:text-primary transition-colors">{reminder.task.title}</span>
                <TaskStatusBadge status={reminder.task.status as TaskStatus} />
                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={reminder.is_active}
                onCheckedChange={(checked) => onToggle(reminder.id, checked)}
                aria-label={reminder.is_active ? 'Desactivar' : 'Activar'}
              />
              <Button variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground hover:text-foreground">
                Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar recordatorio?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(reminder.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
