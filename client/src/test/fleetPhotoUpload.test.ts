import { describe, it, expect } from 'vitest';
import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_GROUPS,
} from '../types/fleet';
import type {
  PhotoCategory,
  FleetInspectionPhoto,
  PhotoCategoryGroup,
} from '../types/fleet';

// =============================================================================
// Missing categories logic – mirrors the computation in FleetInspectionDetail
// =============================================================================

function computeMissingCategories(photos: FleetInspectionPhoto[]): PhotoCategory[] {
  const photosPerCategory = new Map<string, FleetInspectionPhoto[]>();
  for (const p of photos) {
    const existing = photosPerCategory.get(p.photo_category) || [];
    existing.push(p);
    photosPerCategory.set(p.photo_category, existing);
  }
  const expectedKeys = PHOTO_CATEGORY_GROUPS
    .flatMap(g => g.items.map(i => i.key))
    .filter(k => k !== 'general' && k !== 'dano_detalle');
  return expectedKeys.filter(k => !photosPerCategory.has(k)) as PhotoCategory[];
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

describe('computeMissingCategories', () => {
  it('returns all expected categories when no photos exist', () => {
    const missing = computeMissingCategories([]);
    // Should include all categories from PHOTO_CATEGORY_GROUPS except general and dano_detalle
    const allExpected = PHOTO_CATEGORY_GROUPS
      .flatMap(g => g.items.map(i => i.key))
      .filter(k => k !== 'general' && k !== 'dano_detalle');
    expect(missing).toEqual(allExpected);
    expect(missing.length).toBe(12); // 4 exterior + 4 interior + 4 ruedas
  });

  it('excludes categories that have photos', () => {
    const photos = [
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'trasera' }),
    ];
    const missing = computeMissingCategories(photos);
    expect(missing).not.toContain('frontal');
    expect(missing).not.toContain('trasera');
    expect(missing).toContain('lateral_izq');
    expect(missing).toContain('lateral_der');
    expect(missing.length).toBe(10); // 12 - 2
  });

  it('returns empty when all expected categories have photos', () => {
    const allExpected = PHOTO_CATEGORY_GROUPS
      .flatMap(g => g.items.map(i => i.key))
      .filter(k => k !== 'general' && k !== 'dano_detalle');
    const photos = allExpected.map(key => makePhoto({ photo_category: key as PhotoCategory }));
    const missing = computeMissingCategories(photos);
    expect(missing).toEqual([]);
  });

  it('ignores general and dano_detalle categories in missing list', () => {
    const photos = [makePhoto({ photo_category: 'general' })];
    const missing = computeMissingCategories(photos);
    expect(missing).not.toContain('general');
    expect(missing).not.toContain('dano_detalle');
    // general and dano_detalle are never in the missing list
    expect(missing.length).toBe(12);
  });

  it('handles multiple photos in same category correctly', () => {
    const photos = [
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'frontal' }),
    ];
    const missing = computeMissingCategories(photos);
    expect(missing).not.toContain('frontal');
    expect(missing.length).toBe(11);
  });

  it('handles a realistic partial inspection (exterior only)', () => {
    const photos = [
      makePhoto({ photo_category: 'frontal' }),
      makePhoto({ photo_category: 'trasera' }),
      makePhoto({ photo_category: 'lateral_izq' }),
      makePhoto({ photo_category: 'lateral_der' }),
    ];
    const missing = computeMissingCategories(photos);
    // All exterior covered, interior and ruedas missing
    expect(missing).not.toContain('frontal');
    expect(missing).not.toContain('trasera');
    expect(missing).not.toContain('lateral_izq');
    expect(missing).not.toContain('lateral_der');
    expect(missing).toContain('interior');
    expect(missing).toContain('salpicadero');
    expect(missing).toContain('maletero');
    expect(missing).toContain('motor');
    expect(missing).toContain('rueda_del_izq');
    expect(missing).toContain('rueda_del_der');
    expect(missing).toContain('rueda_tras_izq');
    expect(missing).toContain('rueda_tras_der');
    expect(missing.length).toBe(8);
  });
});

