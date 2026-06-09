// =====================================================
// GARATECH MODULE: TypeScript Types
// =====================================================

export type RepairStatus = 
  | 'pendiente_aprobacion'
  | 'listo_entregar_taller'
  | 'en_taller'
  | 'esperando_piezas'
  | 'listo_recoger'
  | 'finalizado';

export type RepairType = 
  | 'mantenimiento'
  | 'reparacion'
  | 'revision'
  | 'itv'
  | 'accidente';

export type AccidentSeverity = 'leve' | 'moderado' | 'grave';
export type AccidentStatus = 'reportado' | 'en_revision' | 'resuelto';
export type FaultAssessment = 'propio' | 'contrario' | 'compartida' | 'pendiente';
export type AccidentFileType = 'photo' | 'document';
export type AccidentFileCategory = 'scene' | 'damage' | 'police_report' | 'insurance_form' | 'friendly_report' | 'invoice' | 'other';

export type DamageCategory = 
  | 'general'
  | 'exterior'
  | 'interior'
  | 'cristales'
  | 'luces'
  | 'neumaticos';

export type DamageReportStatus = 'borrador' | 'finalizado' | 'enviado';

// =====================================================
// Workshops
// =====================================================
export interface Workshop {
  id: string;
  organization_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  rating?: number | null;
  created_at: string;
}

export interface WorkshopFormData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_active?: boolean;
}

// =====================================================
// Repairs
// =====================================================
export interface Repair {
  id: string;
  organization_id: string;
  vehicle_id?: string | null;
  workshop_id?: string | null;
  repair_type: RepairType;
  repair_number?: string | null;
  description: string;
  status: RepairStatus;
  scheduled_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cost_estimate?: number | null;
  cost_final?: number | null;
  km_at_repair?: number | null;
  created_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  vehicle?: {
    matricula: string;
    modelo: string;
  } | null;
  workshop?: {
    name: string;
  } | null;
  created_by_profile?: {
    name: string;
  } | null;
}

export interface RepairFormData {
  vehicle_id?: string;
  workshop_id?: string;
  repair_type: RepairType;
  description: string;
  status?: RepairStatus;
  scheduled_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cost_estimate?: number;
  cost_final?: number | null;
  km_at_repair?: number;
  notes?: string;
}

// =====================================================
// Repair Comments
// =====================================================
export interface RepairComment {
  id: string;
  repair_id: string;
  organization_id: string;
  user_id: string;
  text: string;
  created_at: string;
  // Relations
  user?: {
    name: string | null;
  } | null;
}

// =====================================================
// Repair History
// =====================================================
export type RepairHistoryAction = 
  | 'created' 
  | 'status_change' 
  | 'edited' 
  | 'invoice_added' 
  | 'invoice_removed'
  | 'photo_added' 
  | 'photo_removed'
  | 'comment_added';

export interface RepairHistory {
  id: string;
  repair_id: string;
  organization_id: string;
  user_id?: string | null;
  action: RepairHistoryAction;
  from_value?: string | null;
  to_value?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Relations
  user?: {
    name: string | null;
  } | null;
}

// =====================================================
// Repair Photos
// =====================================================
export type RepairPhotoType = 'before' | 'after';

export interface RepairPhoto {
  id: string;
  repair_id: string;
  organization_id: string;
  photo_type: RepairPhotoType;
  storage_path: string;
  file_name?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  // Relations
  uploader?: {
    name: string | null;
  } | null;
}

// =====================================================
// Repair Invoices
// =====================================================
export type InvoiceOCRStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type InvoiceItemCategory = 'labor' | 'parts' | 'consumables' | 'other';

export interface RepairInvoice {
  id: string;
  repair_id: string;
  organization_id: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  supplier_name?: string | null;
  total_amount: number;
  tax_amount: number;
  subtotal_amount: number;
  currency: string;
  storage_path?: string | null;
  file_name?: string | null;
  ocr_raw_data?: Record<string, unknown> | null;
  ocr_status: InvoiceOCRStatus;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  items?: RepairInvoiceItem[];
  uploader?: {
    name: string | null;
  } | null;
}

