import { describe, it, expect } from 'vitest';
import {
  computeMonthlyScores,
  computeDefectsByItem,
  computeDefectsByCategory,
  computeStatusDistribution,
  computeKPIs,
} from './AuditDashboard';
import type { ChecklistResult } from '@/types/audits';

// ── Test data factories ──

function makeAudit(overrides: {
  status?: 'in_progress' | 'approved' | 'rejected';
  overall_score?: number;
  checklist_results?: Record<string, ChecklistResult>;
  created_at?: string;
  completed_at?: string | null;
} = {}) {
  return {
    id: crypto.randomUUID(),
    status: overrides.status ?? 'approved',
    overall_score: overrides.overall_score ?? 85,
    checklist_results: overrides.checklist_results ?? {},
    created_at: overrides.created_at ?? new Date().toISOString(),
    completed_at: overrides.completed_at ?? new Date().toISOString(),
  };
}

function makeChecklistResults(defectKeys: string[]): Record<string, ChecklistResult> {
  const results: Record<string, ChecklistResult> = {};
  // All items approved by default
  const allKeys = [
    'ext_carroceria', 'ext_cristales', 'ext_neumaticos', 'ext_luces',
    'int_tapiceria', 'int_salpicadero', 'int_olores', 'int_alfombrillas',
    'mec_combustible', 'mec_avisos', 'mec_presion',
    'doc_documentacion', 'doc_dispositivos',
  ];
  for (const key of allKeys) {
    results[key] = {
      key,
      result: defectKeys.includes(key) ? 'defect' : 'approved',
    };
  }
  return results;
}

// ── computeStatusDistribution ──

describe('computeStatusDistribution', () => {
  it('returns empty array for no audits', () => {
    expect(computeStatusDistribution([])).toEqual([]);
  });

  it('counts approved, rejected, and in_progress', () => {
    const audits = [
      makeAudit({ status: 'approved' }),
      makeAudit({ status: 'approved' }),
      makeAudit({ status: 'rejected' }),
      makeAudit({ status: 'in_progress' }),
    ];
    const result = computeStatusDistribution(audits);
    expect(result).toEqual([
      { name: 'Aprobadas', value: 2, color: '#16a34a' },
      { name: 'Rechazadas', value: 1, color: '#dc2626' },
      { name: 'En progreso', value: 1, color: '#d97706' },
    ]);
  });

  it('omits statuses with 0 count', () => {
    const audits = [
      makeAudit({ status: 'approved' }),
      makeAudit({ status: 'approved' }),
    ];
    const result = computeStatusDistribution(audits);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Aprobadas');
    expect(result[0].value).toBe(2);
  });

  it('handles all in_progress', () => {
    const audits = [
      makeAudit({ status: 'in_progress' }),
      makeAudit({ status: 'in_progress' }),
    ];
    const result = computeStatusDistribution(audits);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('En progreso');
  });
});

// ── computeDefectsByItem ──

describe('computeDefectsByItem', () => {
  it('returns empty array when no audits', () => {
    expect(computeDefectsByItem([])).toEqual([]);
  });

  it('returns empty array when no defects', () => {
    const audits = [makeAudit({ checklist_results: makeChecklistResults([]) })];
    expect(computeDefectsByItem(audits)).toEqual([]);
  });

  it('counts defects per checklist item', () => {
    const audits = [
      makeAudit({ checklist_results: makeChecklistResults(['ext_carroceria', 'int_tapiceria']) }),
      makeAudit({ checklist_results: makeChecklistResults(['ext_carroceria']) }),
    ];
    const result = computeDefectsByItem(audits);
    // ext_carroceria has 2 defects, int_tapiceria has 1
    const carroceria = result.find((d) => d.key === 'ext_carroceria');
    const tapiceria = result.find((d) => d.key === 'int_tapiceria');
    expect(carroceria?.defects).toBe(2);
    expect(tapiceria?.defects).toBe(1);
  });

  it('sorts by defect count descending', () => {
    const audits = [
      makeAudit({ checklist_results: makeChecklistResults(['ext_carroceria', 'int_tapiceria', 'mec_avisos']) }),
      makeAudit({ checklist_results: makeChecklistResults(['ext_carroceria', 'mec_avisos']) }),
      makeAudit({ checklist_results: makeChecklistResults(['ext_carroceria']) }),
    ];
    const result = computeDefectsByItem(audits);
    expect(result[0].key).toBe('ext_carroceria');
    expect(result[0].defects).toBe(3);
    expect(result[1].defects).toBe(2); // mec_avisos
    expect(result[2].defects).toBe(1); // int_tapiceria
  });

  it('includes category label for each item', () => {
    const audits = [
      makeAudit({ checklist_results: makeChecklistResults(['ext_carroceria']) }),
    ];
    const result = computeDefectsByItem(audits);
    expect(result[0].category).toBe('Exterior');
  });

  it('handles audits with null/undefined checklist_results gracefully', () => {
    const audits = [
      makeAudit({ checklist_results: null as any }),
      makeAudit({ checklist_results: undefined as any }),
      makeAudit({ checklist_results: makeChecklistResults(['ext_luces']) }),
    ];
    const result = computeDefectsByItem(audits);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('ext_luces');
  });
});

// ── computeDefectsByCategory ──