// =============================================================================
// PHOTO_CATEGORIES data integrity
// =============================================================================

describe('PHOTO_CATEGORIES data integrity', () => {
  it('has at least 10 categories', () => {
    expect(PHOTO_CATEGORIES.length).toBeGreaterThanOrEqual(10);
  });

  it('all categories have non-empty key and label', () => {
    for (const cat of PHOTO_CATEGORIES) {
      expect(cat.key).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(typeof cat.key).toBe('string');
      expect(typeof cat.label).toBe('string');
    }
  });

  it('has no duplicate keys', () => {
    const keys = PHOTO_CATEGORIES.map(c => c.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('includes essential categories', () => {
    const keys = PHOTO_CATEGORIES.map(c => c.key);
    expect(keys).toContain('frontal');
    expect(keys).toContain('trasera');
    expect(keys).toContain('interior');
    expect(keys).toContain('general');
    expect(keys).toContain('dano_detalle');
  });
});

// =============================================================================
// PHOTO_CATEGORY_GROUPS data integrity
// =============================================================================

describe('PHOTO_CATEGORY_GROUPS data integrity', () => {
  it('has at least 3 groups', () => {
    expect(PHOTO_CATEGORY_GROUPS.length).toBeGreaterThanOrEqual(3);
  });

  it('all group items reference valid PhotoCategory keys', () => {
    const validKeys = new Set(PHOTO_CATEGORIES.map(c => c.key));
    for (const group of PHOTO_CATEGORY_GROUPS) {
      for (const item of group.items) {
        expect(validKeys.has(item.key)).toBe(true);
      }
    }
  });

  it('covers all PHOTO_CATEGORIES keys across groups', () => {
    const groupKeys = new Set(PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key)));
    for (const cat of PHOTO_CATEGORIES) {
      // ruedas (general) may not be in groups, that's ok
      if (cat.key === 'ruedas') continue;
      expect(groupKeys.has(cat.key)).toBe(true);
    }
  });

  it('each group has a non-empty name', () => {
    for (const group of PHOTO_CATEGORY_GROUPS) {
      expect(group.group).toBeTruthy();
      expect(typeof group.group).toBe('string');
    }
  });

  it('includes Exterior, Interior, and Ruedas groups', () => {
    const groupNames = PHOTO_CATEGORY_GROUPS.map(g => g.group);
    expect(groupNames).toContain('Exterior');
    expect(groupNames).toContain('Interior');
    expect(groupNames).toContain('Ruedas');
  });
});

// =============================================================================
// FleetInspectionPhoto type contract
// =============================================================================

describe('FleetInspectionPhoto type contract', () => {
  it('can create a valid photo object', () => {
    const photo: FleetInspectionPhoto = {
      id: 'test-id',
      inspection_id: 'insp-1',
      organization_id: 'org-1',
      storage_path: 'org-1/fleet/v1/photos/123.jpg',
      file_name: 'photo.jpg',
      photo_category: 'frontal',
      description: null,
      uploaded_by: null,
      created_at: '2025-01-01T00:00:00Z',
    };
    expect(photo.id).toBe('test-id');
    expect(photo.photo_category).toBe('frontal');
    expect(photo.description).toBeNull();
  });

  it('accepts all valid photo categories', () => {
    const categories: PhotoCategory[] = [
      'frontal', 'trasera', 'lateral_izq', 'lateral_der',
      'interior', 'salpicadero', 'maletero', 'motor',
      'rueda_del_der', 'rueda_del_izq', 'rueda_tras_der', 'rueda_tras_izq',
      'ruedas', 'dano_detalle', 'general',
    ];
    for (const cat of categories) {
      const photo = makePhoto({ photo_category: cat });
      expect(photo.photo_category).toBe(cat);
    }
  });
});
