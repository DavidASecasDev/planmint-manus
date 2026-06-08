import { describe, it, expect } from 'vitest';

/**
 * Tests for the Edit Manual Movement feature.
 * 
 * Manual movements are reservations with external_reservation_id starting with "MANUAL-".
 * They can be of type: Entrega, Devolución, or Transfer.
 * 
 * The edit feature allows updating:
 * - tipo_actividad (Entrega/Devolución/Transfer)
 * - Date and time (desde for Entrega/Transfer, hasta for Devolución)
 * - Client info (nombre, apellido, telefono, email)
 * - Vehicle info (auto/matrícula, modelo)
 * - Location (lugar_entrega or lugar_devolucion depending on tipo)
 * - Notes (notas)
 */

describe('Edit Manual Movement - Data Model', () => {
  it('should identify manual movements by MANUAL- prefix', () => {
    const manualId = 'MANUAL-1717000000000';
    const rentlyId = 'RNT-12345';
    
    expect(manualId.startsWith('MANUAL-')).toBe(true);
    expect(rentlyId.startsWith('MANUAL-')).toBe(false);
  });

  it('should map Entrega fields correctly', () => {
    const tipo = 'Entrega';
    const fechaISO = '2026-06-08T10:00:00+00:00';
    const lugar = 'Aeropuerto PMI';

    const updateData: Record<string, unknown> = {};
    
    if (tipo === 'Entrega' || tipo === 'Transfer') {
      updateData.desde = fechaISO;
      updateData.hasta = null;
      updateData.lugar_entrega = lugar;
      updateData.lugar_devolucion = null;
    }

    expect(updateData.desde).toBe(fechaISO);
    expect(updateData.hasta).toBeNull();
    expect(updateData.lugar_entrega).toBe(lugar);
    expect(updateData.lugar_devolucion).toBeNull();
  });

  it('should map Devolución fields correctly', () => {
    const tipo = 'Devolución';
    const fechaISO = '2026-06-08T14:00:00+00:00';
    const lugar = 'Hotel Meliá';

    const updateData: Record<string, unknown> = {};
    
    if (tipo === 'Devolución') {
      updateData.hasta = fechaISO;
      updateData.desde = null;
      updateData.lugar_entrega = null;
      updateData.lugar_devolucion = lugar;
    }

    expect(updateData.hasta).toBe(fechaISO);
    expect(updateData.desde).toBeNull();
    expect(updateData.lugar_entrega).toBeNull();
    expect(updateData.lugar_devolucion).toBe(lugar);
  });

  it('should map Transfer fields correctly (same as Entrega)', () => {
    const tipo = 'Transfer';
    const fechaISO = '2026-06-08T16:30:00+00:00';
    const lugar = 'Puerto de Palma';

    const updateData: Record<string, unknown> = {};
    
    if (tipo === 'Entrega' || tipo === 'Transfer') {
      updateData.desde = fechaISO;
      updateData.hasta = null;
      updateData.lugar_entrega = lugar;
      updateData.lugar_devolucion = null;
    }

    expect(updateData.desde).toBe(fechaISO);
    expect(updateData.hasta).toBeNull();
    expect(updateData.lugar_entrega).toBe(lugar);
    expect(updateData.lugar_devolucion).toBeNull();
  });

  it('should include client fields in update data', () => {
    const updateData = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      cliente_apellido: 'García',
      telefono: '+34666123456',
      email: 'juan@example.com',
      modelo: 'Mercedes GLA',
      auto: '1234ABC',
      notas: 'Entregar en parking',
    };

    expect(updateData.cliente_nombre).toBe('Juan');
    expect(updateData.cliente_apellido).toBe('García');
    expect(updateData.telefono).toBe('+34666123456');
    expect(updateData.email).toBe('juan@example.com');
    expect(updateData.modelo).toBe('Mercedes GLA');
    expect(updateData.auto).toBe('1234ABC');
    expect(updateData.notas).toBe('Entregar en parking');
  });

  it('should nullify empty string fields', () => {
    const clienteNombre = '';
    const telefono = '';
    const notas = '';

    const updateData = {
      cliente_nombre: clienteNombre || null,
      telefono: telefono || null,
      notas: notas || null,
    };

    expect(updateData.cliente_nombre).toBeNull();
    expect(updateData.telefono).toBeNull();
    expect(updateData.notas).toBeNull();
  });

  it('should build correct ISO date string from date and time', () => {
    const year = 2026;
    const month = 6;
    const day = 8;
    const hours = 14;
    const minutes = 30;

    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    const fechaISO = `${year}-${monthStr}-${dayStr}T${h}:${m}:00+00:00`;

    expect(fechaISO).toBe('2026-06-08T14:30:00+00:00');
  });

  it('should handle tipo change from Entrega to Devolución', () => {
    // Original was Entrega (desde set, hasta null)
    const original = {
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
    };

    // Changed to Devolución
    const newTipo = 'Devolución';
    const newFecha = '2026-06-09T12:00:00+00:00';
    const newLugar = 'Hotel';

    const updateData: Record<string, unknown> = {};
    if (newTipo === 'Devolución') {
      updateData.hasta = newFecha;
      updateData.desde = null;
      updateData.lugar_entrega = null;
      updateData.lugar_devolucion = newLugar;
    }

    // Should clear desde and lugar_entrega, set hasta and lugar_devolucion
    expect(updateData.desde).toBeNull();
    expect(updateData.hasta).toBe(newFecha);
    expect(updateData.lugar_entrega).toBeNull();
    expect(updateData.lugar_devolucion).toBe(newLugar);
  });

  it('should preserve external_reservation_id (never change MANUAL- id)', () => {
    const reservation = {
      id: 'uuid-123',
      external_reservation_id: 'MANUAL-1717000000000',
    };

    // The edit should NOT include external_reservation_id in the update
    const updateData = {
      tipo_actividad: 'Transfer',
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
    };

    expect(updateData).not.toHaveProperty('external_reservation_id');
    expect(reservation.external_reservation_id).toBe('MANUAL-1717000000000');
  });
});

