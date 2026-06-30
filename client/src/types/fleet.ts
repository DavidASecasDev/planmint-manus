export type FleetVehicleStatus = 'activo' | 'devuelto' | 'pendiente_recogida';

export interface FleetVehicle {
  id: string;
  organization_id: string;
  matricula: string;
  modelo: string | null;
  categoria: string | null;
  proveedor: string | null;
  numero_contrato: string | null;
  numero_bastidor: string | null;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  km_recogida: number | null;
  km_devolucion: number | null;
  status: FleetVehicleStatus;
  notas: string | null;
  photo_url: string | null;
  marca: string | null;
  color: string | null;
  combustible: string | null;
  hibrido: boolean | null;
  motor: string | null;
  cv: number | null;
  traccar_device_id: string | null;
  xexun_imei: string | null;
  created_at: string;
  updated_at: string;
}

export type FleetDamageStatus = 'pendiente' | 'en_reparacion' | 'reparado';
export type FleetDamageOrigin = 'reserva' | 'movimiento_empleado';

export interface FleetVehicleDamage {
  id: string;
  fleet_vehicle_id: string;
  organization_id: string;
  zona: string;
  pieza: string | null;
  descripcion: string | null;
  severidad: string;
  photo_url: string | null;
  origin_type: FleetDamageOrigin;
  reservation_id: string | null;
  has_premium_coverage: boolean;
  repair_id: string | null;
  damage_report_id: string | null;
  status: FleetDamageStatus;
  croquis_x: number | null;
  croquis_y: number | null;
  reported_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const FLEET_DAMAGE_STATUS_OPTIONS: { value: FleetDamageStatus; label: string; color: string }[] = [
  { value: 'pendiente', label: 'Pendiente', color: 'hsl(0, 84%, 60%)' },
  { value: 'en_reparacion', label: 'En reparación', color: 'hsl(25, 95%, 53%)' },
  { value: 'reparado', label: 'Reparado', color: 'hsl(142, 76%, 36%)' },
];

export const FLEET_DAMAGE_PIECES: { zona: string; piezas: string[] }[] = [
  { zona: 'frontal', piezas: ['Parachoques delantero', 'Capó', 'Faro izquierdo', 'Faro derecho', 'Rejilla', 'Matrícula delantera', 'Parabrisas'] },
  { zona: 'trasera', piezas: ['Parachoques trasero', 'Portón/Maletero', 'Piloto izquierdo', 'Piloto derecho', 'Luneta trasera', 'Matrícula trasera'] },
  { zona: 'lateral_izq', piezas: ['Aleta delantera izq.', 'Puerta delantera izq.', 'Puerta trasera izq.', 'Aleta trasera izq.', 'Estribo izq.', 'Retrovisor izq.', 'Ventanilla del. izq.', 'Ventanilla tras. izq.'] },
  { zona: 'lateral_der', piezas: ['Aleta delantera der.', 'Puerta delantera der.', 'Puerta trasera der.', 'Aleta trasera der.', 'Estribo der.', 'Retrovisor der.', 'Ventanilla del. der.', 'Ventanilla tras. der.'] },
  { zona: 'techo', piezas: ['Techo', 'Pilar A izq.', 'Pilar A der.', 'Pilar B izq.', 'Pilar B der.', 'Pilar C izq.', 'Pilar C der.'] },
  { zona: 'ruedas', piezas: ['Llanta del. izq.', 'Llanta del. der.', 'Llanta tras. izq.', 'Llanta tras. der.', 'Neumático del. izq.', 'Neumático del. der.', 'Neumático tras. izq.', 'Neumático tras. der.'] },
  { zona: 'interior', piezas: ['Salpicadero', 'Volante', 'Asiento conductor', 'Asiento copiloto', 'Asientos traseros', 'Consola central', 'Tapizado puerta', 'Techo interior'] },
];

export type InspectionType = 'recogida' | 'devolucion';

export interface FleetVehicleInspection {
  id: string;
  fleet_vehicle_id: string;
  organization_id: string;
  inspection_type: InspectionType;
  inspection_date: string;
  km: number | null;
  nivel_combustible: string | null;
  notas: string | null;
  inspector_id: string | null;
  receipt_url: string | null;
  created_at: string;
  // Joined
  inspector_profile?: { name: string | null } | null;
  photos?: FleetInspectionPhoto[];
  damages?: FleetInspectionDamage[];
}

export type DamageSeverity = 'leve' | 'moderado' | 'grave';

export interface FleetInspectionDamage {
  id: string;
  inspection_id: string;
  organization_id: string;
  zona: string;
  pieza: string | null;
  descripcion: string | null;
  severidad: DamageSeverity;
}

export type PhotoCategory =
  | 'frontal'
  | 'trasera'
  | 'lateral_izq'
  | 'lateral_der'
  | 'interior'
  | 'salpicadero'
  | 'maletero'
  | 'motor'
  | 'rueda_del_der'
  | 'rueda_del_izq'
  | 'rueda_tras_der'
  | 'rueda_tras_izq'
  | 'ruedas'
  | 'dano_detalle'
  | 'general';

export interface FleetInspectionPhoto {
  id: string;
  inspection_id: string;
  organization_id: string;
  storage_path: string;
  file_name: string;
  photo_category: PhotoCategory;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PhotoCategoryGroup {
  group: string;
  items: { key: PhotoCategory; label: string }[];
}

export const PHOTO_CATEGORIES: { key: PhotoCategory; label: string }[] = [
  { key: 'frontal', label: 'Frontal' },
  { key: 'trasera', label: 'Trasera' },
  { key: 'lateral_izq', label: 'Lateral Izquierdo' },
  { key: 'lateral_der', label: 'Lateral Derecho' },
  { key: 'interior', label: 'Interior' },
  { key: 'salpicadero', label: 'Salpicadero' },
  { key: 'maletero', label: 'Maletero' },
  { key: 'motor', label: 'Motor' },
  { key: 'rueda_del_der', label: 'Rueda Del. Derecha' },
  { key: 'rueda_del_izq', label: 'Rueda Del. Izquierda' },
  { key: 'rueda_tras_der', label: 'Rueda Tras. Derecha' },
  { key: 'rueda_tras_izq', label: 'Rueda Tras. Izquierda' },
  { key: 'ruedas', label: 'Ruedas (General)' },
  { key: 'dano_detalle', label: 'Detalle de Daño' },
  { key: 'general', label: 'General' },
];

export const PHOTO_CATEGORY_GROUPS: PhotoCategoryGroup[] = [
  {
    group: 'Exterior',
    items: [
      { key: 'frontal', label: 'Frontal' },
      { key: 'trasera', label: 'Trasera' },
      { key: 'lateral_izq', label: 'Lat. Izquierdo' },
      { key: 'lateral_der', label: 'Lat. Derecho' },
    ],
  },
  {
    group: 'Interior',
    items: [
      { key: 'interior', label: 'Interior' },
      { key: 'salpicadero', label: 'Salpicadero' },
      { key: 'maletero', label: 'Maletero' },
      { key: 'motor', label: 'Motor' },
    ],
  },
  {
    group: 'Ruedas',
    items: [
      { key: 'rueda_del_izq', label: 'Del. Izquierda' },
      { key: 'rueda_del_der', label: 'Del. Derecha' },
      { key: 'rueda_tras_izq', label: 'Tras. Izquierda' },
      { key: 'rueda_tras_der', label: 'Tras. Derecha' },
    ],
  },
  {
    group: 'Otros',
    items: [
      { key: 'dano_detalle', label: 'Detalle Daño' },
      { key: 'general', label: 'General' },
    ],
  },
];

export const FLEET_STATUS_OPTIONS: { value: FleetVehicleStatus; label: string; color: string }[] = [
  { value: 'activo', label: 'Activo', color: 'hsl(142, 76%, 36%)' },
  { value: 'pendiente_recogida', label: 'Pendiente Recogida', color: 'hsl(25, 95%, 53%)' },
  { value: 'devuelto', label: 'Devuelto', color: 'hsl(217, 91%, 60%)' },
];

export const DAMAGE_ZONES: { key: string; label: string }[] = [
  { key: 'frontal', label: 'Frontal' },
  { key: 'trasera', label: 'Trasera' },
  { key: 'lateral_izq', label: 'Lateral Izquierdo' },
  { key: 'lateral_der', label: 'Lateral Derecho' },
  { key: 'techo', label: 'Techo / Pilares' },
  { key: 'ruedas', label: 'Ruedas' },
  { key: 'interior', label: 'Interior' },
];
