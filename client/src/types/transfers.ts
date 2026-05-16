// Types for the Transfers module - Yacht broker transportation management

export type TransferRequestStatus = 'pendiente' | 'en_gestion' | 'presupuesto_enviado' | 'confirmado' | 'completado' | 'cancelado';

export type TransferItemStatus = 'pendiente' | 'confirmado' | 'completado' | 'cancelado';

export type TransferDocumentType = 'presupuesto' | 'factura';

export type PricingMode = 'zone_tariff' | 'provider_quote';

export type ClientType = 'external_client' | 'broker_client';

export type ServiceType = 'point_to_point' | 'pack';

export type PackDuration = '2h' | '4h' | '8h' | '12h';

export type AIStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'error';

export interface TransferRequest {
  id: string;
  organization_id: string;
  request_number: string;
  broker_id: string | null;
  broker_name: string;
  client_name: string;
  status: TransferRequestStatus;
  client_type: ClientType;
  service_type: ServiceType;
  client_reference: string | null;
  is_external_provider: boolean;
  external_provider_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Pricing mode
  pricing_mode: PricingMode;
  // Financial fields
  provider_cost: number | null;
  client_total: number | null;
  internal_margin: number | null;
  quote_number: string | null;
  invoice_number: string | null;
  quote_generated_at: string | null;
  invoice_generated_at: string | null;
  // Joined fields
  items?: TransferItem[];
  documents?: TransferDocument[];
  items_count?: number;
  first_transfer_date?: string | null;
  total_amount?: number;
}

export interface TransferItem {
  id: string;
  request_id: string;
  organization_id: string;
  position: number;
  transfer_date: string | null;
  status: TransferItemStatus;
  // Ida - Recogida
  pickup_enabled: boolean;
  pickup_location: string | null;
  pickup_time: string | null;
  // Ida - Llegada
  dropoff_enabled: boolean;
  dropoff_location: string | null;
  dropoff_time: string | null;
  // Vuelta
  has_return: boolean;
  return_pickup_enabled: boolean;
  return_pickup_location: string | null;
  return_pickup_time: string | null;
  return_dropoff_enabled: boolean;
  return_dropoff_location: string | null;
  return_dropoff_time: string | null;
  // Pasajeros y conductor
  pax_count: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_pending: boolean;
  notes: string | null;
  created_at: string;
  // Pack & estimated pricing
  pack_duration: PackDuration | null;
  estimated_price: number | null;
  // Pricing fields
  zone: string | null;
  zone_address: string | null;
  vehicle_type: string | null;
  base_price: number | null;
  price_with_commission: number | null;
  price_manually_set: boolean;
  provider_cost: number | null;
}

export interface ExtractedTransferItem {
  date: string | null;
  pickup_time: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  dropoff_time: string | null;
  vehicle_type: string | null;
  pax_count: number | null;
  amount: number | null;
  notes: string | null;
  // Enhanced fields from improved parsing
  flight_number: string | null;
  has_return: boolean;
  return_pickup_location: string | null;
  return_dropoff_location: string | null;
  return_pickup_time: string | null;
  return_date: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  confidence: number | null;
}

export interface TransferDocumentAIData {
  document_type?: string;
  total_amount?: number;
  date?: string | null;
  provider_name?: string | null;
  provider_phone?: string | null;
  provider_email?: string | null;
  client_reference?: string | null;
  currency?: string;
  confidence?: number;
  items?: ExtractedTransferItem[];
  // Legacy fields
  amount?: number;
  details?: string;
  [key: string]: unknown;
}

export interface TransferDocument {
  id: string;
  request_id: string;
  organization_id: string;
  document_type: TransferDocumentType;
  storage_path: string;
  file_name: string;
  ai_status: AIStatus;
  detected_amount: number | null;
  detected_date: string | null;
  detected_provider: string | null;
  ai_raw_data: TransferDocumentAIData | null;
  detected_items?: ExtractedTransferItem[];
  uploaded_by: string | null;
  created_at: string;
}

// Form types for creating/editing
export interface TransferRequestFormData {
  broker_name: string;
  client_name: string;
  is_external_provider: boolean;
  external_provider_name: string;
  notes: string;
  transfer_count: number;
}

export interface TransferItemFormData {
  transfer_date: string;
  pickup_enabled: boolean;
  pickup_location: string;
  pickup_time: string;
  dropoff_enabled: boolean;
  dropoff_location: string;
  dropoff_time: string;
  has_return: boolean;
  return_pickup_enabled: boolean;
  return_pickup_location: string;
  return_pickup_time: string;
  return_dropoff_enabled: boolean;
  return_dropoff_location: string;
  return_dropoff_time: string;
  pax_count: number;
  driver_name: string;
  driver_phone: string;
  driver_pending: boolean;
  notes: string;
}

// Filter types
export interface TransferFilters {
  search: string;
  broker: string;
  status: TransferRequestStatus | 'all';
  pricingMode: PricingMode | 'all';
  dateFrom: string;
  dateTo: string;
}

// Status metadata for UI
export const TRANSFER_REQUEST_STATUS_META: Record<TransferRequestStatus, { label: string; color: string; icon?: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  en_gestion: { label: 'En gestión', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  presupuesto_enviado: { label: 'Ppto. Enviado', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  completado: { label: 'Completado', color: 'bg-primary/10 text-primary border-primary/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export interface TransferItemVehicle {
  id: string;
  transfer_item_id: string;
  organization_id: string;
  vehicle_type: string;
  vehicle_label: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  notes: string | null;
  position: number;
  created_at: string;
}

export const CLIENT_TYPE_META: Record<ClientType, { label: string; color: string }> = {
  external_client: { label: 'Cliente directo', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  broker_client: { label: 'Cliente Isle Of Mallorca', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
};

export const SERVICE_TYPE_META: Record<ServiceType, { label: string; color: string }> = {
  point_to_point: { label: 'Punto a punto', color: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
  pack: { label: 'Pack por horas', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

export const TRANSFER_ITEM_STATUS_META: Record<TransferItemStatus, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  completado: { label: 'Completado', color: 'bg-primary/10 text-primary border-primary/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};
