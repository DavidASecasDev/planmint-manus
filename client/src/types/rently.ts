export interface RentlyCustomer {
  Firstname?: string;
  Lastname?: string;
  EmailAddress?: string;
  CellPhone?: string;
  DocumentTypeId?: number;
  DocumentId?: string;
}

export interface RentlyCategory {
  Name?: string;
}

export interface RentlyModel {
  Name?: string;
  Category?: RentlyCategory;
}

export interface RentlyCar {
  Id?: number;
  Plate?: string;  // Matrícula del vehículo
  Model?: RentlyModel;
}

export interface RentlyPlace {
  Name?: string;
  Address?: string;
}

export interface RentlyDropoffInfo {
  Date?: string;
}

export interface RentlyOrigin {
  Name?: string;
}

/**
 * RentlyBooking — shape returned by /api/bookings/list (post-deprecation 2026-07-13).
 * Entities are now lightweight "Description" DTOs.
 * DeliveryPlace/ReturnPlace replaced by integer IDs.
 * Heavy fields (PriceItems, Attributes, etc.) removed from list response.
 */
export interface RentlyBooking {
  Id: number;
  CreationDate?: string;
  CurrentStatus: number;
  Customer?: RentlyCustomer;
  CustomerPrice?: number;
  Car?: RentlyCar;
  FromDate?: string;
  ToDate?: string;
  TotalDays?: number;
  // New: Place IDs instead of objects (post /api/bookings/list migration)
  DeliveryPlaceId?: number | null;
  ReturnPlaceId?: number | null;
  // Legacy fields kept for backwards-compat with detail endpoint
  DeliveryPlace?: RentlyPlace;
  ReturnPlace?: RentlyPlace;
  DropoffInfo?: RentlyDropoffInfo;
  Origin?: RentlyOrigin;
  // New fields added in /api/bookings/list
  IsFullBonus?: boolean;
  FeeNoShow?: boolean;
}

export interface RentlyBookingsResponse {
  Results: RentlyBooking[];
  NextOffset?: number | null;
}

export type RentlyStatus = 0 | 1 | 2 | 3 | 4 | 5;

export const RENTLY_STATUS_MAP: Record<RentlyStatus, string> = {
  0: 'Reservado',
  1: 'Confirmada',
  2: 'Entregado',
  3: 'Terminada',
  4: 'Cancelada',
  5: 'Cotizado',
};

export const RENTLY_DOCUMENT_TYPE_MAP: Record<number, string> = {
  1: 'DNI',
  2: 'Licencia de Conducir',
  3: 'Pasaporte',
};

// Estados a excluir durante sincronización
export const RENTLY_EXCLUDED_STATUSES: RentlyStatus[] = [4, 5]; // Cancelada, Cotizado

// Sync status for resumable synchronization
export type RentlySyncStatusType = 'idle' | 'running' | 'completed' | 'error' | 'paused';

export interface RentlySyncStatus {
  id: string;
  organization_id: string;
  last_offset: number;
  total_fetched: number;
  total_inserted: number;
  total_duplicates: number;
  total_filtered: number;
  status: RentlySyncStatusType;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Request for a single page sync
export interface RentlySyncPageRequest {
  continue_sync?: boolean;  // Continue from last offset
  reset?: boolean;          // Reset and start fresh
  test_only?: boolean;      // Only test connection
}

// Response from a single page sync
export interface RentlySyncPageResponse {
  success: boolean;
  hasMore: boolean;
  page: number;
  progress: {
    fetched: number;
    inserted: number;
    duplicates: number;
    filtered: number;
    totalFetched: number;
    totalInserted: number;
    totalDuplicates: number;
  };
  estimatedTotalPages?: number;
  error?: string;
  archived?: number;
  date_range_in_data?: { oldest: string; newest: string } | null;
}

// Legacy types for backwards compatibility
export interface RentlySyncResult {
  success: boolean;
  inserted: number;
  duplicates: number;
  filtered: number;
  archived?: number;
  errors: Array<{ id: string; error: string }>;
  total_fetched: number;
  date_range_in_data?: { oldest: string; newest: string } | null;
}

export interface RentlySyncRequest {
  date_from?: string;  // ISO date
  date_to?: string;    // ISO date
  limit?: number;
  test_only?: boolean; // Only test connection, don't sync
  skip_date_filter?: boolean; // Skip all date filtering for massive sync
}
