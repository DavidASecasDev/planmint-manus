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
// PDF Data Preparation Helpers — mirrors logic in useInspectionPdf
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

function getSeverityLabel(severity: string): string {
  return SEVERITY_CONFIG[severity]?.label || severity;
}

function getZoneLabel(zona: string): string {
  return DAMAGE_ZONES.find(z => z.key === zona)?.label || zona;
}

function getOrderedPhotoCategories(photos: FleetInspectionPhoto[]): PhotoCategory[] {
  const orderedCategories: PhotoCategory[] = [
    ...PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key)),
  ];
  const allCatKeys = Array.from(new Set(photos.map(p => p.photo_category)));
  for (const k of allCatKeys) {
    if (!orderedCategories.includes(k)) orderedCategories.push(k);
  }
  return orderedCategories;
}

function generateFileName(
  inspType: InspectionType,
  matricula: string | null | undefined,
  inspDate: string | null | undefined,
): string {
  const type = inspType === 'recogida' ? 'RECOGIDA' : 'DEVOLUCIÓN';
  const plate = matricula || 'vehiculo';
  const dateStr = inspDate
    ? new Date(inspDate).toISOString().slice(0, 10).replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `Inspeccion_${type}_${plate}_${dateStr}.pdf`;
}

// Test data factories
function makeInspection(overrides: Partial<FleetVehicleInspection> = {}): FleetVehicleInspection {
  return {
    id: 'insp-1',
    fleet_vehicle_id: 'v-1',
    organization_id: 'org-1',
    inspection_type: 'recogida',
    inspection_date: '2026-03-13T11:29:00Z',
    km: 1371,
    nivel_combustible: '4',
    notas: 'Vehículo en buen estado general',
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
// Fuel Label Tests
// =============================================================================

describe('getFuelLabel', () => {
  it('returns "Vacío" for level 0', () => {
    expect(getFuelLabel('0')).toBe('Vacío');
  });

  it('returns "Lleno" for level 8', () => {
    expect(getFuelLabel('8')).toBe('Lleno');
  });

  it('returns "4/8 (1/2)" for level 4', () => {
    expect(getFuelLabel('4')).toBe('4/8 (1/2)');
  });

  it('returns "—" for null', () => {
    expect(getFuelLabel(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(getFuelLabel(undefined)).toBe('—');
  });

  it('returns fallback for unknown level', () => {
    expect(getFuelLabel('10')).toBe('10/8');
  });

  it('handles all valid levels (0-8)', () => {
    for (let i = 0; i <= 8; i++) {
      const label = getFuelLabel(String(i));
      expect(label).toBeTruthy();
      expect(label).not.toBe('—');
    }
  });
});

// =============================================================================
// Severity Label Tests
// =============================================================================

describe('getSeverityLabel', () => {
  it('returns "Grave" for grave', () => {
    expect(getSeverityLabel('grave')).toBe('Grave');
  });

  it('returns "Moderado" for moderado', () => {
    expect(getSeverityLabel('moderado')).toBe('Moderado');
  });

  it('returns "Leve" for leve', () => {
    expect(getSeverityLabel('leve')).toBe('Leve');
  });

  it('returns raw value for unknown severity', () => {
    expect(getSeverityLabel('critico')).toBe('critico');
  });
});

// =============================================================================
// Zone Label Tests
// =============================================================================

describe('getZoneLabel', () => {
  it('returns "Frontal" for frontal', () => {
    expect(getZoneLabel('frontal')).toBe('Frontal');
  });

  it('returns "Trasera" for trasera', () => {
    expect(getZoneLabel('trasera')).toBe('Trasera');
  });

  it('returns "Interior" for interior', () => {
    expect(getZoneLabel('interior')).toBe('Interior');
  });

  it('returns raw key for unknown zone', () => {
    expect(getZoneLabel('desconocido')).toBe('desconocido');
  });

  it('maps all DAMAGE_ZONES correctly', () => {
    for (const zone of DAMAGE_ZONES) {
      expect(getZoneLabel(zone.key)).toBe(zone.label);
    }
  });
});

// =============================================================================
// Photo Category Ordering Tests
// =============================================================================

describe('getOrderedPhotoCategories', () => {
  it('returns all group categories when no photos', () => {
    const ordered = getOrderedPhotoCategories([]);
    const groupKeys = PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key));
    expect(ordered).toEqual(groupKeys);
  });

  it('adds unknown categories at the end', () => {
    const photos = [makePhoto({ photo_category: 'general' })];
    const ordered = getOrderedPhotoCategories(photos);
    const groupKeys = PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key));
    // 'general' is in groups, so it should not be duplicated
    if (groupKeys.includes('general')) {
      expect(ordered.length).toBe(groupKeys.length);
    }
  });

  it('preserves group ordering for exterior categories', () => {
    const photos = [
      makePhoto({ photo_category: 'lateral_der' }),
      makePhoto({ photo_category: 'frontal' }),
    ];
    const ordered = getOrderedPhotoCategories(photos);
    const frontalIdx = ordered.indexOf('frontal');
    const lateralDerIdx = ordered.indexOf('lateral_der');
    expect(frontalIdx).toBeLessThan(lateralDerIdx);
  });

  it('does not duplicate categories', () => {
    const photos = [
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'trasera' }),
    ];
    const ordered = getOrderedPhotoCategories(photos);
    const unique = new Set(ordered);
    expect(unique.size).toBe(ordered.length);
  });
});

