import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganizationMembers } from '@/hooks/usePermissions';

const DAY_LABELS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

interface DailyTaskTemplateFormProps {
  onSubmit: (data: { title: string; description?: string; weekdays?: number[] | null; assigned_to?: string | null }) => void;
  isLoading: boolean;
  initialData?: { title: string; description?: string | null; weekdays?: number[] | null; assigned_to?: string | null };
}

export function DailyTaskTemplateForm({ onSubmit, isLoading, initialData }: DailyTaskTemplateFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [weekdays, setWeekdays] = useState<string[]>(
    initialData?.weekdays?.map(String) ?? []
  );
  const [assignedTo, setAssignedTo] = useState<string>(initialData?.assigned_to ?? '__all__');

  const { members } = useOrganizationMembers();
  const activeMembers = members.filter(m => m.status === 'active');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description ?? '');
      setWeekdays(initialData.weekdays?.map(String) ?? []);
      setAssignedTo(initialData.assigned_to ?? '__all__');
    }
  }, [initialData]);

  const isEditMode = !!initialData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const selectedDays = weekdays.map(Number);
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      weekdays: selectedDays.length > 0 ? selectedDays : null,
      assigned_to: assignedTo === '__all__' ? null : assignedTo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Nombre de la tarea *</Label>
        <Input
          id="title"
          placeholder="Ej: Revisar emails, Cerrar caja..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea
          id="description"
          placeholder="Instrucciones o detalles adicionales..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Asignar a</Label>
        <Select value={assignedTo} onValueChange={setAssignedTo}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {activeMembers.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.profile?.name || 'Sin nombre'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Si seleccionas "Todos", cualquier miembro podrá completarla</p>
      </div>
      <div className="space-y-2">
        <Label>Días de la semana</Label>
        <p className="text-xs text-muted-foreground">Si no seleccionas ninguno, aparecerá todos los días</p>
        <ToggleGroup
          type="multiple"
          value={weekdays}
          onValueChange={setWeekdays}
          className="justify-start"
        >
          {DAY_LABELS.map((day) => (
            <ToggleGroupItem
              key={day.value}
              value={String(day.value)}
              aria-label={day.label}
              className="w-9 h-9 text-xs font-medium"
            >
              {day.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Button type="submit" disabled={isLoading || !title.trim()} className="w-full">
        {isLoading
          ? (isEditMode ? 'Guardando...' : 'Creando...')
          : (isEditMode ? 'Guardar cambios' : 'Crear tarea diaria')}
      </Button>
    </form>
  );
}
