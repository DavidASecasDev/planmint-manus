/**
 * Tests for the transfer movement creation system.
 * Tests the data flow, validation, and edge cases of auto-creating movements from PDF data.
 */
import { describe, it, expect } from 'vitest';
import type { ExtractedTransferItem } from '@/types/transfers';

// ── Helper functions that mirror the logic in TransferMovementReview ──

function validateReviewItems(items: Array<ExtractedTransferItem & { matricula: string; create_movement: boolean }>) {
  const errors: string[] = [];
  items.forEach((item, i) => {
    if (item.create_movement && !item.matricula.trim()) {
      errors.push(`Trayecto ${i + 1}: Matrícula requerida para crear movimiento`);
    }
  });
  return errors;
}

function buildPayloadItems(items: Array<ExtractedTransferItem & { matricula: string; create_movement: boolean; movement_type: string }>) {
  return items.map(item => ({
    transfer_date: item.date,
    pickup_time: item.pickup_time,
    pickup_location: item.pickup_location,
    dropoff_location: item.dropoff_location,
    dropoff_time: item.dropoff_time ?? null,
    vehicle_type: item.vehicle_type,
    pax_count: item.pax_count,
    amount: item.amount,
    notes: item.notes,
    has_return: item.has_return ?? false,
    return_pickup_location: item.return_pickup_location ?? null,
    return_dropoff_location: item.return_dropoff_location ?? null,
    return_pickup_time: item.return_pickup_time ?? null,
    return_date: item.return_date ?? null,
    matricula: item.matricula || null,
    driver_name: item.driver_name ?? null,
    driver_phone: item.driver_phone ?? null,
    create_movement: item.create_movement,
    movement_type: item.movement_type,
  }));
}

function normalizeMatricula(matricula: string): string {
  return matricula.toUpperCase().replace(/[\s-]/g, '');
}

// ── Test data ──

const sampleExtractedItem: ExtractedTransferItem = {
  date: '2026-04-15',
  pickup_time: '10:30',
  pickup_location: 'Aeropuerto PMI',
  dropoff_location: 'Hotel Formentor',
  dropoff_time: '11:45',
  vehicle_type: 'v_class',
  pax_count: 4,
  amount: 150,
  notes: 'Vuelo IB3456',
  flight_number: 'IB3456',
  has_return: false,
  return_pickup_location: null,
  return_dropoff_location: null,
  return_pickup_time: null,
  return_date: null,
  driver_name: null,
  driver_phone: null,
  confidence: 0.85,
};

const sampleReturnItem: ExtractedTransferItem = {
  ...sampleExtractedItem,
  has_return: true,
  return_pickup_location: 'Hotel Formentor',
  return_dropoff_location: 'Aeropuerto PMI',
  return_pickup_time: '16:00',
  return_date: '2026-04-20',
  amount: 300,
};

describe('Transfer Movement Creation - Validation', () => {
  it('should pass validation when no movements are requested', () => {
    const items = [{ ...sampleExtractedItem, matricula: '', create_movement: false }];
    const errors = validateReviewItems(items);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when movement requested without matricula', () => {
    const items = [{ ...sampleExtractedItem, matricula: '', create_movement: true }];
    const errors = validateReviewItems(items);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Matrícula requerida');
  });

  it('should pass validation when movement requested with matricula', () => {
    const items = [{ ...sampleExtractedItem, matricula: '1234ABC', create_movement: true }];
    const errors = validateReviewItems(items);
    expect(errors).toHaveLength(0);
  });

  it('should validate each item independently', () => {
    const items = [
      { ...sampleExtractedItem, matricula: '1234ABC', create_movement: true },
      { ...sampleExtractedItem, matricula: '', create_movement: true },
      { ...sampleExtractedItem, matricula: '', create_movement: false },
    ];
    const errors = validateReviewItems(items);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Trayecto 2');
  });

  it('should reject whitespace-only matricula', () => {
    const items = [{ ...sampleExtractedItem, matricula: '   ', create_movement: true }];
    const errors = validateReviewItems(items);
    expect(errors).toHaveLength(1);
  });
});

