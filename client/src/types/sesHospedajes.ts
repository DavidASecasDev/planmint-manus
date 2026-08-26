export type SesDraftStatus =
  | 'incomplete' | 'ready' | 'batched' | 'uploaded_pending_result'
  | 'accepted' | 'rejected' | 'cancelled';

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

export interface SesSettings {
  organization_id: string;
  lessor_code: string | null;
  establishment_code: string | null;
  default_payment_type: string | null;
  default_vehicle_type: string;
  government_service_enabled: boolean;
  updated_at: string;
}

export interface SesMunicipality {
  code: string;
  name: string;
  province_code: string;
  province_name: string;
}
