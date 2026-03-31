import { describe, it, expect } from 'vitest';
import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_GROUPS,
  DAMAGE_ZONES,
} from '../types/fleet';
import type {
  FleetVehicleInspection,
  FleetVehicle,
  FleetInspectionPhoto,
  FleetInspectionDamage,
  PhotoCategory,
  DamageSeverity,
  InspectionType,
} from '../types/fleet';

// =============================================================================
// Helpers — mirrors logic in useComparativeInspectionPdf
// =============================================================================

const FUEL_LABELS: Record<string, string> = {
  '0': 'Vacío',
  '1': '1/8',
  '2': '2/8 (1/4)',
  '3': '3/8',
  '4': '4/8 (1/2)',
  '5': '5/8',
  '6': '6/8 (3/4)',
  '7': '7/8',
  '8': 'Lleno',
};

const SEVERITY_CONFIG: Record<string, { label: string }> = {
  grave: { label: 'Grave' },
  moderado: { label: 'Moderado' },
  leve: { label: 'Leve' },
};

function getFuelLabel(nivel: string | null | undefined): string {
  if (nivel == null) return '—';
  return FUEL_LABELS[String(nivel)] || `${nivel}/8`;
}

function computeKmDifference(
  recKm: number | null,
  devKm: number | null,
): string {
  if (recKm == null || devKm == null) return '—';
  const diff = devKm - recKm;
  return `${diff >= 0 ? '+' : ''}${diff.toLocaleString('es-ES')} km`;
}

function computeFuelDifference(
  recFuel: string | null | undefined,
  devFuel: string | null | undefined,
): string {
  if (recFuel == null || devFuel == null) return '—';
  const diff = Number(devFuel) - Number(recFuel);
  if (diff === 0) return 'Sin cambio';
  return `${diff > 0 ? '+' : ''}${diff}/8`;
}

function computeDaysDifference(
  recDate: string | null | undefined,
  devDate: string | null | undefined,
): string {
  if (!recDate || !devDate) return '—';
  const diffMs = new Date(devDate).getTime() - new Date(recDate).getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return `${diffDays} días`;
}

function computeNewDamages(recCount: number, devCount: number): number {
  return Math.max(0, devCount - recCount);
}

function getOrderedPhotoCategories(
  recPhotos: FleetInspectionPhoto[],
  devPhotos: FleetInspectionPhoto[],
): PhotoCategory[] {
  const orderedCategories: PhotoCategory[] = [
    ...PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key)),
  ];
  const allCatKeys = Array.from(new Set([
    ...recPhotos.map(p => p.photo_category),
    ...devPhotos.map(p => p.photo_category),
  ]));
  for (const k of allCatKeys) {
    if (!orderedCategories.includes(k)) orderedCategories.push(k);
  }
  return orderedCategories;
}

function generateComparativeFileName(
  matricula: string | null | undefined,
): string {
  const plate = matricula || 'vehiculo';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `Comparativa_${plate}_${dateStr}.pdf`;
}

function canGenerateComparative(
  inspections: FleetVehicleInspection[],
): { canCompare: boolean; recogida?: FleetVehicleInspection; devolucion?: FleetVehicleInspection } {
  const recogida = inspections.find(i => i.inspection_type === 'recogida');
  const devolucion = inspections.find(i => i.inspection_type === 'devolucion');
  return {
    canCompare: !!(recogida && devolucion),
    recogida,
    devolucion,
  };
}

