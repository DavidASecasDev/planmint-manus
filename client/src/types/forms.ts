// Form Builder module types

export type FormFieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'email' 
  | 'phone' 
  | 'date' 
  | 'datetime' 
  | 'select' 
  | 'multi_select' 
  | 'checkbox' 
  | 'file' 
  | 'rating';

export interface FormFieldOption {
  value: string;
  label: string;
}

export type FormEntityType = 'task' | 'transfer_request' | 'none';

export interface FormField {
  id: string;
  form_id: string;
  name: string;
  label: string;
  type: FormFieldType;
  is_required: boolean;
  placeholder: string | null;
  help_text: string | null;
  default_value: string | null;
  options: FormFieldOption[] | null;
  min_length: number | null;
  max_length: number | null;
  min_value: number | null;
  max_value: number | null;
  pattern: string | null;
  maps_to_task_field: string | null;
  position: number;
  width: 'full' | 'half';
  conditions: unknown | null;
  maps_to_transfer_field: string | null;
  created_at: string;
}

export interface Form {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  is_active: boolean;
  requires_auth: boolean;
  create_task_on_submit: boolean;
  default_area_id: string | null;
  default_assignee_id: string | null;
  default_task_type: string;
  default_task_priority: string;
  success_message: string | null;
  redirect_url: string | null;
  custom_logo_url: string | null;
  primary_color: string | null;
  max_responses: number | null;
  expires_at: string | null;
  response_count: number;
  entity_type: FormEntityType;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FormWithFields extends Form {
  fields: FormField[];
}

export interface FormResponse {
  id: string;
  form_id: string;
  organization_id: string;
  data: Record<string, unknown>;
  submitted_by: string | null;
  submitter_email: string | null;
  submitter_name: string | null;
  submitter_ip: string | null;
  created_task_id: string | null;
  status: 'new' | 'reviewed' | 'processed' | 'archived';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface FormResponseWithRelations extends FormResponse {
  form?: {
    id: string;
    name: string;
  };
  created_task?: {
    id: string;
    title: string;
  } | null;
}

export interface CreateFormData {
  name: string;
  description?: string | null;
  slug: string;
  is_public?: boolean;
  is_active?: boolean;
  requires_auth?: boolean;
  create_task_on_submit?: boolean;
  default_area_id?: string | null;
  default_assignee_id?: string | null;
  default_task_type?: string;
  default_task_priority?: string;
  success_message?: string | null;
  redirect_url?: string | null;
  custom_logo_url?: string | null;
  primary_color?: string | null;
  max_responses?: number | null;
  expires_at?: string | null;
  entity_type?: FormEntityType;
}

export interface CreateFormFieldData {
  form_id: string;
  name: string;
  label: string;
  type: FormFieldType;
  is_required?: boolean;
  placeholder?: string | null;
  help_text?: string | null;
  default_value?: string | null;
  options?: FormFieldOption[] | null;
  min_length?: number | null;
  max_length?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  pattern?: string | null;
  maps_to_task_field?: string | null;
  maps_to_transfer_field?: string | null;
  position?: number;
  width?: 'full' | 'half';
}

export interface SubmitFormData {
  form_id: string;
  data: Record<string, unknown>;
  submitter_email?: string;
  submitter_name?: string;
}

// Field type metadata for UI
export const FORM_FIELD_TYPES: { value: FormFieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Texto corto', icon: 'Type' },
  { value: 'textarea', label: 'Texto largo', icon: 'AlignLeft' },
  { value: 'number', label: 'Número', icon: 'Hash' },
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'phone', label: 'Teléfono', icon: 'Phone' },
  { value: 'date', label: 'Fecha', icon: 'Calendar' },
  { value: 'datetime', label: 'Fecha y hora', icon: 'Clock' },
  { value: 'select', label: 'Selección única', icon: 'ChevronDown' },
  { value: 'multi_select', label: 'Selección múltiple', icon: 'CheckSquare' },
  { value: 'checkbox', label: 'Casilla', icon: 'Square' },
  { value: 'file', label: 'Archivo', icon: 'Upload' },
  { value: 'rating', label: 'Valoración', icon: 'Star' },
];

// Task field mapping options
export const TASK_FIELD_MAPPINGS: { value: string; label: string }[] = [
  { value: 'title', label: 'Título de la tarea' },
  { value: 'description', label: 'Descripción' },
  { value: 'due_date', label: 'Fecha límite' },
  { value: 'priority', label: 'Prioridad' },
];

// Transfer field mapping options
export const TRANSFER_FIELD_MAPPINGS: { value: string; label: string }[] = [
  { value: 'broker_name', label: 'Nombre del broker' },
  { value: 'client_name', label: 'Nombre del cliente' },
  { value: 'notes', label: 'Notas generales' },
  { value: 'transfer_date', label: 'Fecha del transfer' },
  { value: 'pickup_time', label: 'Hora de recogida' },
  { value: 'pickup_location', label: 'Punto de recogida' },
  { value: 'dropoff_location', label: 'Punto de llegada' },
  { value: 'pax_count', label: 'Número de pasajeros' },
  { value: 'item_notes', label: 'Notas del trayecto' },
];
