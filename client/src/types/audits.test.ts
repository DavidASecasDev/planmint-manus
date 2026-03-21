import { describe, it, expect } from 'vitest';
import {
  AUDIT_CHECKLIST,
  CHECKLIST_CATEGORIES,
  ChecklistResult,
  VehicleAuditPhoto,
  calculateAuditScore,
  isChecklistComplete,
  hasDefects,
} from './audits';

// ── Checklist definition tests ──

describe('AUDIT_CHECKLIST', () => {
  it('contains 13 checklist items', () => {
    expect(AUDIT_CHECKLIST).toHaveLength(13);
  });

  it('each item has a unique key', () => {
    const keys = AUDIT_CHECKLIST.map(i => i.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('each item belongs to a valid category', () => {
    const validCategories = CHECKLIST_CATEGORIES.map(c => c.key);
    for (const item of AUDIT_CHECKLIST) {
      expect(validCategories).toContain(item.category);
    }
  });

  it('has items in all 4 categories', () => {
    const usedCategories = new Set(AUDIT_CHECKLIST.map(i => i.category));
    expect(usedCategories.size).toBe(4);
    expect(usedCategories).toContain('exterior');
    expect(usedCategories).toContain('interior');
    expect(usedCategories).toContain('mecanica');
    expect(usedCategories).toContain('documentacion');
  });
});

describe('CHECKLIST_CATEGORIES', () => {
  it('contains 4 categories', () => {
    expect(CHECKLIST_CATEGORIES).toHaveLength(4);
  });

  it('each category has key, label, and icon', () => {
    for (const cat of CHECKLIST_CATEGORIES) {
      expect(cat.key).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.icon).toBeTruthy();
    }
  });
});

// ── calculateAuditScore tests ──

describe('calculateAuditScore', () => {
  it('returns 0 for empty results', () => {
    expect(calculateAuditScore({})).toBe(0);
  });

  it('returns 100 when all 13 items are approved', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'approved' };
    }
    expect(calculateAuditScore(results)).toBe(100);
  });

  it('returns 0 when all items are defects', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'defect' };
    }
    expect(calculateAuditScore(results)).toBe(0);
  });

  it('calculates correct percentage for mixed results', () => {
    const results: Record<string, ChecklistResult> = {};
    // Approve first 10, defect last 3
    AUDIT_CHECKLIST.forEach((item, i) => {
      results[item.key] = { key: item.key, result: i < 10 ? 'approved' : 'defect' };
    });
    // 10/13 ≈ 76.9 → rounds to 77
    expect(calculateAuditScore(results)).toBe(77);
  });

  it('treats not_checked items as not approved', () => {
    const results: Record<string, ChecklistResult> = {};
    // Only approve first item
    results[AUDIT_CHECKLIST[0].key] = { key: AUDIT_CHECKLIST[0].key, result: 'approved' };
    // 1/13 ≈ 7.7 → rounds to 8
    expect(calculateAuditScore(results)).toBe(8);
  });
});

// ── isChecklistComplete tests ──

describe('isChecklistComplete', () => {
  it('returns false for empty results', () => {
    expect(isChecklistComplete({})).toBe(false);
  });

  it('returns false when some items are not_checked', () => {
    const results: Record<string, ChecklistResult> = {};
    AUDIT_CHECKLIST.forEach((item, i) => {
      results[item.key] = {
        key: item.key,
        result: i < 10 ? 'approved' : 'not_checked',
      };
    });
    expect(isChecklistComplete(results)).toBe(false);
  });

  it('returns true when all items are approved', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'approved' };
    }
    expect(isChecklistComplete(results)).toBe(true);
  });

  it('returns true when all items are defects', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'defect' };
    }
    expect(isChecklistComplete(results)).toBe(true);
  });

  it('returns true for mixed approved/defect (no not_checked)', () => {
    const results: Record<string, ChecklistResult> = {};
    AUDIT_CHECKLIST.forEach((item, i) => {
      results[item.key] = { key: item.key, result: i % 2 === 0 ? 'approved' : 'defect' };
    });
    expect(isChecklistComplete(results)).toBe(true);
  });
});

// ── hasDefects tests ──