// Test data factories
function makeInspection(overrides: Partial<FleetVehicleInspection> = {}): FleetVehicleInspection {
  return {
    id: `insp-${Math.random().toString(36).slice(2)}`,
    fleet_vehicle_id: 'v-1',
    organization_id: 'org-1',
    inspection_type: 'recogida',
    inspection_date: '2026-03-13T11:29:00Z',
    km: 1371,
    nivel_combustible: '4',
    notas: null,
    inspector_id: 'user-1',
    receipt_url: null,
    created_at: '2026-03-13T11:29:00Z',
    inspector_profile: { name: 'Juan García' },
    photos: [],
    damages: [],
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<FleetVehicle> = {}): FleetVehicle {
  return {
    id: 'v-1',
    organization_id: 'org-1',
    matricula: '3906MWM',
    modelo: 'Ibiza',
    categoria: 'B',
    proveedor: 'ALD Automotive',
    numero_contrato: 'R-2025-001',
    numero_bastidor: 'VSSZZZ6JZWR123456',
    fecha_inicio_contrato: '2025-01-15',
    fecha_fin_contrato: '2028-01-15',
    km_recogida: 0,
    km_devolucion: null,
    status: 'activo',
    notas: null,
    photo_url: null,
    marca: 'SEAT',
    color: 'Blanco',
    combustible: 'Gasolina',
    hibrido: false,
    motor: '1.0 TSI',
    cv: 95,
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2026-03-13T11:29:00Z',
    ...overrides,
  };
}

function makePhoto(overrides: Partial<FleetInspectionPhoto> & { photo_category: PhotoCategory }): FleetInspectionPhoto {
  return {
    id: `photo-${Math.random().toString(36).slice(2)}`,
    inspection_id: 'insp-1',
    organization_id: 'org-1',
    storage_path: `org-1/fleet/v1/photos/${Date.now()}.jpg`,
    file_name: 'test.jpg',
    description: null,
    uploaded_by: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeDamage(overrides: Partial<FleetInspectionDamage> = {}): FleetInspectionDamage {
  return {
    id: `dmg-${Math.random().toString(36).slice(2)}`,
    inspection_id: 'insp-1',
    organization_id: 'org-1',
    zona: 'frontal',
    pieza: 'Parachoques delantero',
    descripcion: 'Arañazo superficial',
    severidad: 'leve',
    ...overrides,
  };
}

// =============================================================================
// KM Difference Tests
// =============================================================================

describe('computeKmDifference', () => {
  it('computes positive km difference', () => {
    const result = computeKmDifference(1371, 5800);
    expect(result).toMatch(/^\+4[.,]?429 km$/);
  });

  it('computes zero km difference', () => {
    expect(computeKmDifference(1000, 1000)).toBe('+0 km');
  });

  it('handles negative difference (return km < pickup km)', () => {
    const result = computeKmDifference(5000, 3000);
    expect(result).toContain('-');
    expect(result).toContain('km');
  });

  it('returns "—" when recogida km is null', () => {
    expect(computeKmDifference(null, 5000)).toBe('—');
  });

  it('returns "—" when devolucion km is null', () => {
    expect(computeKmDifference(1000, null)).toBe('—');
  });

  it('returns "—" when both are null', () => {
    expect(computeKmDifference(null, null)).toBe('—');
  });
});

// =============================================================================
// Fuel Difference Tests
// =============================================================================

describe('computeFuelDifference', () => {
  it('computes positive fuel difference', () => {
    expect(computeFuelDifference('4', '6')).toBe('+2/8');
  });

  it('computes negative fuel difference', () => {
    expect(computeFuelDifference('6', '3')).toBe('-3/8');
  });

  it('returns "Sin cambio" for equal levels', () => {
    expect(computeFuelDifference('4', '4')).toBe('Sin cambio');
  });

  it('returns "—" when recogida fuel is null', () => {
    expect(computeFuelDifference(null, '6')).toBe('—');
  });

  it('returns "—" when devolucion fuel is null', () => {
    expect(computeFuelDifference('4', null)).toBe('—');
  });

  it('handles extreme values (0 to 8)', () => {
    expect(computeFuelDifference('0', '8')).toBe('+8/8');
  });

  it('handles extreme values (8 to 0)', () => {
    expect(computeFuelDifference('8', '0')).toBe('-8/8');
  });
});

// =============================================================================
// Days Difference Tests
// =============================================================================

describe('computeDaysDifference', () => {
  it('computes correct days between dates', () => {
    expect(computeDaysDifference('2026-03-01T10:00:00Z', '2026-03-15T10:00:00Z')).toBe('14 días');
  });

  it('computes 0 days for same date', () => {
    expect(computeDaysDifference('2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z')).toBe('0 días');
  });

  it('computes 1 day difference', () => {
    expect(computeDaysDifference('2026-03-01T10:00:00Z', '2026-03-02T10:00:00Z')).toBe('1 días');
  });

  it('returns "—" when recogida date is null', () => {
    expect(computeDaysDifference(null, '2026-03-15T10:00:00Z')).toBe('—');
  });

  it('returns "—" when devolucion date is null', () => {
    expect(computeDaysDifference('2026-03-01T10:00:00Z', null)).toBe('—');
  });

  it('handles long rental periods', () => {
    expect(computeDaysDifference('2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe('365 días');
  });
});

// =============================================================================
// New Damages Detection Tests
// =============================================================================

describe('computeNewDamages', () => {
  it('detects new damages in devolucion', () => {
    expect(computeNewDamages(2, 5)).toBe(3);
  });

  it('returns 0 when no new damages', () => {
    expect(computeNewDamages(3, 3)).toBe(0);
  });

  it('returns 0 when devolucion has fewer damages', () => {
    expect(computeNewDamages(5, 2)).toBe(0);
  });

  it('handles zero damages on both sides', () => {
    expect(computeNewDamages(0, 0)).toBe(0);
  });

  it('detects all damages as new when recogida has none', () => {
    expect(computeNewDamages(0, 4)).toBe(4);
  });
});

// =============================================================================
// canGenerateComparative Tests
// =============================================================================

describe('canGenerateComparative', () => {
  it('returns true when both recogida and devolucion exist', () => {
    const inspections = [
      makeInspection({ inspection_type: 'recogida' }),
      makeInspection({ inspection_type: 'devolucion' }),
    ];
    const result = canGenerateComparative(inspections);
    expect(result.canCompare).toBe(true);
    expect(result.recogida?.inspection_type).toBe('recogida');
    expect(result.devolucion?.inspection_type).toBe('devolucion');
  });

  it('returns false when only recogida exists', () => {
    const inspections = [
      makeInspection({ inspection_type: 'recogida' }),
    ];
    const result = canGenerateComparative(inspections);
    expect(result.canCompare).toBe(false);
    expect(result.devolucion).toBeUndefined();
  });

  it('returns false when only devolucion exists', () => {
    const inspections = [
      makeInspection({ inspection_type: 'devolucion' }),
    ];
    const result = canGenerateComparative(inspections);
    expect(result.canCompare).toBe(false);
    expect(result.recogida).toBeUndefined();
  });

  it('returns false when no inspections exist', () => {
    const result = canGenerateComparative([]);
    expect(result.canCompare).toBe(false);
  });

  it('picks the first recogida and first devolucion when multiple exist', () => {
    const inspections = [
      makeInspection({ id: 'r1', inspection_type: 'recogida', inspection_date: '2026-01-01' }),
      makeInspection({ id: 'r2', inspection_type: 'recogida', inspection_date: '2026-02-01' }),
      makeInspection({ id: 'd1', inspection_type: 'devolucion', inspection_date: '2026-03-01' }),
    ];
    const result = canGenerateComparative(inspections);
    expect(result.canCompare).toBe(true);
    expect(result.recogida?.id).toBe('r1');
    expect(result.devolucion?.id).toBe('d1');
  });
});

// =============================================================================
// Photo Category Ordering for Comparative Tests
// =============================================================================

describe('getOrderedPhotoCategories (comparative)', () => {
  it('merges categories from both inspections', () => {
    const recPhotos = [makePhoto({ photo_category: 'frontal' })];
    const devPhotos = [makePhoto({ photo_category: 'trasera' })];
    const ordered = getOrderedPhotoCategories(recPhotos, devPhotos);
    expect(ordered).toContain('frontal');
    expect(ordered).toContain('trasera');
  });

  it('does not duplicate categories present in both', () => {
    const recPhotos = [makePhoto({ photo_category: 'frontal' })];
    const devPhotos = [makePhoto({ photo_category: 'frontal' })];
    const ordered = getOrderedPhotoCategories(recPhotos, devPhotos);
    const frontalCount = ordered.filter(c => c === 'frontal').length;
    expect(frontalCount).toBe(1);
  });

  it('returns all group categories even with empty photos', () => {
    const ordered = getOrderedPhotoCategories([], []);
    const groupKeys = PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key));
    expect(ordered).toEqual(groupKeys);
  });

  it('preserves group ordering', () => {
    const recPhotos = [makePhoto({ photo_category: 'maletero' })];
    const devPhotos = [makePhoto({ photo_category: 'frontal' })];
    const ordered = getOrderedPhotoCategories(recPhotos, devPhotos);
    const frontalIdx = ordered.indexOf('frontal');
    const maleteroIdx = ordered.indexOf('maletero');
    expect(frontalIdx).toBeLessThan(maleteroIdx);
  });
});

// =============================================================================
// File Name Generation Tests
// =============================================================================

describe('generateComparativeFileName', () => {
  it('generates correct name with matricula', () => {
    const name = generateComparativeFileName('3906MWM');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(name).toBe(`Comparativa_3906MWM_${today}.pdf`);
  });

  it('uses "vehiculo" when matricula is null', () => {
    const name = generateComparativeFileName(null);
    expect(name).toContain('vehiculo');
  });

  it('always ends with .pdf', () => {
    const name = generateComparativeFileName('ABC123');
    expect(name).toMatch(/\.pdf$/);
  });

  it('starts with "Comparativa_"', () => {
    const name = generateComparativeFileName('XYZ789');
    expect(name).toMatch(/^Comparativa_/);
  });
});

// =============================================================================
// Comparative Data Completeness Tests
// =============================================================================

describe('Comparative data completeness', () => {
  it('creates valid paired inspections', () => {
    const recogida = makeInspection({
      inspection_type: 'recogida',
      km: 1371,
      nivel_combustible: '6',
      inspection_date: '2026-03-01T10:00:00Z',
    });
    const devolucion = makeInspection({
      inspection_type: 'devolucion',
      km: 5800,
      nivel_combustible: '3',
      inspection_date: '2026-03-15T10:00:00Z',
    });

    expect(recogida.inspection_type).toBe('recogida');
    expect(devolucion.inspection_type).toBe('devolucion');
    expect(computeKmDifference(recogida.km, devolucion.km)).toMatch(/^\+4[.,]?429 km$/);
    expect(computeFuelDifference(recogida.nivel_combustible, devolucion.nivel_combustible)).toBe('-3/8');
    expect(computeDaysDifference(recogida.inspection_date, devolucion.inspection_date)).toBe('14 días');
  });

  it('handles inspection pair with damages', () => {
    const recDamages = [makeDamage({ severidad: 'leve' })];
    const devDamages = [
      makeDamage({ severidad: 'leve' }),
      makeDamage({ severidad: 'moderado' }),
      makeDamage({ severidad: 'grave' }),
    ];

    const recogida = makeInspection({ damages: recDamages });
    const devolucion = makeInspection({ damages: devDamages });

    const newDamages = computeNewDamages(
      recogida.damages?.length || 0,
      devolucion.damages?.length || 0,
    );
    expect(newDamages).toBe(2);
  });

  it('handles inspection pair with photos in different categories', () => {
    const recPhotos = [
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'trasera' }),
    ];
    const devPhotos = [
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'lateral_izq' }),
      makePhoto({ photo_category: 'interior' }),
    ];

    const categories = getOrderedPhotoCategories(recPhotos, devPhotos);
    expect(categories).toContain('frontal');
    expect(categories).toContain('trasera');
    expect(categories).toContain('lateral_izq');
    expect(categories).toContain('interior');
  });

  it('handles inspection pair with all null optional fields', () => {
    const recogida = makeInspection({
      inspection_type: 'recogida',
      km: null,
      nivel_combustible: null,
      notas: null,
      photos: [],
      damages: [],
    });
    const devolucion = makeInspection({
      inspection_type: 'devolucion',
      km: null,
      nivel_combustible: null,
      notas: null,
      photos: [],
      damages: [],
    });

    expect(computeKmDifference(recogida.km, devolucion.km)).toBe('—');
    expect(computeFuelDifference(recogida.nivel_combustible, devolucion.nivel_combustible)).toBe('—');
    expect(computeNewDamages(0, 0)).toBe(0);
  });
});

