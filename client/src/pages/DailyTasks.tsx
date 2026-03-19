import { useState } from 'react';
import { useDailyTasks } from '@/hooks/useDailyTasks';
import { DailyTaskList } from '@/components/daily-tasks/DailyTaskList';
import { DailyTaskTemplateForm } from '@/components/daily-tasks/DailyTaskTemplateForm';
import { DailyTaskHistory } from '@/components/daily-tasks/DailyTaskHistory';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, History, Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function DailyTasks() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { tasks, isLoading, canManage, canComplete, canViewOtherDays, completeTask, isCompleting, uncompleteTask, isUncompleting, createTemplate, isCreating, deleteTemplate, updateTemplate, isUpdating } = useDailyTasks(selectedDate);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<{ id: string; title: string; description: string | null; weekdays: number[] | null; assigned_to: string | null } | null>(null);

  const handleCreate = (data: { title: string; description?: string; weekdays?: number[] | null; assigned_to?: string | null }) => {
    createTemplate(data, {
      onSuccess: () => setCreateOpen(false),
    });
  };

  const handleEdit = (task: { id: string; title: string; description: string | null; weekdays: number[] | null; assigned_to: string | null }) => {
    setEditingTask(task);
    setEditOpen(true);
  };

  const handleUpdate = (data: { title: string; description?: string; weekdays?: number[] | null; assigned_to?: string | null }) => {
    if (!editingTask) return;
    updateTemplate({ id: editingTask.id, ...data }, {
      onSuccess: () => {
        setEditOpen(false);
        setEditingTask(null);
      },
    });
  };

  const goToToday = () => setSelectedDate(new Date());
  const goPrev = () => setSelectedDate((d) => subDays(d, 1));
  const goNext = () => setSelectedDate((d) => addDays(d, 1));

  const isCurrentDay = isToday(selectedDate);
  const formattedDate = format(selectedDate, "EEEE d 'de' MMMM", { locale: es });

  return (
    <AppLayout title="Tareas Diarias">
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tareas Diarias</h1>
            <p className="text-muted-foreground text-sm">
              Tareas recurrentes que se reinician automáticamente cada día
            </p>
          </div>
          {canManage && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva tarea
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear tarea diaria</DialogTitle>
                </DialogHeader>
                <DailyTaskTemplateForm
                  onSubmit={handleCreate}
                  isLoading={isCreating}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Date Navigator - only visible with view_other_days permission */}
        {canViewOtherDays && (
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium min-w-[200px] justify-center',
              isCurrentDay ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              <CalendarDays className="h-4 w-4" />
              <span className="capitalize">{formattedDate}</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentDay && (
              <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
                Hoy
              </Button>
            )}
          </div>
        )}

        <Tabs defaultValue="today" className="w-full">
          <TabsList>
            <TabsTrigger value="today" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {isCurrentDay ? 'Hoy' : 'Tareas'}
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="today" className="mt-4">
            <DailyTaskList
              tasks={tasks}
              isLoading={isLoading}
              onComplete={(templateId) => completeTask({ templateId })}
              onUncomplete={(completionId) => uncompleteTask(completionId)}
              isCompleting={isCompleting}
              isUncompleting={isUncompleting}
              canManage={canManage}
              canComplete={canComplete}
              onDelete={deleteTemplate}
              onEdit={handleEdit}
              selectedDate={selectedDate}
            />
          </TabsContent>
          {canManage && (
            <TabsContent value="history" className="mt-4">
              <DailyTaskHistory />
            </TabsContent>
          )}
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingTask(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar tarea diaria</DialogTitle>
            </DialogHeader>
            {editingTask && (
              <DailyTaskTemplateForm
                onSubmit={handleUpdate}
                isLoading={isUpdating}
                initialData={{ title: editingTask.title, description: editingTask.description, weekdays: editingTask.weekdays, assigned_to: editingTask.assigned_to }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
