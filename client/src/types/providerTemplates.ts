export interface ProviderParsingTemplate {
  id: string;
  organization_id: string;
  provider_name: string;
  provider_aliases: string[];
  description: string | null;
  parsing_hints: string;
  field_mappings: FieldMappings;
  sample_fields: SampleFields;
  default_vehicle_type: string | null;
  default_currency: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FieldMappings {
  /** Column/label name in the provider's PDF that maps to pickup_location */
  pickup_location?: string;
  /** Column/label name that maps to dropoff_location */
  dropoff_location?: string;
  /** Column/label name that maps to date */
  date?: string;
  /** Column/label name that maps to pickup_time */
  pickup_time?: string;
  /** Column/label name that maps to amount */
  amount?: string;
  /** Column/label name that maps to pax_count */
  pax_count?: string;
  /** Column/label name that maps to vehicle_type */
  vehicle_type?: string;
  /** Column/label name that maps to flight_number */
  flight_number?: string;
  /** Any other custom field mappings */
  [key: string]: string | undefined;
}

export interface SampleFields {
  /** Example pickup locations this provider commonly uses */
  common_pickup_locations?: string[];
  /** Example dropoff locations */
  common_dropoff_locations?: string[];
  /** Vehicle type mappings specific to this provider (e.g., "Mercedes E" → "sedan") */
  vehicle_type_mappings?: Record<string, string>;
  /** Any other sample data */
  [key: string]: unknown;
}

export type ProviderTemplateFormData = Omit<
  ProviderParsingTemplate,
  'id' | 'organization_id' | 'usage_count' | 'last_used_at' | 'created_at' | 'updated_at' | 'created_by'
>;
