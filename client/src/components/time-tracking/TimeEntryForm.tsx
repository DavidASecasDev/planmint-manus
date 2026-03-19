import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTasks } from '@/hooks/useTasks';
import { CreateTimeEntryData } from '@/types/timeTracking';

const formSchema = z.object({
  description: z.string().optional(),
  task_id: z.string().optional(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  is_billable: z.boolean(),
  hourly_rate: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TimeEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTimeEntryData) => void;
  initialData?: Partial<CreateTimeEntryData>;
}

export function TimeEntryForm({ open, onOpenChange, onSubmit, initialData }: TimeEntryFormProps) {
  const { tasks } = useTasks();
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = format(new Date(), 'HH:mm');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: initialData?.description || '',
      task_id: initialData?.task_id || '',
      date: today,
      start_time: now,
      end_time: now,
      is_billable: initialData?.is_billable ?? true,
      hourly_rate: initialData?.hourly_rate || undefined,
    },
  });

  const handleSubmit = (data: FormData) => {
    const startDateTime = new Date(`${data.date}T${data.start_time}`);
    const endDateTime = new Date(`${data.date}T${data.end_time}`);
    
    // Calculate duration in minutes
    const durationMs = endDateTime.getTime() - startDateTime.getTime();
    const durationMinutes = Math.max(1, Math.floor(durationMs / 60000));

    onSubmit({
      description: data.description || null,
      task_id: data.task_id || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_minutes: durationMinutes,
      is_billable: data.is_billable,
      hourly_rate: data.hourly_rate || null,
    });

    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir tiempo manualmente</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="¿En qué trabajaste?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="task_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarea (opcional)</FormLabel>
                  <Select 
                    value={field.value || 'none'} 
                    onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tarea" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin tarea</SelectItem>
                      {activeTasks.map(task => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inicio</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_billable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Facturable</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Marcar como tiempo facturable al cliente
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
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