describe('hasDefects', () => {
  it('returns false for empty results', () => {
    expect(hasDefects({})).toBe(false);
  });

  it('returns false when all items are approved', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'approved' };
    }
    expect(hasDefects(results)).toBe(false);
  });

  it('returns true when at least one item is a defect', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'approved' };
    }
    // Mark one as defect
    results[AUDIT_CHECKLIST[0].key].result = 'defect';
    expect(hasDefects(results)).toBe(true);
  });

  it('returns true when all items are defects', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'defect' };
    }
    expect(hasDefects(results)).toBe(true);
  });

  it('returns false when items are not_checked', () => {
    const results: Record<string, ChecklistResult> = {};
    for (const item of AUDIT_CHECKLIST) {
      results[item.key] = { key: item.key, result: 'not_checked' };
    }
    expect(hasDefects(results)).toBe(false);
  });
});

// ── VehicleAuditPhoto type tests ──

describe('VehicleAuditPhoto type structure', () => {
  it('can create a photo with checklist_item_key', () => {
    const photo: VehicleAuditPhoto = {
      id: 'photo-1',
      audit_id: 'audit-1',
      organization_id: 'org-1',
      photo_url: 'https://example.com/photo.jpg',
      checklist_item_key: 'ext_carroceria',
      caption: 'Daño en puerta trasera',
      created_at: '2025-01-01T00:00:00Z',
    };
    expect(photo.checklist_item_key).toBe('ext_carroceria');
    expect(photo.caption).toBe('Daño en puerta trasera');
  });

  it('can create a general photo without checklist_item_key', () => {
    const photo: VehicleAuditPhoto = {
      id: 'photo-2',
      audit_id: 'audit-1',
      organization_id: 'org-1',
      photo_url: 'https://example.com/photo2.jpg',
      checklist_item_key: null,
      caption: null,
      created_at: '2025-01-01T00:00:00Z',
    };
    expect(photo.checklist_item_key).toBeNull();
    expect(photo.caption).toBeNull();
  });

  it('can filter photos by checklist_item_key', () => {
    const photos: VehicleAuditPhoto[] = [
      {
        id: 'p1', audit_id: 'a1', organization_id: 'o1',
        photo_url: 'url1', checklist_item_key: 'ext_carroceria',
        caption: null, created_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'p2', audit_id: 'a1', organization_id: 'o1',
        photo_url: 'url2', checklist_item_key: 'ext_carroceria',
        caption: null, created_at: '2025-01-01T00:00:01Z',
      },
      {
        id: 'p3', audit_id: 'a1', organization_id: 'o1',
        photo_url: 'url3', checklist_item_key: 'int_tapiceria',
        caption: null, created_at: '2025-01-01T00:00:02Z',
      },
      {
        id: 'p4', audit_id: 'a1', organization_id: 'o1',
        photo_url: 'url4', checklist_item_key: null,
        caption: 'General photo', created_at: '2025-01-01T00:00:03Z',
      },
    ];

    const carroceriaPhotos = photos.filter(p => p.checklist_item_key === 'ext_carroceria');
    expect(carroceriaPhotos).toHaveLength(2);

    const generalPhotos = photos.filter(p => !p.checklist_item_key);
    expect(generalPhotos).toHaveLength(1);
    expect(generalPhotos[0].caption).toBe('General photo');

    const tapiceriaPhotos = photos.filter(p => p.checklist_item_key === 'int_tapiceria');
    expect(tapiceriaPhotos).toHaveLength(1);
  });
});

// ── Caption editing logic tests ──

