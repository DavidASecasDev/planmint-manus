// ── Vehicle Quality Audit Types ──

export type AuditStatus = 'in_progress' | 'approved' | 'rejected';

export type ChecklistItemResult = 'approved' | 'defect' | 'not_checked';

export interface ChecklistResult {
  key: string;
  result: ChecklistItemResult;
  notes?: string;
}

export interface VehicleQualityAudit {
  id: string;
  organization_id: string;
  vehicle_id: string;
  auditor_id: string | null;
  status: AuditStatus;
  checklist_results: Record<string, ChecklistResult>;
  overall_score: number | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  completed_at: string | null;
  // Joined data
  auditor_profile?: { name: string | null } | null;
}

export interface VehicleAuditPhoto {
  id: string;
  audit_id: string;
  organization_id: string;
  photo_url: string;
  checklist_item_key: string | null;
  caption: string | null;
  created_at: string;
}

// ── Checklist Definition ──

export type ChecklistCategory = 'exterior' | 'interior' | 'mecanica' | 'documentacion';

export interface ChecklistItem {
  key: string;
  label: string;
  category: ChecklistCategory;
}

export const CHECKLIST_CATEGORIES: { key: ChecklistCategory; label: string; icon: string }[] = [
  { key: 'exterior', label: 'Exterior', icon: 'Car' },
  { key: 'interior', label: 'Interior', icon: 'Armchair' },
  { key: 'mecanica', label: 'Mecánica', icon: 'Wrench' },
  { key: 'documentacion', label: 'Documentación', icon: 'FileText' },
];

export const AUDIT_CHECKLIST: ChecklistItem[] = [
  // Exterior
  { key: 'ext_carroceria', label: 'Carrocería sin daños nuevos', category: 'exterior' },
  { key: 'ext_cristales', label: 'Cristales limpios y sin grietas', category: 'exterior' },
  { key: 'ext_neumaticos', label: 'Neumáticos en buen estado', category: 'exterior' },
  { key: 'ext_luces', label: 'Luces funcionando', category: 'exterior' },
  // Interior
  { key: 'int_tapiceria', label: 'Tapicería limpia y sin manchas', category: 'interior' },
  { key: 'int_salpicadero', label: 'Salpicadero y consola limpios', category: 'interior' },
  { key: 'int_olores', label: 'Sin olores', category: 'interior' },
  { key: 'int_alfombrillas', label: 'Alfombrillas limpias', category: 'interior' },
  // Mecánica
  { key: 'mec_combustible', label: 'Nivel de combustible correcto', category: 'mecanica' },
  { key: 'mec_avisos', label: 'Sin avisos en el cuadro', category: 'mecanica' },
  { key: 'mec_presion', label: 'Presión neumáticos verificada', category: 'mecanica' },
  // Documentación
  { key: 'doc_documentacion', label: 'Documentación del vehículo presente', category: 'documentacion' },
  { key: 'doc_dispositivos', label: 'Dispositivos borrados/reseteados', category: 'documentacion' },
];

// Helper to calculate score from checklist results
export function calculateAuditScore(results: Record<string, ChecklistResult>): number {
  const items = Object.values(results);
  if (items.length === 0) return 0;
  const approved = items.filter(r => r.result === 'approved').length;
  return Math.round((approved / AUDIT_CHECKLIST.length) * 100);
}

// Helper to check if all items have been reviewed
export function isChecklistComplete(results: Record<string, ChecklistResult>): boolean {
  return AUDIT_CHECKLIST.every(item => {
    const result = results[item.key];
    return result && result.result !== 'not_checked';
  });
}

// Helper to check if there are any defects
export function hasDefects(results: Record<string, ChecklistResult>): boolean {
  return Object.values(results).some(r => r.result === 'defect');
}