export interface RepairInvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: InvoiceItemCategory | null;
  created_at: string;
}

export interface RepairInvoiceFormData {
  invoice_number?: string;
  invoice_date?: string;
  supplier_name?: string;
  total_amount?: number;
  tax_amount?: number;
  subtotal_amount?: number;
}

export interface RepairInvoiceItemFormData {
  description: string;
  quantity: number;
  unit_price: number;
  category?: InvoiceItemCategory;
}

export const INVOICE_ITEM_CATEGORY_LABELS: Record<InvoiceItemCategory, string> = {
  labor: 'Mano de Obra',
  parts: 'Piezas',
  consumables: 'Consumibles',
  other: 'Otros',
};

export const REPAIR_HISTORY_ACTION_LABELS: Record<RepairHistoryAction, string> = {
  created: 'Creación',
  status_change: 'Cambio de estado',
  edited: 'Edición',
  invoice_added: 'Factura añadida',
  invoice_removed: 'Factura eliminada',
  photo_added: 'Foto añadida',
  photo_removed: 'Foto eliminada',
  comment_added: 'Comentario añadido',
};

// =====================================================
// Accidents
// =====================================================
export interface Accident {
  id: string;
  organization_id: string;
  vehicle_id?: string | null;
  accident_number?: string | null;
  accident_date: string;
  location?: string | null;
  description: string;
  severity: AccidentSeverity;
  has_injuries: boolean;
  police_report_number?: string | null;
  insurance_claim_number?: string | null;
  claim_number?: string | null;
  fault_assessment?: FaultAssessment | null;
  third_party_name?: string | null;
  third_party_vehicle?: string | null;
  third_party_plate?: string | null;
  third_party_insurance?: string | null;
  third_party_policy_number?: string | null;
  third_party_phone?: string | null;
  estimated_cost?: number | null;
  insurance_coverage?: number | null;
  linked_repair_id?: string | null;
  status: AccidentStatus;
  reported_by?: string | null;
  notes?: string | null;
  created_at: string;
  // Relations
  vehicle?: {
    matricula: string;
    modelo: string;
  } | null;
  reported_by_profile?: {
    name: string;
  } | null;
  linked_repair?: {
    id: string;
    repair_number: string;
    status: RepairStatus;
  } | null;
}

export interface AccidentFormData {
  vehicle_id?: string;
  accident_date: string;
  location?: string;
  description: string;
  severity?: AccidentSeverity;
  has_injuries?: boolean;
  police_report_number?: string;
  insurance_claim_number?: string;
  claim_number?: string;
  fault_assessment?: FaultAssessment;
  third_party_name?: string;
  third_party_vehicle?: string;
  third_party_plate?: string;
  third_party_insurance?: string;
  third_party_policy_number?: string;
  third_party_phone?: string;
  estimated_cost?: number;
  insurance_coverage?: number;
  linked_repair_id?: string;
  notes?: string;
}

export interface AccidentFile {
  id: string;
  accident_id: string;
  organization_id: string;
  file_type: AccidentFileType;
  file_category: AccidentFileCategory;
  storage_path: string;
  file_name: string;
  description?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  uploader?: {
    name: string | null;
  } | null;
}

// =====================================================
// Damage Catalog
// =====================================================
export interface DamageCatalogItem {
  id: string;
  organization_id: string;
  name_es: string;
  name_en?: string | null;
  price_level_1?: number | null;
  price_level_2?: number | null;
  price_level_3?: number | null;
  price_level_4?: number | null;
  price_level_5?: number | null;
  category: DamageCategory;
  is_active: boolean;
  position: number;
  created_at: string;
}

export interface DamageCatalogFormData {
  name_es: string;
  name_en?: string;
  price_level_1?: number;
  price_level_2?: number;
  price_level_3?: number;
  price_level_4?: number;
  price_level_5?: number;
  category?: DamageCategory;
  is_active?: boolean;
  position?: number;
}

