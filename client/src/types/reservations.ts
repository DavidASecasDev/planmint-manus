// Tipos para datos JSONB de Rently
export interface RentlyExtra {
  nombre?: string;
  precio?: number | null;
  cantidad?: number | null;
  // Legacy English field names (in case of older data)
  name?: string;
  price?: number | null;
  quantity?: number | null;
  total?: number | null;
}

export interface RentlyPriceItem {
  descripcion?: string;
  importe?: number | null;
  cantidad?: number | null;
  // Legacy English field names
  description?: string;
  amount?: number | null;
  type?: string | null;
}

export interface RentlyDriver {
  nombre?: string;
  documento?: string | null;
  carnet?: string | null;
  // Legacy English field names
  name?: string;
  document?: string | null;
  license_number?: string | null;
  license_country?: string | null;
  license_expiration?: string | null;
}

export interface Reservation {
  id: string;
  organization_id: string;
  
  // Datos del Excel (solo lectura)
  external_reservation_id: string;
  estado: string | null;
  fecha_creacion: string | null;
  cliente_nombre: string | null;
  cliente_apellido: string | null;
  email: string | null;
  telefono: string | null;
  modelo: string | null;
  auto: string | null;
  desde: string | null;
  hasta: string | null;
  devolucion: string | null;
  // Hora confirmada con el cliente (no se sobreescribe en syncs de Rently)
  confirmed_entrega_datetime: string | null;
  confirmed_devolucion_datetime: string | null;
  lugar_entrega: string | null;
  lugar_devolucion: string | null;
  precio: number | null;
  duracion: string | null;
  categoria: string | null;
  a_pedido: string | null;
  origen_reserva: string | null;
  creado_por: string | null;
  tarifa: string | null;
  acuerdo_comercial: string | null;
  acuerdo_precios: string | null;
  tipo_documento_cliente: string | null;
  documento_cliente: string | null;
  codigo: string | null;
  
  // Campos operativos internos (legacy - mantener para compatibilidad)
  tipo_actividad: string | null;
  lugar_operacion: string | null;
  asignado_rental_id: string | null;
  asignado_rental_team_id: string | null;
  asignado_escoba_id: string | null;
  asignado_escoba_team_id: string | null;
  pagado: string | null;
  hosp: string | null;
  checkin: string | null;
  contacto: string | null;
  notas: string | null;
  
  // Campos específicos de Entrega
  estado_entrega: string | null;
  pagado_entrega: string | null;
  hosp_entrega: string | null;
  checkin_entrega: string | null;
  contacto_entrega: string | null;
  notas_entrega: string | null;
  asignado_rental_entrega_id: string | null;
  asignado_rental_entrega_team_id: string | null;
  asignado_escoba_entrega_id: string | null;
  asignado_escoba_entrega_team_id: string | null;
  
  // Campos específicos de Devolución
  estado_devolucion: string | null;
  pagado_devolucion: string | null;
  hosp_devolucion: string | null;
  checkin_devolucion: string | null;
  contacto_devolucion: string | null;
  notas_devolucion: string | null;
  asignado_rental_devolucion_id: string | null;
  asignado_rental_devolucion_team_id: string | null;
  asignado_escoba_devolucion_id: string | null;
  asignado_escoba_devolucion_team_id: string | null;
  
  // Campos de completado por operación
  entrega_completada: boolean;
  devolucion_completada: boolean;
  transfer_completado: boolean;
  
  // Metadata
  imported_at: string;
  imported_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  estado_terminada_at: string | null;

  // === Datos enriquecidos de Rently ===

  // Financiero / Pagos
  balance: number | null;
  total_pagado_rently: number | null;
  prepago: number | null;
  pagado_por_agencia: number | null;
  pagado_por_cliente: number | null;
  moneda: string | null;
  comision_ventas: number | null;

  // Detalles del vehículo
  vehiculo_kms: number | null;
  vehiculo_combustible: number | null;
  vehiculo_color: string | null;
  vehiculo_anio: number | null;
  vehiculo_chasis: string | null;
  vehiculo_tipo_combustible: string | null;

  // Tarifas
  tarifa_diaria: number | null;
  tarifa_hora: number | null;
  tarifa_dia_extra: number | null;
  tarifa_hora_extra: number | null;
  km_ilimitados: boolean | null;
  km_max_permitidos: number | null;
  km_max_por_dia: number | null;

  // Metadata de Rently
  rently_status_code: number | null;
  rently_status_date: string | null;
  es_transferencia: boolean | null;
  es_cotizacion: boolean | null;
  rently_version: string | null;

  // Lugares con dirección
  lugar_entrega_direccion: string | null;
  lugar_entrega_ciudad: string | null;
  lugar_devolucion_direccion: string | null;
  lugar_devolucion_ciudad: string | null;

