import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, User, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Milestone, MILESTONE_STATUS_OPTIONS, MilestoneStatus, MilestoneAssigneeType } from '@/types/milestones';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { useTeams } from '@/hooks/useTeams';

const milestoneSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'done']),
  due_date: z.date().nullable(),
  assignee_type: z.enum(['user', 'team']).nullable(),
  assignee_id: z.string().nullable(),
});

type MilestoneFormValues = z.infer<typeof milestoneSchema>;

interface MilestoneEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: Milestone | null;
  onSave: (data: { 
    title: string; 
    description?: string | null; 
    status: MilestoneStatus; 
    due_date: string | null;
    assignee_type?: MilestoneAssigneeType;
    assignee_id?: string | null;
  }) => void;
}

export function MilestoneEditDialog({
  open,
  onOpenChange,
  milestone,
  onSave,
}: MilestoneEditDialogProps) {
  const { members } = useOrganizationMembers();
  const { teams } = useTeams();
  
  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'pending',
      due_date: null,
      assignee_type: null,
      assignee_id: null,
    },
  });

  const watchAssigneeType = form.watch('assignee_type');

  useEffect(() => {
    if (milestone) {
      form.reset({
        title: milestone.title,
        description: milestone.description || '',
        status: milestone.status,
        due_date: milestone.due_date ? new Date(milestone.due_date) : null,
        assignee_type: milestone.assignee_type,
        assignee_id: milestone.assignee_id,
      });
    }
  }, [milestone, form]);

  // Reset assignee_id when type changes
  useEffect(() => {
    if (!open) return;
    const currentType = form.getValues('assignee_type');
    const currentId = form.getValues('assignee_id');
    
    // If type changed, validate id still makes sense
    if (currentType === 'user' && currentId) {
      const validUser = members.some(m => m.user_id === currentId);
      if (!validUser) form.setValue('assignee_id', null);
    } else if (currentType === 'team' && currentId) {
      const validTeam = teams.some(t => t.id === currentId);
      if (!validTeam) form.setValue('assignee_id', null);
    }
  }, [watchAssigneeType, members, teams, form, open]);

  const handleSubmit = (values: MilestoneFormValues) => {
    onSave({
      title: values.title,
      description: values.description || null,
      status: values.status,
      due_date: values.due_date ? format(values.due_date, 'yyyy-MM-dd') : null,
      assignee_type: values.assignee_type as MilestoneAssigneeType,
      assignee_id: values.assignee_id,
    });
    onOpenChange(false);
  };

  const handleClearAssignee = () => {
    form.setValue('assignee_type', null);
    form.setValue('assignee_id', null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar hito</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del hito" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descripción opcional"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MILESTONE_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha límite</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: es })
                          ) : (
                            <span>Selecciona una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assignee Section */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <FormLabel>Responsable</FormLabel>
                {(watchAssigneeType || form.getValues('assignee_id')) && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={handleClearAssignee}
                  >
                    Quitar
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="assignee_type"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Usuario
                            </div>
                          </SelectItem>
                          <SelectItem value="team">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Equipo
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignee_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                        disabled={!watchAssigneeType}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={watchAssigneeType ? 'Seleccionar' : 'Elige tipo'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchAssigneeType === 'user' && members.map(member => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.profile?.name || 'Sin nombre'}
                            </SelectItem>
                          ))}
                          {watchAssigneeType === 'team' && teams.map(team => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                          {watchAssigneeType === 'user' && members.length === 0 && (
                            <SelectItem value="_none" disabled>
                              No hay miembros
                            </SelectItem>
                          )}
                          {watchAssigneeType === 'team' && teams.length === 0 && (
                            <SelectItem value="_none" disabled>
                              No hay equipos
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
