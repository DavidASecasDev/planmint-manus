export type VehicleStatus = 'sucio' | 'incompleto' | 'limpio' | 'en_servicio' | 'alquilado';

export type ServiceType = 'reparacion' | 'bloqueo';

export interface VehicleLocation {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  organization_id: string;
  matricula: string;
  modelo: string | null;
  categoria: string | null;
  status: VehicleStatus;
  current_reservation_id: string | null;
  last_status_change: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Archiving fields
  is_archived: boolean | null;
  archived_at: string | null;
  archived_by: string | null;
  // Cleaning tracking fields
  cleaned_by: string | null;
  cleaned_at: string | null;
  location_id: string | null;
  // Service tracking fields
  service_type: ServiceType | null;
  service_notes: string | null;
  // Fleet linkage
  fleet_vehicle_id: string | null;
  // Repair tracking
  is_in_repair: boolean | null;
  current_repair_id: string | null;
}

export interface FleetVehicleInfo {
  id: string;
  marca: string | null;
  color: string | null;
  combustible: string | null;
  numero_bastidor: string | null;
  numero_contrato: string | null;
  proveedor: string | null;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  km_recogida: number | null;
  km_devolucion: number | null;
  photo_url: string | null;
}

export interface VehicleWithTasks extends Vehicle {
  cleaning_tasks: VehicleCleaningTask[];
  current_reservation?: {
    cliente_nombre: string | null;
    cliente_apellido: string | null;
  } | null;
  // Joined data
  location?: VehicleLocation | null;
  cleaned_by_profile?: { name: string | null } | null;
  // Fleet data (from fleet_vehicles via fleet_vehicle_id)
  fleet_info?: FleetVehicleInfo | null;
  // Active repair info
  active_repair?: {
    id: string;
    repair_type: string;
    description: string | null;
    status: string;
  } | null;
  // Parking spot info (zone abbreviation + spot number)
  parking_spot?: {
    zone_name: string;
    spot_number: number;
  } | null;
}

export interface VehicleCleaningTask {
  id: string;
  vehicle_id: string;
  task_key: CleaningTaskKey;
  completed: boolean | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string | null;
  notes: string | null;
  // Profile of who completed the task
  completed_by_profile?: { name: string | null } | null;
}

export type CleaningTaskKey = 
  | 'inicio_prep'
  | 'repostaje' 
  | 'presion' 
  | 'avisos' 
  | 'borrado' 
  | 'limpieza_int' 
  | 'limpieza_ext';

export const CLEANING_TASKS: { key: CleaningTaskKey; label: string; icon: string }[] = [
  { key: 'inicio_prep', label: 'Inicio preparación', icon: 'PlayCircle' },
  { key: 'repostaje', label: 'Repostaje', icon: 'Fuel' },
  { key: 'presion', label: 'Presión neumáticos', icon: 'Gauge' },
  { key: 'avisos', label: 'Avisos mantenimiento', icon: 'AlertTriangle' },
  { key: 'borrado', label: 'Borrado dispositivos', icon: 'Smartphone' },
  { key: 'limpieza_int', label: 'Limpieza interior', icon: 'Sparkles' },
  { key: 'limpieza_ext', label: 'Limpieza exterior', icon: 'Droplets' },
];

export const VEHICLE_STATUS_COLUMNS: { status: VehicleStatus; label: string; color: string }[] = [
  { status: 'sucio', label: 'Sucio', color: 'hsl(0, 84%, 60%)' },
  { status: 'incompleto', label: 'Incompleto', color: 'hsl(25, 95%, 53%)' },
  { status: 'limpio', label: 'Limpio', color: 'hsl(142, 76%, 36%)' },
  { status: 'en_servicio', label: 'En Servicio', color: 'hsl(280, 65%, 60%)' },
  { status: 'alquilado', label: 'Alquilado', color: 'hsl(217, 91%, 60%)' },
];

export interface InactiveVehicle {
  vehicle_id: string;
  matricula: string;
  modelo: string | null;
  categoria: string | null;
  last_reservation_date: string | null;
  is_suspicious: boolean;
}

export interface VehicleFilters {
  search: string;
  locationId: string; // 'all' | 'none' | location_id
  cleaningStatus: 'all' | 'none' | 'partial' | 'complete';
}
