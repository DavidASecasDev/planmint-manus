// Equipment inventory types

export type EquipmentTipo = 'silla_bebe' | 'silla_infantes' | 'elevador' | 'gps' | 'wifi' | 'otro';
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

/** Labels for display */
export const EQUIPMENT_TIPO_LABELS: Record<EquipmentTipo, string> = {
  silla_bebe: 'Silla de Bebé',
  silla_infantes: 'Silla de Infantes',
  elevador: 'Asiento Elevador',
  gps: 'GPS',
  wifi: 'WiFi Portátil',
  otro: 'Otro',
};

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