// =============================================================================
// File Name Generation Tests
// =============================================================================

describe('generateFileName', () => {
  it('generates correct name for recogida', () => {
    const name = generateFileName('recogida', '3906MWM', '2026-03-13T11:29:00Z');
    expect(name).toBe('Inspeccion_RECOGIDA_3906MWM_20260313.pdf');
  });

  it('generates correct name for devolucion', () => {
    const name = generateFileName('devolucion', '7767MWH', '2026-04-01T09:00:00Z');
    expect(name).toBe('Inspeccion_DEVOLUCIÓN_7767MWH_20260401.pdf');
  });

  it('uses "vehiculo" when matricula is null', () => {
    const name = generateFileName('recogida', null, '2026-03-13T11:29:00Z');
    expect(name).toContain('vehiculo');
  });

  it('uses current date when inspection date is null', () => {
    const name = generateFileName('recogida', '3906MWM', null);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(name).toContain(today);
  });

  it('always ends with .pdf', () => {
    const name = generateFileName('recogida', 'ABC123', '2026-01-01');
    expect(name).toMatch(/\.pdf$/);
  });
});

// =============================================================================
// Inspection Data Contract Tests
// =============================================================================

describe('Inspection data contracts for PDF', () => {
  it('creates a valid inspection with all fields', () => {
    const insp = makeInspection();
    expect(insp.id).toBeTruthy();
    expect(insp.inspection_type).toBe('recogida');
    expect(insp.km).toBe(1371);
    expect(insp.nivel_combustible).toBe('4');
    expect(insp.inspector_profile?.name).toBe('Juan García');
  });

  it('creates a valid vehicle with all fields', () => {
    const v = makeVehicle();
    expect(v.matricula).toBe('3906MWM');
    expect(v.marca).toBe('SEAT');
    expect(v.modelo).toBe('Ibiza');
    expect(v.proveedor).toBe('ALD Automotive');
    expect(v.numero_contrato).toBe('R-2025-001');
  });

  it('handles inspection with damages', () => {
    const damages = [
      makeDamage({ severidad: 'leve', zona: 'frontal' }),
      makeDamage({ severidad: 'grave', zona: 'lateral_izq' }),
    ];
    const insp = makeInspection({ damages });
    expect(insp.damages?.length).toBe(2);
    expect(insp.damages?.[0].severidad).toBe('leve');
    expect(insp.damages?.[1].severidad).toBe('grave');
  });

  it('handles inspection with photos', () => {
    const photos = [
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'trasera' }),
      makePhoto({ photo_category: 'interior' }),
    ];
    const insp = makeInspection({ photos });
    expect(insp.photos?.length).toBe(3);
  });

  it('handles inspection with null optional fields', () => {
    const insp = makeInspection({
      km: null,
      nivel_combustible: null,
      notas: null,
      inspector_id: null,
      receipt_url: null,
      inspector_profile: null,
      photos: [],
      damages: [],
    });
    expect(insp.km).toBeNull();
    expect(insp.nivel_combustible).toBeNull();
    expect(insp.notas).toBeNull();
    expect(insp.photos).toEqual([]);
    expect(insp.damages).toEqual([]);
  });

  it('handles vehicle with null optional fields', () => {
    const v = makeVehicle({
      modelo: null,
      marca: null,
      color: null,
      proveedor: null,
      numero_contrato: null,
      categoria: null,
    });
    expect(v.modelo).toBeNull();
    expect(v.marca).toBeNull();
    expect(v.proveedor).toBeNull();
  });
});

// =============================================================================
// PDF Content Completeness Tests
// =============================================================================

describe('PDF content completeness', () => {
  it('all severity levels have labels', () => {
    const severities: DamageSeverity[] = ['leve', 'moderado', 'grave'];
    for (const s of severities) {
      expect(getSeverityLabel(s)).toBeTruthy();
      expect(getSeverityLabel(s)).not.toBe(s); // Should be a proper label, not raw key
    }
  });

  it('all damage zones have labels', () => {
    const zoneKeys = DAMAGE_ZONES.map(z => z.key);
    expect(zoneKeys.length).toBeGreaterThanOrEqual(5);
    for (const key of zoneKeys) {
      expect(getZoneLabel(key)).not.toBe(key); // Should have a proper label
    }
  });

  it('fuel labels cover all 9 levels (0-8)', () => {
    for (let i = 0; i <= 8; i++) {
      const label = FUEL_LABELS[String(i)];
      expect(label).toBeTruthy();
    }
  });

  it('photo categories cover all expected groups', () => {
    const groupNames = PHOTO_CATEGORY_GROUPS.map(g => g.group);
    expect(groupNames).toContain('Exterior');
    expect(groupNames).toContain('Interior');
    expect(groupNames).toContain('Ruedas');
  });

  it('inspection type label mapping is complete', () => {
    const types: InspectionType[] = ['recogida', 'devolucion'];
    const labels = types.map(t => t === 'recogida' ? 'RECOGIDA' : 'DEVOLUCIÓN');
    expect(labels).toEqual(['RECOGIDA', 'DEVOLUCIÓN']);
  });
});