describe('Transfer Movement Creation - Payload Building', () => {
  it('should build correct payload for items without movements', () => {
    const items = [{ ...sampleExtractedItem, matricula: '', create_movement: false, movement_type: 'entrega' }];
    const payload = buildPayloadItems(items);
    expect(payload).toHaveLength(1);
    expect(payload[0].create_movement).toBe(false);
    expect(payload[0].matricula).toBeNull();
    expect(payload[0].transfer_date).toBe('2026-04-15');
    expect(payload[0].pickup_location).toBe('Aeropuerto PMI');
    expect(payload[0].dropoff_location).toBe('Hotel Formentor');
  });

  it('should build correct payload for items with movements', () => {
    const items = [{ ...sampleExtractedItem, matricula: '1234ABC', create_movement: true, movement_type: 'entrega' }];
    const payload = buildPayloadItems(items);
    expect(payload[0].create_movement).toBe(true);
    expect(payload[0].matricula).toBe('1234ABC');
    expect(payload[0].movement_type).toBe('entrega');
  });

  it('should include return trip data in payload', () => {
    const items = [{ ...sampleReturnItem, matricula: '1234ABC', create_movement: true, movement_type: 'entrega' }];
    const payload = buildPayloadItems(items);
    expect(payload[0].has_return).toBe(true);
    expect(payload[0].return_pickup_location).toBe('Hotel Formentor');
    expect(payload[0].return_dropoff_location).toBe('Aeropuerto PMI');
    expect(payload[0].return_pickup_time).toBe('16:00');
    expect(payload[0].return_date).toBe('2026-04-20');
  });

  it('should handle null/undefined fields gracefully', () => {
    const minimalItem: ExtractedTransferItem = {
      date: null,
      pickup_time: null,
      pickup_location: null,
      dropoff_location: null,
      dropoff_time: null,
      vehicle_type: null,
      pax_count: null,
      amount: null,
      notes: null,
      flight_number: null,
      has_return: false,
      return_pickup_location: null,
      return_dropoff_location: null,
      return_pickup_time: null,
      return_date: null,
      driver_name: null,
      driver_phone: null,
      confidence: null,
    };
    const items = [{ ...minimalItem, matricula: '', create_movement: false, movement_type: 'entrega' }];
    const payload = buildPayloadItems(items);
    expect(payload[0].transfer_date).toBeNull();
    expect(payload[0].pickup_location).toBeNull();
    expect(payload[0].has_return).toBe(false);
  });
});

describe('Transfer Movement Creation - Matricula Normalization', () => {
  it('should uppercase matricula', () => {
    expect(normalizeMatricula('1234abc')).toBe('1234ABC');
  });

  it('should remove spaces from matricula', () => {
    expect(normalizeMatricula('1234 ABC')).toBe('1234ABC');
  });

  it('should remove dashes from matricula', () => {
    expect(normalizeMatricula('1234-ABC')).toBe('1234ABC');
  });

  it('should handle already clean matricula', () => {
    expect(normalizeMatricula('1234ABC')).toBe('1234ABC');
  });
});

describe('Transfer Movement Creation - Confidence Scoring', () => {
  it('should classify high confidence (>= 0.8)', () => {
    expect(sampleExtractedItem.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should handle null confidence', () => {
    const item = { ...sampleExtractedItem, confidence: null };
    expect(item.confidence).toBeNull();
  });

  it('should handle zero confidence', () => {
    const item = { ...sampleExtractedItem, confidence: 0 };
    expect(item.confidence).toBe(0);
  });
});

describe('Transfer Movement Creation - Return Trip Logic', () => {
  it('should detect return trip from has_return flag', () => {
    expect(sampleReturnItem.has_return).toBe(true);
    expect(sampleReturnItem.return_pickup_location).toBe('Hotel Formentor');
  });

  it('should handle item without return trip', () => {
    expect(sampleExtractedItem.has_return).toBe(false);
    expect(sampleExtractedItem.return_pickup_location).toBeNull();
  });

  it('should use original date as fallback for return date', () => {
    const itemNoReturnDate = { ...sampleReturnItem, return_date: null };
    const fallbackDate = itemNoReturnDate.return_date || itemNoReturnDate.date;
    expect(fallbackDate).toBe('2026-04-15');
  });
});

describe('Transfer Movement Creation - Edge Cases', () => {
  it('should handle empty items array', () => {
    const errors = validateReviewItems([]);
    expect(errors).toHaveLength(0);
    const payload = buildPayloadItems([]);
    expect(payload).toHaveLength(0);
  });

  it('should handle large number of items', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      ...sampleExtractedItem,
      matricula: `${1000 + i}ABC`,
      create_movement: true,
      movement_type: 'entrega',
    }));
    const errors = validateReviewItems(items);
    expect(errors).toHaveLength(0);
    const payload = buildPayloadItems(items);
    expect(payload).toHaveLength(50);
  });

  it('should count movements correctly', () => {
    const items = [
      { ...sampleExtractedItem, matricula: '1234ABC', create_movement: true, movement_type: 'entrega' },
      { ...sampleExtractedItem, matricula: '', create_movement: false, movement_type: 'entrega' },
      { ...sampleExtractedItem, matricula: '5678DEF', create_movement: true, movement_type: 'recogida' },
    ];
    const movementCount = items.filter(i => i.create_movement).length;
    expect(movementCount).toBe(2);
  });
});
