export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly';

export interface Reminder {
  id: string;
  task_id: string;
  remind_at: string;
  recurrence_type: RecurrenceType;
  recurrence_interval: number | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface ReminderWithTask extends Reminder {
  task: {
    id: string;
    title: string;
    status: string;
    type: string;
    priority: string;
    created_by: string;
    assigned_to: string | null;
    organization_id: string;
  };
}

export const RECURRENCE_TYPE_OPTIONS = [
  { value: 'once', label: 'Una sola vez' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
] as const;

export const getRecurrenceLabel = (type: RecurrenceType, interval: number | null): string => {
  switch (type) {
    case 'once':
      return 'Una sola vez';
    case 'daily':
      return interval === 1 ? 'Cada día' : `Cada ${interval} días`;
    case 'weekly':
      return interval === 1 ? 'Cada semana' : `Cada ${interval} semanas`;
    case 'monthly':
      return interval === 1 ? 'Cada mes' : `Cada ${interval} meses`;
    default:
      return 'Desconocido';
  }
};