  // Cliente extendido
  cliente_direccion: string | null;
  cliente_ciudad: string | null;
  cliente_estado: string | null;
  cliente_pais: string | null;
  cliente_edad: number | null;
  cliente_fecha_nacimiento: string | null;
  cliente_carnet_numero: string | null;
  cliente_carnet_pais: string | null;
  cliente_carnet_expiracion: string | null;
  cliente_notas: string | null;

  // Extras y desgloses (JSONB)
  extras_contratados: RentlyExtra[] | null;
  desglose_precios: RentlyPriceItem[] | null;
  conductores_adicionales: RentlyDriver[] | null;

  // Sync metadata
  rently_detail_synced_at: string | null;
}

export interface DropdownOption {
  id: string;
  organization_id: string;
  field_name: string;
  label: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export interface CreateReservationData {
  external_reservation_id: string;
  estado?: string;
  fecha_creacion?: string;
  cliente_nombre?: string;
  cliente_apellido?: string;
  email?: string;
  telefono?: string;
  modelo?: string;
  auto?: string;
  desde?: string;
  hasta?: string;
  devolucion?: string;
  lugar_entrega?: string;
  lugar_devolucion?: string;
  precio?: number;
  duracion?: string;
  categoria?: string;
  a_pedido?: string;
  origen_reserva?: string;
  creado_por?: string;
  tarifa?: string;
  acuerdo_comercial?: string;
  acuerdo_precios?: string;
  tipo_documento_cliente?: string;
  documento_cliente?: string;
  codigo?: string;
}

export interface UpdateReservationData {
  // Fechas editables
  desde?: string | null;
  hasta?: string | null;
  // Hora confirmada con el cliente
  confirmed_entrega_datetime?: string | null;
  confirmed_devolucion_datetime?: string | null;
  // Campos editables de reserva
  lugar_entrega?: string | null;
  lugar_devolucion?: string | null;
  modelo?: string | null;
  auto?: string | null;
  // Campos operativos legacy
  tipo_actividad?: string | null;
  lugar_operacion?: string | null;
  asignado_rental_id?: string | null;
  asignado_rental_team_id?: string | null;
  asignado_escoba_id?: string | null;
  asignado_escoba_team_id?: string | null;
  pagado?: string | null;
  hosp?: string | null;
  checkin?: string | null;
  contacto?: string | null;
  notas?: string | null;
  // Campos específicos de Entrega
  estado_entrega?: string | null;
  pagado_entrega?: string | null;
  hosp_entrega?: string | null;
  checkin_entrega?: string | null;
  contacto_entrega?: string | null;
  notas_entrega?: string | null;
  asignado_rental_entrega_id?: string | null;
  asignado_rental_entrega_team_id?: string | null;
  asignado_escoba_entrega_id?: string | null;
  asignado_escoba_entrega_team_id?: string | null;
  // Campos específicos de Devolución
  estado_devolucion?: string | null;
  pagado_devolucion?: string | null;
  hosp_devolucion?: string | null;
  checkin_devolucion?: string | null;
  contacto_devolucion?: string | null;
  notas_devolucion?: string | null;
  asignado_rental_devolucion_id?: string | null;
  asignado_rental_devolucion_team_id?: string | null;
  asignado_escoba_devolucion_id?: string | null;
  asignado_escoba_devolucion_team_id?: string | null;
  // Campos de completado
  entrega_completada?: boolean;
  devolucion_completada?: boolean;
  transfer_completado?: boolean;
}

export interface ExcelRow {
  Id: string;
  'Fecha de Creación': string;
  Estado: string;
  'Nombre del Cliente': string;
  Precio: string | number;
  Modelo: string;
  Auto: string;
  Desde: string;
  Hasta: string;
  'Fecha de Devolución': string;
  Duración: string;
  'Lugar de Entrega': string;
  'Lugar de Devolución': string;
  Categoría: string;
  'A Pedido': string;
  'Origen de reserva': string;
  'Creado por': string;
  Tarifa: string;
  'Acuerdo Comercial': string;
  'Acuerdo de precios': string;
  Mail: string;
  Teléfono: string;
  'Apellido del Cliente': string;
  'Tipo Documento Cliente': string;
  'Documento Cliente': string;
  Código: string;
}

export interface ImportPreview {
  total: number;
  nuevas: number;
  duplicadas: number;
  errores: number;
  rows: {
    row: ExcelRow;
    status: 'new' | 'duplicate' | 'error';
    error?: string;
  }[];
}

export const DROPDOWN_FIELDS = [
  'estado',
  'tipo_actividad', 
  'pagado',
  'hosp',
  'checkin',
  'contacto'
] as const;

export type DropdownFieldName = typeof DROPDOWN_FIELDS[number];
