export type SesDraftStatus = 'pending_sync'
  | 'incomplete' | 'ready' | 'batched' | 'uploaded_pending_result'
  | 'accepted' | 'error' | 'needs_revision';

export interface SesValidationIssue {
  path: string;
  code: 'required' | 'invalid' | 'inconsistent';
  message: string;
}

export interface SesPersonProfile {
  id: string;
  document_type: 'NIF' | 'NIE' | 'PAS' | 'OTRO';
  document_number: string;
  first_name: string;
  first_surname: string;
  second_surname: string | null;
  birth_date: string | null;
  nationality_code: string | null;
  sex: 'H' | 'M' | 'O' | null;
  address_line: string | null;
  address_number: string | null;
  address_complement: string | null;
  municipality_code: string | null;
  municipality_name: string | null;
  postal_code: string | null;
  country_code: string | null;
  phone: string | null;
  phone_secondary: string | null;
  email: string | null;
  licence_type: string | null;
  licence_valid_until: string | null;
  licence_number: string | null;
  licence_support: string | null;
  licence_country_code: string | null;
  manual_fields: string[];
}

export interface SesLocation {
  id: string;
  name: string;
  use_establishment_code: boolean;
  establishment_code: string | null;
  address_line: string | null;
  address_complement: string | null;
  municipality_code: string | null;
  municipality_name: string | null;
  postal_code: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
  manual_fields: string[];
}

export interface SesContractDraft {
  id: string;
  reservation_id: string;
  external_booking_id: number | null;
  reference: string;
  status: SesDraftStatus;
  contract_date: string | null;
  pickup_at: string | null;
  return_at: string | null;
  pickup_location_id: string | null;
  return_location_id: string | null;
  holder_profile_id: string | null;
  primary_driver_profile_id: string | null;
  secondary_driver_profile_id: string | null;
  payment_type: string | null;
  payment_date: string | null;
  payment_medium: string | null;
  payment_holder: string | null;
  card_expiry: string | null;
  vehicle_category: string | null;
  vehicle_type: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_vin: string | null;
  vehicle_color: string | null;
  km_pickup: number | null;
  km_return: number | null;
  gps_data: string | null;
  validation_errors: SesValidationIssue[];
  eligibility_errors: Array<{ code: string; message: string; path?: string; severity?: string }>;
  eligibility_snapshot?: Record<string, unknown> | null;
  is_complete: boolean;
  is_eligible: boolean;
  is_officially_clear: boolean;
  ready_for_xml: boolean;
  official_check_status: 'not_checked' | 'clear' | 'blocked' | 'review';
  manual_fields: string[];
  draft_version: number;
  updated_at: string;
  reservation: {
    id: string;
    external_reservation_id: string | null;
    cliente_nombre: string | null;
    cliente_apellido: string | null;
  } | null;
  holder: SesPersonProfile | null;
  primary_driver: SesPersonProfile | null;
  secondary_driver: SesPersonProfile | null;
  pickup_location: SesLocation | null;
  return_location: SesLocation | null;
}

export type SesBatchStatus =
  | 'generated' | 'downloaded' | 'uploaded_pending_result'
  | 'partially_accepted' | 'accepted' | 'error';

export interface SesBatchItem {
  id: string;
  draft_id: string;
  item_order: number;
  draft_version: number;
  result_status: 'pending' | 'accepted' | 'error';
  result_code: string | null;
  result_message: string | null;
  official_communication_code: string | null;
  payload_snapshot: Record<string, unknown> | null;
  snapshot_version: number;
  snapshot_hash: string | null;
  draft: { id: string; reference: string; status: SesDraftStatus } | null;
}

export interface SesBatch {
  id: string;
  status: SesBatchStatus;
  schema_version: string;
  file_name: string;
  xml_hash: string;
  item_count: number;
  accepted_count: number;
  error_count: number;
  generated_at: string;
  downloaded_at: string | null;
  uploaded_at: string | null;
  result_recorded_at: string | null;
  notes: string | null;
  official_lot_code: string | null;
  document_version: string;
  xsd_version: string | null;
  xsd_hash: string | null;
  xsd_validated_at: string | null;
  items: SesBatchItem[];
}

export interface SesSettings {
  organization_id: string;
  lessor_code: string | null;
  establishment_code: string | null;
  default_payment_type: string | null;
  default_vehicle_type: string;
  government_service_enabled: boolean;
  official_xsd_hash: string | null;
  official_xsd_version: string | null;
  official_xsd_uploaded_at: string | null;
  official_inventory_confirmed_at: string | null;
  official_inventory_source_date: string | null;
  updated_at: string;
  schema_migration_required?: boolean;
}

export interface SesOfficialCommunication {
  id: string;
  official_communication_code: string;
  official_lot_code: string | null;
  reference: string;
  communication_type: 'ALQUILER_VEHICULO';
  contract_date: string;
  vehicle_plate: string | null;
  normalized_plate: string | null;
  status: 'active' | 'accepted' | 'annulled' | 'error';
  source: 'manual_import' | 'portal_result' | 'migration';
  recorded_at: string;
}

export interface SesEligibilityException {
  id: string;
  draft_id: string;
  reservation_id: string;
  kind: 'terminated_not_reported';
  protocol_reference: string;
  reason: string;
  approved_by: string;
  approved_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface SesMunicipality {
  code: string;
  name: string;
  province_code: string;
  province_name: string;
}
