import { describe, expect, it } from 'vitest';
import { normalizeRentlyActionBody } from './rentlyActionContract';

describe('contratos oficiales de acciones Rently', () => {
  it('exige apellido para reservar y cancelar', () => {
    expect(() => normalizeRentlyActionBody('booking.confirm', { BookingId: 1 })).toThrow();
    expect(normalizeRentlyActionBody('booking.confirm', { BookingId: '1', Lastname: 'Pérez' }))
      .toEqual({ BookingId: 1, Lastname: 'Pérez' });
  });

  it('normaliza el pago heredado a BookingId, GatewayId y Amount', () => {
    expect(normalizeRentlyActionBody('booking.add_payment', {
      reservationId: '8', payload: { GatewayId: 3, Amount: 12.5 },
    })).toMatchObject({ BookingId: 8, GatewayId: 3, Amount: 12.5 });
  });

  it('convierte Notes a Extra al crear una reserva', () => {
    const result = normalizeRentlyActionBody('booking.create', {
      From: '2026-09-10', To: '2026-09-12', CategoryId: 2, Notes: 'Entrega hotel',
    });
    expect(result).toMatchObject({ Extra: 'Entrega hotel' });
    expect(result).not.toHaveProperty('Notes');
  });
});
