// Types for the Transfers module — Simplified request/acceptance model

export type TransferRequestStatus = 'pendiente' | 'aceptado' | 'conductor_asignado' | 'en_curso' | 'completado' | 'rechazado' | 'cancelado';

export type TransferItemStatus = 'pendiente' | 'aceptado' | 'en_curso' | 'completado' | 'cancelado';

export type ClientType = 'villa' | 'charter';

export type VehicleType = 'mercedes_vito' | 'mercedes_v_class';

export type TransferDirection = 'ida' | 'vuelta';

export interface TransferRequest {
  id: string;
  organization_id: string;
  request_number: string;
  broker_id: string | null;
  broker_name: string;
  status: TransferRequestStatus;
  // Client info
  client_type: ClientType;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  // Villa-specific
  villa_name: string | null;
  // Charter-specific
  boat_name: string | null;
  berth_number: string | null;
  captain_name: string | null;
  captain_phone: string | null;
  // Notes
  notes: string | null;
  // Rejection
  rejection_reason: string | null;
  // Acceptance
  accepted_by: string | null;
  accepted_at: string | null;
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  items?: TransferItem[];
  items_count?: number;
  first_transfer_date?: string | null;
}

export interface TransferItem {
  id: string;
  request_id: string;
  organization_id: string;
  linked_item_id: string | null;
  direction: TransferDirection;
  position: number;
  transfer_date: string | null;
  transfer_time: string | null;
  // Route
  pickup_location: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_place_id: string | null;
  dropoff_location: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_place_id: string | null;
  // Vehicle & passengers
  vehicle_type: VehicleType | null;
  pax_count: number | null;
  // Flight (optional, for airport transfers)
  flight_number: string | null;
  // Driver (assigned by Azul Cars)
  driver_name: string | null;
  driver_phone: string | null;
  // Status & notes
  status: TransferItemStatus;
  notes: string | null;
  // Baby seats
  baby_seats_count: number | null;
  baby_seats: Array<{ age: number; weight: number }> | null;
  created_at: string;
}

// Form types for creating/editing
export interface TransferRequestFormData {
  client_type: ClientType;
  client_name: string;
  client_phone: string;
  client_email: string;
  villa_name: string;
  boat_name: string;
  berth_number: string;
  captain_name: string;
  captain_phone: string;
  notes: string;
}

export interface BabySeatDetail {
  age: string;
  weight: string;
}

export interface TransferItemFormData {
  id: string;
  direction: TransferDirection;
  transfer_date: string;
  transfer_time: string;
  pickup_location: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_place_id: string | null;
  dropoff_location: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_place_id: string | null;
  vehicle_type: VehicleType;
  pax_count: string;
  flight_number: string;
  notes: string;
  // Baby seats
  baby_seats_count: string;
  baby_seats: BabySeatDetail[];
  // Return trip
  has_return: boolean;
  return_date: string;
  return_time: string;
  return_pickup_location: string;
  return_pickup_lat: number | null;
  return_pickup_lng: number | null;
  return_pickup_place_id: string | null;
  return_dropoff_location: string;
  return_dropoff_lat: number | null;
  return_dropoff_lng: number | null;
  return_dropoff_place_id: string | null;
}

// Filter types
export interface TransferFilters {
  search: string;
  broker: string;
  status: TransferRequestStatus | 'all';
  clientType: ClientType | 'all';
  dateFrom: string;
  dateTo: string;
  hasBabySeats?: boolean;
}

// Status metadata for UI
export const TRANSFER_REQUEST_STATUS_META: Record<TransferRequestStatus, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  aceptado: { label: 'Aceptado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  conductor_asignado: { label: 'Conductor asignado', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  en_curso: { label: 'En curso', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  completado: { label: 'Completado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  rechazado: { label: 'Rechazado', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const TRANSFER_ITEM_STATUS_META: Record<TransferItemStatus, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  aceptado: { label: 'Aceptado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  en_curso: { label: 'En curso', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  completado: { label: 'Completado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const CLIENT_TYPE_META: Record<ClientType, { label: string; color: string; icon: string }> = {
  villa: { label: 'Villa', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: 'Building2' },
  charter: { label: 'Charter', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: 'Ship' },
};

export const DIRECTION_META: Record<TransferDirection, { label: string; color: string }> = {
  ida: { label: 'Ida', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  vuelta: { label: 'Vuelta', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
};

export const VEHICLE_TYPE_META: Record<VehicleType, { label: string; description: string }> = {
  mercedes_vito: { label: 'Mercedes Vito', description: 'Hasta 7 pasajeros' },
  mercedes_v_class: { label: 'Mercedes V-Class', description: 'Hasta 6 pasajeros, premium' },
};

// Helper to create an empty form item
export function createEmptyTransferItem(): TransferItemFormData {
  return {
    id: crypto.randomUUID(),
    direction: 'ida',
    transfer_date: '',
    transfer_time: '',
    pickup_location: '',
    pickup_lat: null,
    pickup_lng: null,
    pickup_place_id: null,
    dropoff_location: '',
    dropoff_lat: null,
    dropoff_lng: null,
    dropoff_place_id: null,
    vehicle_type: 'mercedes_v_class',
    pax_count: '',
    flight_number: '',
    notes: '',
    baby_seats_count: '',
    baby_seats: [],
    has_return: false,
    return_date: '',
    return_time: '',
    return_pickup_location: '',
    return_pickup_lat: null,
    return_pickup_lng: null,
    return_pickup_place_id: null,
    return_dropoff_location: '',
    return_dropoff_lat: null,
    return_dropoff_lng: null,
    return_dropoff_place_id: null,
  };
}