// Import preview types
export interface CatalogImportRow {
  data: Partial<DamageCatalogFormData> | null;
  status: 'new' | 'update' | 'error';
  error?: string;
}

export interface CatalogImportPreview {
  total: number;
  nuevos: number;
  actualizar: number;
  errores: number;
  rows: CatalogImportRow[];
}

// =====================================================
// Damage Reports
// =====================================================
export interface DamageReport {
  id: string;
  organization_id: string;
  vehicle_id?: string | null;
  report_number: string;
  damage_date: string;
  reported_by?: string | null;
  customer_name?: string | null;
  customer_document?: string | null;
  document_type?: string | null;
  reservation_id?: string | null;
  external_reservation_number?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  vehicle_plate?: string | null;
  vehicle_model?: string | null;
  vehicle_brand?: string | null;
  status: DamageReportStatus;
  notes?: string | null;
  pdf_url?: string | null;
  total_amount: number;
  // Collection tracking
  amount_collected?: number | null;
  collected_at?: string | null;
  collection_notes?: string | null;
  payment_gateway?: 'stripe' | 'redsys' | null;
  payment_reference?: string | null;
  // Before/after photos
  photos_before?: string[] | null;
  photos_after?: string[] | null;
  created_at: string;
  updated_at: string;
  // Relations
  vehicle?: {
    matricula: string;
    modelo: string;
  } | null;
  reported_by_profile?: {
    name: string;
  } | null;
  items?: DamageReportItem[];
}

export interface CollectPaymentFormData {
  amount_collected: number;
  collected_at: string;
  collection_notes?: string;
  payment_gateway: 'stripe' | 'redsys';
  payment_reference: string;
}

export interface DamageReportItem {
  id: string;
  report_id: string;
  catalog_item_id?: string | null;
  custom_description?: string | null;
  severity_level: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  location_on_vehicle?: string | null;
  photo_urls?: string[] | null;
  notes?: string | null;
  created_at: string;
  // Relations
  catalog_item?: DamageCatalogItem | null;
}

export interface DamageReportFormData {
  vehicle_id: string;
  damage_date: string;
  customer_name?: string;
  customer_document?: string;
  document_type?: string;
  reservation_id?: string;
  external_reservation_number?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  vehicle_brand?: string;
  notes?: string;
  photos_before?: string[];
  photos_after?: string[];
}

export interface DamageReportItemFormData {
  catalog_item_id?: string;
  custom_description?: string;
  severity_level: number;
  quantity: number;
  unit_price: number;
  location_on_vehicle?: string;
  photo_urls?: string[];
  notes?: string;
}

// =====================================================
// Constants
// =====================================================
export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  pendiente_aprobacion: 'Pendiente Aprobación',
  listo_entregar_taller: 'Listo Entregar Taller',
  en_taller: 'En Taller',
  esperando_piezas: 'Esperando Piezas',
  listo_recoger: 'Listo para Recoger',
  finalizado: 'Finalizado',
};

export const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  pendiente_aprobacion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  listo_entregar_taller: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  en_taller: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  esperando_piezas: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  listo_recoger: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  finalizado: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

// Kanban column configuration
// Valid status transitions for repairs
// Each key maps to the set of statuses it can transition TO
export const VALID_REPAIR_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  pendiente_aprobacion: ['listo_entregar_taller'],
  listo_entregar_taller: ['en_taller', 'pendiente_aprobacion'],
  en_taller: ['esperando_piezas', 'listo_recoger', 'finalizado'],
  esperando_piezas: ['en_taller'],
  listo_recoger: ['finalizado', 'en_taller'],
  finalizado: [],
};

export const REPAIR_STATUS_COLUMNS = [
  { status: 'pendiente_aprobacion', label: 'Pendiente Aprobación', color: '#eab308' },
  { status: 'listo_entregar_taller', label: 'Listo Entregar Taller', color: '#a855f7' },
  { status: 'en_taller', label: 'En Taller', color: '#3b82f6' },
  { status: 'esperando_piezas', label: 'Esperando Piezas', color: '#f97316' },
  { status: 'listo_recoger', label: 'Listo para Recoger', color: '#22c55e' },
  { status: 'finalizado', label: 'Finalizado', color: '#6b7280' },
] as const;