// =============================================================================
// Damage Table Pairing Tests
// =============================================================================

describe('Damage table pairing logic', () => {
  it('pairs damages row by row', () => {
    const recDamages = [
      makeDamage({ zona: 'frontal', pieza: 'Parachoques' }),
      makeDamage({ zona: 'lateral_izq', pieza: 'Puerta' }),
    ];
    const devDamages = [
      makeDamage({ zona: 'frontal', pieza: 'Parachoques' }),
      makeDamage({ zona: 'trasera', pieza: 'Piloto' }),
      makeDamage({ zona: 'techo', pieza: 'Techo' }),
    ];

    const maxRows = Math.max(recDamages.length, devDamages.length);
    expect(maxRows).toBe(3);

    // Row 0: both have data
    expect(recDamages[0]).toBeDefined();
    expect(devDamages[0]).toBeDefined();

    // Row 1: both have data
    expect(recDamages[1]).toBeDefined();
    expect(devDamages[1]).toBeDefined();

    // Row 2: only devolucion has data
    expect(recDamages[2]).toBeUndefined();
    expect(devDamages[2]).toBeDefined();
  });

  it('handles empty damages on recogida side', () => {
    const recDamages: FleetInspectionDamage[] = [];
    const devDamages = [makeDamage({ zona: 'frontal' })];

    const maxRows = Math.max(recDamages.length, devDamages.length);
    expect(maxRows).toBe(1);
    expect(recDamages[0]).toBeUndefined();
    expect(devDamages[0]).toBeDefined();
  });

  it('handles empty damages on devolucion side', () => {
    const recDamages = [makeDamage({ zona: 'frontal' })];
    const devDamages: FleetInspectionDamage[] = [];

    const maxRows = Math.max(recDamages.length, devDamages.length);
    expect(maxRows).toBe(1);
    expect(recDamages[0]).toBeDefined();
    expect(devDamages[0]).toBeUndefined();
  });
});
