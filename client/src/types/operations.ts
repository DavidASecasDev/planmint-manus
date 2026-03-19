export type OperationType = 'delivery' | 'pickup' | 'swap';
export type LocationType = 'hotel' | 'villa' | 'airport' | 'office' | 'other';
export type LegType = 'primary' | 'support';
export type LegStatus = 'pending' | 'en_route' | 'done' | 'issue';

export interface OperationLeg {
  id: string;
  organization_id: string;
  task_id: string;
  leg_type: LegType;
  assignee_id: string | null;
  status: LegStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  checklist_json: Record<string, boolean>;
  notes: string | null;
  created_at: string;
  assignee?: {
    id: string;
    name: string | null;
  } | null;
}

export interface OperationData {
  operation_type: OperationType | null;
  scheduled_at: string | null;
  location_type: LocationType | null;
  location_text: string | null;
  location_notes: string | null;
  reservation_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle_out_id: string | null;
  vehicle_in_id: string | null;
}

export interface CreateOperationLegData {
  task_id: string;
  leg_type: LegType;
  assignee_id?: string | null;
  scheduled_at?: string | null;
  checklist_json?: Record<string, boolean>;
  notes?: string | null;
}

export interface UpdateOperationLegData {
  status?: LegStatus;
  assignee_id?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  checklist_json?: Record<string, boolean>;
  notes?: string | null;
}

export const OPERATION_TYPE_OPTIONS: { value: OperationType; label: string; icon: string }[] = [
  { value: 'delivery', label: 'Entrega', icon: 'truck' },
  { value: 'pickup', label: 'Recogida', icon: 'package' },
  { value: 'swap', label: 'Cambio', icon: 'repeat' },
];

export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'villa', label: 'Villa' },
  { value: 'airport', label: 'Aeropuerto' },
  { value: 'office', label: 'Oficina' },
  { value: 'other', label: 'Otro' },
];

export const LEG_STATUS_OPTIONS: { value: LegStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pendiente', color: 'bg-yellow-500' },
  { value: 'en_route', label: 'En camino', color: 'bg-blue-500' },
  { value: 'done', label: 'Completado', color: 'bg-green-500' },
  { value: 'issue', label: 'Incidencia', color: 'bg-red-500' },
];

export const DEFAULT_CHECKLIST: Record<string, { label: string; default: boolean }> = {
  keys_ok: { label: 'Llaves entregadas', default: false },
  documents_ok: { label: 'Documentación completa', default: false },
  photos_done: { label: 'Fotos tomadas', default: false },
  vehicle_inspected: { label: 'Vehículo inspeccionado', default: false },
  customer_signed: { label: 'Cliente firmado', default: false },
};