describe('computeDefectsByCategory', () => {
  it('returns empty array when no audits', () => {
    expect(computeDefectsByCategory([])).toEqual([]);
  });

  it('groups defects by category', () => {
    const audits = [
      makeAudit({
        checklist_results: makeChecklistResults([
          'ext_carroceria', 'ext_cristales', // 2 exterior
          'int_tapiceria', // 1 interior
        ]),
      }),
    ];
    const result = computeDefectsByCategory(audits);
    const exterior = result.find((c) => c.category === 'Exterior');
    const interior = result.find((c) => c.category === 'Interior');
    expect(exterior?.defects).toBe(2);
    expect(interior?.defects).toBe(1);
  });

  it('sorts by defect count descending', () => {
    const audits = [
      makeAudit({
        checklist_results: makeChecklistResults([
          'ext_carroceria', 'ext_cristales', 'ext_neumaticos', // 3 exterior
          'int_tapiceria', 'int_salpicadero', // 2 interior
          'mec_avisos', // 1 mecanica
        ]),
      }),
    ];
    const result = computeDefectsByCategory(audits);
    expect(result[0].category).toBe('Exterior');
    expect(result[0].defects).toBe(3);
    expect(result[1].category).toBe('Interior');
    expect(result[1].defects).toBe(2);
    expect(result[2].category).toBe('Mecánica');
    expect(result[2].defects).toBe(1);
  });

  it('handles null checklist_results', () => {
    const audits = [makeAudit({ checklist_results: null as any })];
    expect(computeDefectsByCategory(audits)).toEqual([]);
  });
});

// ── computeKPIs ──

describe('computeKPIs', () => {
  it('returns zeros for empty audits', () => {
    const kpis = computeKPIs([]);
    expect(kpis.avgScore).toBe(0);
    expect(kpis.approvalRate).toBe(0);
    expect(kpis.avgDefects).toBe(0);
    expect(kpis.totalAudits).toBe(0);
  });

  it('calculates average score from completed audits only', () => {
    const audits = [
      makeAudit({ status: 'approved', overall_score: 90 }),
      makeAudit({ status: 'rejected', overall_score: 60 }),
      makeAudit({ status: 'in_progress', overall_score: 50 }), // should be excluded
    ];
    const kpis = computeKPIs(audits);
    expect(kpis.avgScore).toBe(75); // (90 + 60) / 2
    expect(kpis.totalAudits).toBe(2); // only completed
  });

  it('calculates approval rate correctly', () => {
    const audits = [
      makeAudit({ status: 'approved' }),
      makeAudit({ status: 'approved' }),
      makeAudit({ status: 'approved' }),
      makeAudit({ status: 'rejected' }),
    ];
    const kpis = computeKPIs(audits);
    expect(kpis.approvalRate).toBe(75); // 3/4
  });

  it('calculates average defects per audit', () => {
    const audits = [
      makeAudit({
        status: 'approved',
        checklist_results: makeChecklistResults(['ext_carroceria', 'int_tapiceria']),
      }),
      makeAudit({
        status: 'rejected',
        checklist_results: makeChecklistResults(['ext_carroceria']),
      }),
    ];
    const kpis = computeKPIs(audits);
    expect(kpis.avgDefects).toBe(1.5); // (2 + 1) / 2
  });

  it('handles 100% approval rate', () => {
    const audits = [
      makeAudit({ status: 'approved', overall_score: 95 }),
      makeAudit({ status: 'approved', overall_score: 100 }),
    ];
    const kpis = computeKPIs(audits);
    expect(kpis.approvalRate).toBe(100);
    expect(kpis.avgScore).toBe(98); // (95 + 100) / 2 rounded
  });

  it('handles 0% approval rate', () => {
    const audits = [
      makeAudit({ status: 'rejected', overall_score: 30 }),
      makeAudit({ status: 'rejected', overall_score: 40 }),
    ];
    const kpis = computeKPIs(audits);
    expect(kpis.approvalRate).toBe(0);
  });
});

// ── computeMonthlyScores ──

describe('computeMonthlyScores', () => {
  it('returns correct number of months', () => {
    const result = computeMonthlyScores([], 6);
    expect(result).toHaveLength(6);
  });

  it('returns 0 avgScore when no audits in a month', () => {
    const result = computeMonthlyScores([], 3);
    for (const month of result) {
      expect(month.avgScore).toBe(0);
      expect(month.count).toBe(0);
    }
  });

  it('calculates average score for audits in the current month', () => {
    const now = new Date();
    const audits = [
      makeAudit({ status: 'approved', overall_score: 80, created_at: now.toISOString() }),
      makeAudit({ status: 'rejected', overall_score: 60, created_at: now.toISOString() }),
    ];
    const result = computeMonthlyScores(audits, 1);
    // The current month should have the average
    const lastMonth = result[result.length - 1];
    expect(lastMonth.avgScore).toBe(70); // (80 + 60) / 2
    expect(lastMonth.count).toBe(2);
  });

  it('excludes in_progress audits from monthly averages', () => {
    const now = new Date();
    const audits = [
      makeAudit({ status: 'approved', overall_score: 90, created_at: now.toISOString() }),
      makeAudit({ status: 'in_progress', overall_score: 50, created_at: now.toISOString() }),
    ];
    const result = computeMonthlyScores(audits, 1);
    const lastMonth = result[result.length - 1];
    expect(lastMonth.avgScore).toBe(90); // only the approved one
    expect(lastMonth.count).toBe(1);
  });

  it('each month entry has month label', () => {
    const result = computeMonthlyScores([], 3);
    for (const month of result) {
      expect(month.month).toBeTruthy();
      expect(typeof month.month).toBe('string');
    }
  });
});