export const REPAIR_TYPE_LABELS: Record<RepairType, string> = {
  mantenimiento: 'Mantenimiento',
  reparacion: 'Reparación',
  revision: 'Revisión',
  itv: 'ITV',
  accidente: 'Accidente',
};

export const ACCIDENT_SEVERITY_LABELS: Record<AccidentSeverity, string> = {
  leve: 'Leve',
  moderado: 'Moderado',
  grave: 'Grave',
};

export const ACCIDENT_SEVERITY_COLORS: Record<AccidentSeverity, { bg: string; text: string }> = {
  leve: { bg: 'hsl(var(--chart-2) / 0.2)', text: 'hsl(var(--chart-2))' },
  moderado: { bg: 'hsl(var(--chart-4) / 0.2)', text: 'hsl(var(--chart-4))' },
  grave: { bg: 'hsl(var(--destructive) / 0.2)', text: 'hsl(var(--destructive))' },
};

export const ACCIDENT_STATUS_LABELS: Record<AccidentStatus, string> = {
  reportado: 'Reportado',
  en_revision: 'En Revisión',
  resuelto: 'Resuelto',
};

export const ACCIDENT_STATUS_COLORS: Record<AccidentStatus, { bg: string; text: string }> = {
  reportado: { bg: 'hsl(var(--chart-4) / 0.2)', text: 'hsl(var(--chart-4))' },
  en_revision: { bg: 'hsl(var(--chart-1) / 0.2)', text: 'hsl(var(--chart-1))' },
  resuelto: { bg: 'hsl(var(--chart-2) / 0.2)', text: 'hsl(var(--chart-2))' },
};

export const FAULT_ASSESSMENT_LABELS: Record<FaultAssessment, string> = {
  propio: 'Culpa Propia',
  contrario: 'Culpa del Contrario',
  compartida: 'Culpa Compartida',
  pendiente: 'Pendiente',
};

export const ACCIDENT_FILE_CATEGORY_LABELS: Record<AccidentFileCategory, string> = {
  scene: 'Escena',
  damage: 'Daños',
  police_report: 'Atestado Policial',
  insurance_form: 'Formulario Seguro',
  friendly_report: 'Parte Amistoso',
  invoice: 'Factura',
  other: 'Otro',
};

export const DAMAGE_CATEGORY_LABELS: Record<DamageCategory, string> = {
  general: 'General',
  exterior: 'Exterior',
  interior: 'Interior',
  cristales: 'Cristales',
  luces: 'Luces',
  neumaticos: 'Neumáticos',
};

export const DAMAGE_REPORT_STATUS_LABELS: Record<DamageReportStatus, string> = {
  borrador: 'Borrador',
  finalizado: 'Finalizado',
  enviado: 'Enviado',
};

export const DAMAGE_REPORT_STATUS_COLORS: Record<DamageReportStatus, { bg: string; text: string }> = {
  borrador: { bg: 'hsl(var(--muted) / 0.5)', text: 'hsl(var(--muted-foreground))' },
  finalizado: { bg: 'hsl(var(--chart-2) / 0.2)', text: 'hsl(var(--chart-2))' },
  enviado: { bg: 'hsl(var(--chart-1) / 0.2)', text: 'hsl(var(--chart-1))' },
};