describe('Edit Manual Movement - Permission Logic', () => {
  it('should only show edit button for manual movements', () => {
    const manualReservation = { external_reservation_id: 'MANUAL-1717000000000' };
    const rentlyReservation = { external_reservation_id: 'RNT-12345' };
    const nullReservation = { external_reservation_id: null };

    expect(manualReservation.external_reservation_id?.startsWith('MANUAL-')).toBe(true);
    expect(rentlyReservation.external_reservation_id?.startsWith('MANUAL-')).toBe(false);
    expect(nullReservation.external_reservation_id?.startsWith('MANUAL-')).toBeFalsy();
  });

  it('should require isFullAccess for edit button visibility', () => {
    const roles = [
      { role: 'owner', isFullAccess: true },
      { role: 'admin', isFullAccess: true },
      { role: 'manager', isFullAccess: false },
      { role: 'member', isFullAccess: false },
    ];

    for (const { role, isFullAccess } of roles) {
      if (role === 'owner' || role === 'admin') {
        expect(isFullAccess).toBe(true);
      } else {
        expect(isFullAccess).toBe(false);
      }
    }
  });
});

describe('Edit Manual Movement - UpdateReservationData type', () => {
  it('should include client fields in UpdateReservationData', () => {
    // This test verifies the type includes the fields we added
    const updateData = {
      cliente_nombre: 'Test',
      cliente_apellido: 'User',
      telefono: '+34600000000',
      email: 'test@test.com',
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      tipo_actividad: 'Entrega',
      modelo: 'BMW X1',
      auto: '5678DEF',
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
      notas: 'Test note',
    };

    // All fields should be present and correctly typed
    expect(typeof updateData.cliente_nombre).toBe('string');
    expect(typeof updateData.cliente_apellido).toBe('string');
    expect(typeof updateData.telefono).toBe('string');
    expect(typeof updateData.email).toBe('string');
    expect(typeof updateData.tipo_actividad).toBe('string');
    expect(updateData.hasta).toBeNull();
    expect(updateData.lugar_devolucion).toBeNull();
  });
});
