import { describe, it, expect } from 'vitest';
import type { RentlyExtra } from '@/types/reservations';

// Replicate the baby seat detection logic from ReservationsTable
const BABY_SEAT_KEYWORDS = ['silla', 'sillita', 'baby', 'child', 'booster', 'infant', 'bebé', 'bebe', 'infante', 'elevador'];

function getBabySeats(extrasRaw: unknown): RentlyExtra[] {
  let extras: RentlyExtra[] = [];
  try {
    if (!extrasRaw) return [];
    extras = typeof extrasRaw === 'string' ? JSON.parse(extrasRaw) : (Array.isArray(extrasRaw) ? extrasRaw : []);
  } catch { return []; }
  return extras.filter(e => {
    const name = (e.nombre || e.name || '').toLowerCase();
    return BABY_SEAT_KEYWORDS.some(kw => name.includes(kw));
  });
}

describe('Baby seat detection', () => {
  it('detects "Silla de Bebé" from JSON string', () => {
    const raw = JSON.stringify([
      { nombre: 'Cobertura BASIC', precio: 0, cantidad: 1 },
      { nombre: 'Silla de Bebé', precio: 5, cantidad: 1 },
    ]);
    const seats = getBabySeats(raw);
    expect(seats).toHaveLength(1);
    expect(seats[0].nombre).toBe('Silla de Bebé');
  });

  it('detects "Silla de infantes"', () => {
    const raw = JSON.stringify([
      { nombre: 'Silla de infantes', precio: 5, cantidad: 2 },
    ]);
    const seats = getBabySeats(raw);
    expect(seats).toHaveLength(1);
    expect(seats[0].cantidad).toBe(2);
  });

  it('detects "Asiento elevador"', () => {
    const raw = JSON.stringify([
      { nombre: 'Asiento elevador', precio: 3, cantidad: 1 },
      { nombre: 'Conductor Adicional', precio: 10, cantidad: 1 },
    ]);
    const seats = getBabySeats(raw);
    expect(seats).toHaveLength(1);
    expect(seats[0].nombre).toBe('Asiento elevador');
  });

  it('detects multiple seat types in one reservation', () => {
    const raw = JSON.stringify([
      { nombre: 'Silla de Bebé', precio: 5, cantidad: 1 },
      { nombre: 'Asiento elevador', precio: 3, cantidad: 1 },
      { nombre: 'BLUE COVER G2', precio: 15, cantidad: 1 },
    ]);
    const seats = getBabySeats(raw);
    expect(seats).toHaveLength(2);
  });

  it('returns empty for reservations without seat extras', () => {
    const raw = JSON.stringify([
      { nombre: 'Cobertura BASIC', precio: 0, cantidad: 1 },
      { nombre: 'Conductor Adicional', precio: 10, cantidad: 1 },
      { nombre: 'BLUE ROAD ASSISTANCE', precio: 0, cantidad: 1 },
    ]);
    const seats = getBabySeats(raw);
    expect(seats).toHaveLength(0);
  });

  it('returns empty for null extras', () => {
    expect(getBabySeats(null)).toHaveLength(0);
  });

  it('returns empty for undefined extras', () => {
    expect(getBabySeats(undefined)).toHaveLength(0);
  });

  it('returns empty for invalid JSON string', () => {
    expect(getBabySeats('not-json')).toHaveLength(0);
  });

  it('handles already-parsed array (not string)', () => {
    const parsed = [
      { nombre: 'Silla de Bebé', precio: 5, cantidad: 1 },
    ];
    const seats = getBabySeats(parsed);
    expect(seats).toHaveLength(1);
  });

  it('handles legacy English field names', () => {
    const raw = JSON.stringify([
      { name: 'Baby Seat', price: 5, quantity: 1 },
    ]);
    const seats = getBabySeats(raw);
    expect(seats).toHaveLength(1);
  });

  it('handles old format with only cantidad (no nombre)', () => {
    const raw = JSON.stringify([{ cantidad: 1 }]);
    const seats = getBabySeats(raw);
    expect(seats).toHaveLength(0);
  });

  it('calculates total seats correctly', () => {
    const raw = JSON.stringify([
      { nombre: 'Silla de Bebé', precio: 5, cantidad: 2 },
      { nombre: 'Asiento elevador', precio: 3, cantidad: 1 },
    ]);
    const seats = getBabySeats(raw);
    const total = seats.reduce((sum, s) => sum + (s.cantidad ?? s.quantity ?? 1), 0);
    expect(total).toBe(3);
  });
});