export const VEHICLE_LOCATION_GROUPS = [
  {
    label: 'Zona Frontal',
    items: [
      { value: 'paragolpes_delantero', label: 'Paragolpes delantero', label_en: 'Front bumper' },
      { value: 'capo', label: 'Capó', label_en: 'Hood' },
      { value: 'faro_delantero_izq', label: 'Faro delantero izquierdo', label_en: 'Left front headlight' },
      { value: 'faro_delantero_der', label: 'Faro delantero derecho', label_en: 'Right front headlight' },
      { value: 'rejilla', label: 'Rejilla/Parrilla', label_en: 'Grille' },
      { value: 'parabrisas', label: 'Parabrisas', label_en: 'Windshield' },
    ],
  },
  {
    label: 'Zona Trasera',
    items: [
      { value: 'paragolpes_trasero', label: 'Paragolpes trasero', label_en: 'Rear bumper' },
      { value: 'porton_maletero', label: 'Portón/Maletero', label_en: 'Tailgate/Trunk' },
      { value: 'piloto_trasero_izq', label: 'Piloto trasero izquierdo', label_en: 'Left tail light' },
      { value: 'piloto_trasero_der', label: 'Piloto trasero derecho', label_en: 'Right tail light' },
      { value: 'luneta_trasera', label: 'Luneta trasera', label_en: 'Rear window' },
    ],
  },
  {
    label: 'Lateral Izquierdo',
    items: [
      { value: 'aleta_delantera_izq', label: 'Aleta delantera izquierda', label_en: 'Left front fender' },
      { value: 'puerta_delantera_izq', label: 'Puerta delantera izquierda', label_en: 'Left front door' },
      { value: 'puerta_trasera_izq', label: 'Puerta trasera izquierda', label_en: 'Left rear door' },
      { value: 'aleta_trasera_izq', label: 'Aleta trasera izquierda', label_en: 'Left rear fender' },
      { value: 'estribo_izq', label: 'Estribo/Falda izquierda', label_en: 'Left side skirt' },
      { value: 'retrovisor_izq', label: 'Retrovisor izquierdo', label_en: 'Left mirror' },
    ],
  },
  {
    label: 'Lateral Derecho',
    items: [
      { value: 'aleta_delantera_der', label: 'Aleta delantera derecha', label_en: 'Right front fender' },
      { value: 'puerta_delantera_der', label: 'Puerta delantera derecha', label_en: 'Right front door' },
      { value: 'puerta_trasera_der', label: 'Puerta trasera derecha', label_en: 'Right rear door' },
      { value: 'aleta_trasera_der', label: 'Aleta trasera derecha', label_en: 'Right rear fender' },
      { value: 'estribo_der', label: 'Estribo/Falda derecha', label_en: 'Right side skirt' },
      { value: 'retrovisor_der', label: 'Retrovisor derecho', label_en: 'Right mirror' },
    ],
  },
  {
    label: 'Techo y Pilares',
    items: [
      { value: 'techo', label: 'Techo', label_en: 'Roof' },
      { value: 'pilar_a_izq', label: 'Pilar A izquierdo', label_en: 'Left A-pillar' },
      { value: 'pilar_a_der', label: 'Pilar A derecho', label_en: 'Right A-pillar' },
      { value: 'pilar_b_izq', label: 'Pilar B izquierdo', label_en: 'Left B-pillar' },
      { value: 'pilar_b_der', label: 'Pilar B derecho', label_en: 'Right B-pillar' },
      { value: 'pilar_c_izq', label: 'Pilar C izquierdo', label_en: 'Left C-pillar' },
      { value: 'pilar_c_der', label: 'Pilar C derecho', label_en: 'Right C-pillar' },
    ],
  },
  {
    label: 'Ruedas',
    items: [
      { value: 'rueda_del_izq', label: 'Rueda delantera izquierda', label_en: 'Left front wheel' },
      { value: 'rueda_del_der', label: 'Rueda delantera derecha', label_en: 'Right front wheel' },
      { value: 'rueda_tras_izq', label: 'Rueda trasera izquierda', label_en: 'Left rear wheel' },
      { value: 'rueda_tras_der', label: 'Rueda trasera derecha', label_en: 'Right rear wheel' },
    ],
  },
  {
    label: 'Otros',
    items: [
      { value: 'interior', label: 'Interior', label_en: 'Interior' },
      { value: 'otros', label: 'Otros', label_en: 'Other' },
    ],
  },
];

// Flat list for backward compatibility (e.g. getLocationLabel)
export const VEHICLE_LOCATIONS = VEHICLE_LOCATION_GROUPS.flatMap(g => g.items);