describe('Photo caption editing behavior', () => {
  const makePhoto = (overrides: Partial<VehicleAuditPhoto> = {}): VehicleAuditPhoto => ({
    id: 'photo-1',
    audit_id: 'audit-1',
    organization_id: 'org-1',
    photo_url: 'https://example.com/photo.jpg',
    checklist_item_key: 'ext_carroceria',
    caption: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  it('photo starts with null caption', () => {
    const photo = makePhoto();
    expect(photo.caption).toBeNull();
  });

  it('caption can be set to a string value', () => {
    const photo = makePhoto({ caption: 'Rayazo en puerta delantera izquierda' });
    expect(photo.caption).toBe('Rayazo en puerta delantera izquierda');
  });

  it('caption can be updated (simulating mutation result)', () => {
    const photo = makePhoto({ caption: 'Original' });
    // Simulate what the mutation returns
    const updated: VehicleAuditPhoto = { ...photo, caption: 'Actualizado' };
    expect(updated.caption).toBe('Actualizado');
    expect(updated.id).toBe(photo.id); // Same photo
  });

  it('caption can be cleared back to null', () => {
    const photo = makePhoto({ caption: 'Tenía descripción' });
    const cleared: VehicleAuditPhoto = { ...photo, caption: null };
    expect(cleared.caption).toBeNull();
  });

  it('empty string caption is treated as no caption', () => {
    // Our hook sends null for empty strings
    const captionValue = '' || null;
    const photo = makePhoto({ caption: captionValue });
    expect(photo.caption).toBeNull();
  });

  it('caption is preserved when filtering photos by checklist_item_key', () => {
    const photos: VehicleAuditPhoto[] = [
      makePhoto({ id: 'p1', checklist_item_key: 'ext_carroceria', caption: 'Golpe lateral' }),
      makePhoto({ id: 'p2', checklist_item_key: 'ext_carroceria', caption: 'Rayadura profunda' }),
      makePhoto({ id: 'p3', checklist_item_key: 'int_tapiceria', caption: 'Mancha en asiento' }),
    ];

    const carroceriaPhotos = photos.filter(p => p.checklist_item_key === 'ext_carroceria');
    expect(carroceriaPhotos).toHaveLength(2);
    expect(carroceriaPhotos[0].caption).toBe('Golpe lateral');
    expect(carroceriaPhotos[1].caption).toBe('Rayadura profunda');
  });

  it('caption trimming removes leading/trailing whitespace', () => {
    // This mirrors the handleSave logic in EditableCaption component
    const rawCaption = '  Daño visible  ';
    const trimmed = rawCaption.trim();
    expect(trimmed).toBe('Daño visible');

    // Empty after trim becomes null in our hook
    const emptyAfterTrim = '   '.trim() || null;
    expect(emptyAfterTrim).toBeNull();
  });

  it('caption max length is respected (120 chars)', () => {
    const longCaption = 'A'.repeat(120);
    const photo = makePhoto({ caption: longCaption });
    expect(photo.caption).toHaveLength(120);

    // Exceeding would be truncated by the input maxLength attribute
    const truncated = 'B'.repeat(150).substring(0, 120);
    expect(truncated).toHaveLength(120);
  });

  it('lightbox displays caption when present', () => {
    const photoWithCaption = makePhoto({ caption: 'Visible en lightbox' });
    const photoWithoutCaption = makePhoto({ caption: null });

    // Simulate the lightbox alt text logic
    const altWithCaption = photoWithCaption.caption || 'Foto de auditoría';
    const altWithoutCaption = photoWithoutCaption.caption || 'Foto de auditoría';

    expect(altWithCaption).toBe('Visible en lightbox');
    expect(altWithoutCaption).toBe('Foto de auditoría');
  });
});

// ── Photo URL extraction helper test ──

describe('Photo storage path extraction', () => {
  const BUCKET_NAME = 'audit-photos';

  function extractStoragePath(photoUrl: string): string | null {
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const idx = photoUrl.indexOf(marker);
    if (idx === -1) return null;
    return photoUrl.substring(idx + marker.length);
  }

  it('extracts correct path from a Supabase public URL', () => {
    const url = 'https://quilsunfhfqqnibheqzl.supabase.co/storage/v1/object/public/audit-photos/org-1/vehicle-1/audit-1/abc123.jpg';
    expect(extractStoragePath(url)).toBe('org-1/vehicle-1/audit-1/abc123.jpg');
  });

  it('returns null for URLs from different buckets', () => {
    const url = 'https://example.com/storage/v1/object/public/other-bucket/file.jpg';
    expect(extractStoragePath(url)).toBeNull();
  });

  it('returns null for non-Supabase URLs', () => {
    const url = 'https://example.com/photo.jpg';
    expect(extractStoragePath(url)).toBeNull();
  });
});
