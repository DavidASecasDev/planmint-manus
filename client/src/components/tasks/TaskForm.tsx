import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TaskWithRelations, TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS, TASK_TYPE_OPTIONS, TaskType } from '@/types/tasks';
import { Area } from '@/types/areas';
import { Tag } from '@/types/tags';
import { OrganizationMember } from '@/hooks/usePermissions';
import { TagSelector } from '@/components/tags/TagSelector';
import { useOfflineGuard } from '@/hooks/useOfflineGuard';
import { OperationFormSection } from '@/components/operations/OperationFormSection';
import { MultiAssigneeSelect } from '@/components/tasks/MultiAssigneeSelect';
import { useTeams, Team } from '@/hooks/useTeams';
import { useTaskAssignees } from '@/hooks/useTaskAssignees';

const taskFormSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  description: z.string().optional(),
  type: z.enum(['simple', 'goal_numeric', 'goal_milestones', 'operation']),
  status: z.enum(['pending', 'in_progress', 'blocked', 'completed']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigned_to: z.string().nullable(),
  assigned_user_ids: z.array(z.string()),
  assigned_team_ids: z.array(z.string()),
  due_date: z.date().nullable(),
  area_ids: z.array(z.string()),
  tag_ids: z.array(z.string()),
  goal_target_value: z.coerce.number().positive('Debe ser mayor que 0').nullable(),
  goal_unit: z.string().nullable(),
  // Operation fields
  operation_type: z.enum(['delivery', 'pickup', 'swap']).optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  location_type: z.enum(['hotel', 'villa', 'airport', 'office', 'other']).optional().nullable(),
  location_text: z.string().optional().nullable(),
  location_notes: z.string().optional().nullable(),
  reservation_ref: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  vehicle_out_id: z.string().optional().nullable(),
  vehicle_in_id: z.string().optional().nullable(),
  primary_assignee_id: z.string().optional().nullable(),
  has_support_leg: z.boolean().optional(),
  support_assignee_id: z.string().optional().nullable(),
}).refine((data) => {
  if (data.type === 'goal_numeric') {
    return data.goal_target_value !== null && data.goal_target_value > 0;
  }
  return true;
}, {
  message: 'La cantidad objetivo es obligatoria para objetivos numéricos',
  path: ['goal_target_value'],
}).refine((data) => {
  if (data.type === 'goal_numeric') {
    return data.goal_unit !== null && data.goal_unit.trim() !== '';
  }
  return true;
}, {
  message: 'La unidad es obligatoria para objetivos numéricos',
  path: ['goal_unit'],
}).refine((data) => {
  if (data.type === 'operation') {
    return data.operation_type != null;
  }
  return true;
}, {
  message: 'El tipo de operación es obligatorio',
  path: ['operation_type'],
}).refine((data) => {
  if (data.type === 'operation' && (data.operation_type === 'delivery' || data.operation_type === 'swap')) {
    return data.vehicle_out_id != null && data.vehicle_out_id.trim() !== '';
  }
  return true;
}, {
  message: 'El vehículo a entregar es obligatorio',
  path: ['vehicle_out_id'],
}).refine((data) => {
  if (data.type === 'operation' && (data.operation_type === 'pickup' || data.operation_type === 'swap')) {
    return data.vehicle_in_id != null && data.vehicle_in_id.trim() !== '';
  }
  return true;
}, {
  message: 'El vehículo a recoger es obligatorio',
  path: ['vehicle_in_id'],
}).refine((data) => {
  // Areas not required for operations
  if (data.type === 'operation') {
    return true;
  }
  return data.area_ids.length >= 1;
}, {
  message: 'Selecciona al menos un área',
  path: ['area_ids'],
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export interface TaskFormData {
  title: string;
  description?: string;
  type: 'simple' | 'goal_numeric' | 'goal_milestones' | 'operation';
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  assigned_user_ids: string[];
  assigned_team_ids: string[];
  due_date: Date | null;
  area_ids: string[];
  tag_ids: string[];
  goal_target_value: number | null;
  goal_unit: string | null;
  // Operation fields
  operation_type?: 'delivery' | 'pickup' | 'swap' | null;
  scheduled_at?: string | null;
  location_type?: 'hotel' | 'villa' | 'airport' | 'office' | 'other' | null;
  location_text?: string | null;
  location_notes?: string | null;
  reservation_ref?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  vehicle_out_id?: string | null;
  vehicle_in_id?: string | null;
  primary_assignee_id?: string | null;
  has_support_leg?: boolean;
  support_assignee_id?: string | null;
}

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskWithRelations | null;
  areas: Area[];
  tags: Tag[];
  members: OrganizationMember[];
  onSubmit: (data: TaskFormData) => Promise<void>;
}

export function TaskForm({
  open,
  onOpenChange,
  task,
  areas,
  tags,
  members,
  onSubmit,
}: TaskFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { checkOnline } = useOfflineGuard();
  const { teams } = useTeams();
  const { assignees } = useTaskAssignees(task?.id);
  const isEditing = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'simple',
      status: 'pending',
      priority: 'medium',
      assigned_to: null,
      assigned_user_ids: [],
      assigned_team_ids: [],
      due_date: null,
      area_ids: [],
      tag_ids: [],
      goal_target_value: null,
      goal_unit: null,
      operation_type: null,
      scheduled_at: null,
      location_type: null,
      location_text: null,
      location_notes: null,
      reservation_ref: null,
      customer_name: null,
      customer_phone: null,
      vehicle_out_id: null,
      vehicle_in_id: null,
      primary_assignee_id: null,
      has_support_leg: false,
      support_assignee_id: null,
    },
  });

  const watchType = form.watch('type');

  // Effect para cargar datos iniciales cuando se abre el formulario
  useEffect(() => {
    if (!open) return;
    
    if (task) {
      // Get existing assignees from the task_assignees table
      const existingUserIds = assignees?.filter(a => a.user_id).map(a => a.user_id!) || [];
      const existingTeamIds = assignees?.filter(a => a.team_id).map(a => a.team_id!) || [];
      
      form.reset({
        title: task.title,
        description: task.description || '',
        type: task.type as TaskFormValues['type'],
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to,
        assigned_user_ids: existingUserIds,
        assigned_team_ids: existingTeamIds,
        due_date: task.due_date ? new Date(task.due_date) : null,
        area_ids: task.areas.map((a) => a.id),
        tag_ids: task.tags?.map((t) => t.id) || [],
        goal_target_value: task.goal_target_value,
        goal_unit: task.goal_unit,
        operation_type: task.operation_type,
        scheduled_at: task.scheduled_at,
        location_type: task.location_type,
        location_text: task.location_text,
        location_notes: task.location_notes,
        reservation_ref: task.reservation_ref,
        customer_name: task.customer_name,
        customer_phone: task.customer_phone,
        vehicle_out_id: task.vehicle_out_id,
        vehicle_in_id: task.vehicle_in_id,
        primary_assignee_id: task.assigned_to,
        has_support_leg: false,
        support_assignee_id: null,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        type: 'simple',
        status: 'pending',
        priority: 'medium',
        assigned_to: null,
        assigned_user_ids: [],
        assigned_team_ids: [],
        due_date: null,
        area_ids: [],
        tag_ids: [],
        goal_target_value: null,
        goal_unit: null,
        operation_type: null,
        scheduled_at: null,
        location_type: null,
        location_text: null,
        location_notes: null,
        reservation_ref: null,
        customer_name: null,
        customer_phone: null,
        vehicle_out_id: null,
        vehicle_in_id: null,
        primary_assignee_id: null,
        has_support_leg: false,
        support_assignee_id: null,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  // Effect separado para actualizar asignados cuando se cargan después
  useEffect(() => {
    if (!open || !task || !assignees?.length) return;
    
    const currentUserIds = form.getValues('assigned_user_ids');
    const currentTeamIds = form.getValues('assigned_team_ids');
    
    // Solo actualizar si están vacíos (primera carga de assignees)
    if (currentUserIds.length === 0 && currentTeamIds.length === 0) {
      const existingUserIds = assignees.filter(a => a.user_id).map(a => a.user_id!);
      const existingTeamIds = assignees.filter(a => a.team_id).map(a => a.team_id!);
      
      form.setValue('assigned_user_ids', existingUserIds);
      form.setValue('assigned_team_ids', existingTeamIds);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignees, open, task?.id]);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!checkOnline(isEditing ? 'update' : 'create')) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: values.title!,
        description: values.description,
        type: values.type!,
        status: values.status!,
        priority: values.priority!,
        assigned_to: values.type === 'operation' ? values.primary_assignee_id ?? null : values.assigned_to ?? null,
        assigned_user_ids: values.assigned_user_ids ?? [],
        assigned_team_ids: values.assigned_team_ids ?? [],
        due_date: values.due_date ?? null,
        area_ids: values.area_ids!,
        tag_ids: values.tag_ids!,
        goal_target_value: values.goal_target_value ?? null,
        goal_unit: values.goal_unit ?? null,
        operation_type: values.operation_type,
        scheduled_at: values.scheduled_at,
        location_type: values.location_type,
        location_text: values.location_text,
        location_notes: values.location_notes,
        reservation_ref: values.reservation_ref,
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        vehicle_out_id: values.vehicle_out_id,
        vehicle_in_id: values.vehicle_in_id,
        primary_assignee_id: values.primary_assignee_id,
        has_support_leg: values.has_support_leg,
        support_assignee_id: values.support_assignee_id,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAreas = areas.filter((a) => !a.is_archived);
  const isOperation = watchType === 'operation';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modifica los datos de la tarea.'
              : 'Crea una nueva tarea para organizar tu trabajo.'}
          </SheetDescription>
        </SheetHeader>

        <FormProvider {...form}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la tarea" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isOperation && (
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descripción opcional de la tarea"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Task Type Selector */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de tarea</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isEditing && (
                      <p className="text-xs text-muted-foreground">
                        El tipo no se puede cambiar después de crear la tarea
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Operation-specific fields */}
              {isOperation && (
                <OperationFormSection members={members} />
              )}

              {/* Goal Fields - only shown for goal_numeric type */}
              {watchType === 'goal_numeric' && (
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                  <FormField
                    control={form.control}
                    name="goal_target_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad objetivo *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="Ej: 3000"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val === '' ? null : parseFloat(val));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goal_unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: €, libros, km"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Standard fields - not for operations */}
              {!isOperation && (
                <>
                  <div className="grid grid-cols-2 gap-4">
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
                              {TASK_STATUS_OPTIONS.map((option) => (
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
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioridad</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona prioridad" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TASK_PRIORITY_OPTIONS.map((option) => (
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
                  </div>

                  <FormItem>
                    <FormLabel>Asignado a</FormLabel>
                    <MultiAssigneeSelect
                      members={members.map(m => ({ id: m.user_id, user_id: m.user_id, name: m.name }))}
                      teams={teams}
                      selectedUserIds={form.watch('assigned_user_ids')}
                      selectedTeamIds={form.watch('assigned_team_ids')}
                      onChangeUsers={(ids) => form.setValue('assigned_user_ids', ids)}
                      onChangeTeams={(ids) => form.setValue('assigned_team_ids', ids)}
                    />
                  </FormItem>

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

                  <FormField
                    control={form.control}
                    name="area_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Áreas *</FormLabel>
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                          {activeAreas.map((area) => (
                            <div key={area.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`task-area-${area.id}`}
                                checked={field.value.includes(area.id)}
                                onCheckedChange={(checked) => {
                                  const newValue = checked
                                    ? [...field.value, area.id]
                                    : field.value.filter((id) => id !== area.id);
                                  field.onChange(newValue);
                                }}
                              />
                              <Label
                                htmlFor={`task-area-${area.id}`}
                                className="text-sm font-normal cursor-pointer flex items-center gap-2"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: area.color || '#4F46E5' }}
                                />
                                {area.name}
                              </Label>
                            </div>
                          ))}
                          {activeAreas.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No hay áreas disponibles. Crea una primero.
                            </p>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tag_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Etiquetas</FormLabel>
                        <FormControl>
                          <TagSelector
                            tags={tags}
                            selectedTagIds={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Guardando...'
                    : isEditing
                    ? 'Guardar cambios'
                    : 'Crear tarea'}
                </Button>
              </div>
            </form>
          </Form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  );
}
