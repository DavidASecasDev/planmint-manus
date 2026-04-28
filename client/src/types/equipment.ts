// Equipment inventory types

export type EquipmentTipo = 'recien_nacido' | 'silla_infantes' | 'silla_nino' | 'elevador' | 'gps' | 'wifi' | 'otro';
export type EquipmentEstado = 'disponible' | 'asignada' | 'mantenimiento' | 'baja';
export type EquipmentCondition = 'bueno' | 'aceptable' | 'dañado' | 'reparar';

export interface EquipmentItem {
  id: string;
  organization_id: string;
  tipo: EquipmentTipo;
  nombre: string;
  codigo: string;
  estado: EquipmentEstado;
  reservation_id: string | null;
  vehicle_matricula: string | null;
  notas: string | null;
  fecha_compra: string | null;
  fecha_ultima_revision: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentAssignment {
  id: string;
  equipment_id: string;
  reservation_id: string | null;
  vehicle_matricula: string | null;
  assigned_at: string;
  returned_at: string | null;
  assigned_by: string | null;
  returned_by: string | null;
  condition_out: string;
  condition_in: string | null;
  notes: string | null;
  created_at: string;
}

/** Labels for display — grouped by child safety seat classification */
export const EQUIPMENT_TIPO_LABELS: Record<EquipmentTipo, string> = {
  recien_nacido: 'Grupo 0 · Recién nacido (0-9 kg)',
  silla_infantes: 'Grupo 1 · Silla Infantes (9-18 kg)',
  silla_nino: 'Grupo 2 · Silla niño (18-36 kg)',
  elevador: 'Grupo 3 · Asiento Elevador (+36 kg)',
  gps: 'GPS',
  wifi: 'WiFi Portátil',
  otro: 'Otro',
};

/** Short labels for compact UI (badges, table cells) */
export const EQUIPMENT_TIPO_SHORT_LABELS: Record<EquipmentTipo, string> = {
  recien_nacido: 'Recién nacido',
  silla_infantes: 'Silla Infantes',
  silla_nino: 'Silla niño',
  elevador: 'Asiento Elevador',
  gps: 'GPS',
  wifi: 'WiFi Portátil',
  otro: 'Otro',
};

/** Seat-type identifiers (child safety seats only) */
export const SEAT_TIPOS: EquipmentTipo[] = ['recien_nacido', 'silla_infantes', 'silla_nino', 'elevador'];

export const EQUIPMENT_ESTADO_LABELS: Record<EquipmentEstado, string> = {
  disponible: 'Disponible',
  asignada: 'Asignada',
  mantenimiento: 'En Mantenimiento',
  baja: 'Baja',
};

export const EQUIPMENT_ESTADO_COLORS: Record<EquipmentEstado, string> = {
  disponible: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  asignada: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  mantenimiento: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  baja: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  bueno: 'Bueno',
  aceptable: 'Aceptable',
  dañado: 'Dañado',
  reparar: 'Necesita reparación',
};

/** Columns for the kanban board */
export const EQUIPMENT_KANBAN_COLUMNS: EquipmentEstado[] = ['disponible', 'asignada', 'mantenimiento', 'baja'];
