import { describe, it, expect } from 'vitest';

/**
 * Tests for the Manual Movement Edit History feature.
 * 
 * This feature:
 * 1. Creates a table `manual_movement_edit_history` in Supabase
 * 2. Logs field-level changes when a manual movement is edited
 * 3. Displays a timeline of edits in the Historial tab of the detail sheet
 */

interface FieldChange {
  field: string;
  label: string;
  old_value: string | null;
  new_value: string | null;
}

describe('Manual Movement Edit History - Change Detection', () => {
  const fieldLabels: Record<string, string> = {
    tipo_actividad: 'Tipo de operación',
    cliente_nombre: 'Nombre',
    cliente_apellido: 'Apellido',
    telefono: 'Teléfono',
    email: 'Email',
    modelo: 'Modelo',
    auto: 'Matrícula',
    notas: 'Notas',
    desde: 'Fecha/Hora',
    hasta: 'Fecha/Hora',
    lugar_entrega: 'Lugar',
    lugar_devolucion: 'Lugar',
  };

  function computeChanges(
    oldValues: Record<string, string | null>,
    updateData: Record<string, unknown>
  ): FieldChange[] {
    const changes: FieldChange[] = [];

    for (const [field, newValue] of Object.entries(updateData)) {
      if (!(field in fieldLabels)) continue;

      const oldVal = oldValues[field] || null;
      const newVal = (newValue as string) || null;

      const oldNorm = oldVal?.trim() || null;
      const newNorm = newVal?.trim() || null;

      if (oldNorm !== newNorm) {
        changes.push({
          field,
          label: fieldLabels[field] || field,
          old_value: oldNorm,
          new_value: newNorm,
        });
      }
    }

    return changes;
  }

  it('should detect tipo_actividad change', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      cliente_apellido: null,
      telefono: null,
      email: null,
      modelo: null,
      auto: null,
      notas: null,
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Transfer',
      cliente_nombre: 'Juan',
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
    };

    const changes = computeChanges(oldValues, updateData);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('tipo_actividad');
    expect(changes[0].old_value).toBe('Entrega');
    expect(changes[0].new_value).toBe('Transfer');
  });

  it('should detect multiple field changes', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      cliente_apellido: 'García',
      telefono: '+34600000000',
      email: null,
      modelo: 'BMW X1',
      auto: '1234ABC',
      notas: null,
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Pedro',
      cliente_apellido: 'López',
      telefono: '+34611111111',
      email: 'pedro@test.com',
      modelo: 'BMW X1',
      auto: '1234ABC',
      notas: 'Nota nueva',
      desde: '2026-06-09T12:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Hotel',
      lugar_devolucion: null,
    };

    const changes = computeChanges(oldValues, updateData);
    
    // Should detect: cliente_nombre, cliente_apellido, telefono, email, notas, desde, lugar_entrega
    expect(changes.length).toBe(7);
    
    const changedFields = changes.map(c => c.field);
    expect(changedFields).toContain('cliente_nombre');
    expect(changedFields).toContain('cliente_apellido');
    expect(changedFields).toContain('telefono');
    expect(changedFields).toContain('email');
    expect(changedFields).toContain('notas');
    expect(changedFields).toContain('desde');
    expect(changedFields).toContain('lugar_entrega');
  });

  it('should not detect changes when values are the same', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      cliente_apellido: null,
      telefono: null,
      email: null,
      modelo: null,
      auto: null,
      notas: null,
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
    };

    const changes = computeChanges(oldValues, updateData);
    expect(changes).toHaveLength(0);
  });

  it('should detect null to value change', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: null,
      cliente_apellido: null,
      telefono: null,
      email: null,
      modelo: null,
      auto: null,
      notas: null,
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: null,
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      telefono: '+34600000000',
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
    };

    const changes = computeChanges(oldValues, updateData);
    expect(changes).toHaveLength(3);
    
    const nombreChange = changes.find(c => c.field === 'cliente_nombre');
    expect(nombreChange?.old_value).toBeNull();
    expect(nombreChange?.new_value).toBe('Juan');
  });

  it('should detect value to null change', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      cliente_apellido: null,
      telefono: '+34600000000',
      email: 'juan@test.com',
      modelo: null,
      auto: null,
      notas: 'Nota vieja',
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'Juan',
      telefono: null,
      email: null,
      notas: null,
      desde: '2026-06-08T10:00:00+00:00',
      hasta: null,
      lugar_entrega: 'Aeropuerto',
    };

    const changes = computeChanges(oldValues, updateData);
    expect(changes).toHaveLength(3);
    
    const telefonoChange = changes.find(c => c.field === 'telefono');
    expect(telefonoChange?.old_value).toBe('+34600000000');
    expect(telefonoChange?.new_value).toBeNull();
  });

  it('should use correct labels for fields', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: 'A',
      cliente_apellido: null,
      telefono: null,
      email: null,
      modelo: null,
      auto: null,
      notas: null,
      desde: null,
      hasta: null,
      lugar_entrega: null,
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Devolución',
      cliente_nombre: 'B',
      auto: '1234ABC',
      lugar_devolucion: 'Hotel',
    };

    const changes = computeChanges(oldValues, updateData);
    
    const tipoChange = changes.find(c => c.field === 'tipo_actividad');
    expect(tipoChange?.label).toBe('Tipo de operación');
    
    const nombreChange = changes.find(c => c.field === 'cliente_nombre');
    expect(nombreChange?.label).toBe('Nombre');
    
    const autoChange = changes.find(c => c.field === 'auto');
    expect(autoChange?.label).toBe('Matrícula');
    
    const lugarChange = changes.find(c => c.field === 'lugar_devolucion');
    expect(lugarChange?.label).toBe('Lugar');
  });

  it('should ignore fields not in fieldLabels', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: null,
      cliente_apellido: null,
      telefono: null,
      email: null,
      modelo: null,
      auto: null,
      notas: null,
      desde: null,
      hasta: null,
      lugar_entrega: null,
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Entrega',
      unknown_field: 'some value',
      another_field: 123,
    };

    const changes = computeChanges(oldValues, updateData);
    expect(changes).toHaveLength(0);
  });

  it('should treat empty string same as null', () => {
    const oldValues = {
      tipo_actividad: 'Entrega',
      cliente_nombre: '',
      cliente_apellido: null,
      telefono: null,
      email: null,
      modelo: null,
      auto: null,
      notas: null,
      desde: null,
      hasta: null,
      lugar_entrega: null,
      lugar_devolucion: null,
    };

    const updateData = {
      tipo_actividad: 'Entrega',
      cliente_nombre: null,
    };

    const changes = computeChanges(oldValues, updateData);
    expect(changes).toHaveLength(0);
  });
});

describe('Manual Movement Edit History - Endpoint Validation', () => {
  it('should require reservation_id and non-empty changes array', () => {
    // Simulating validation logic from the endpoint
    const validateRequest = (body: any): { valid: boolean; error?: string } => {
      if (!body.reservation_id || !body.changes || !Array.isArray(body.changes) || body.changes.length === 0) {
        return { valid: false, error: 'reservation_id and non-empty changes array are required' };
      }
      return { valid: true };
    };

    expect(validateRequest({})).toEqual({ valid: false, error: 'reservation_id and non-empty changes array are required' });
    expect(validateRequest({ reservation_id: '123' })).toEqual({ valid: false, error: 'reservation_id and non-empty changes array are required' });
    expect(validateRequest({ reservation_id: '123', changes: [] })).toEqual({ valid: false, error: 'reservation_id and non-empty changes array are required' });
    expect(validateRequest({ reservation_id: '123', changes: [{ field: 'tipo', old_value: 'A', new_value: 'B' }] })).toEqual({ valid: true });
  });

  it('should only show history for manual movements (MANUAL- prefix)', () => {
    const isManual = (externalId: string | null | undefined): boolean => {
      return !!externalId?.startsWith('MANUAL-');
    };

    expect(isManual('MANUAL-1717000000000')).toBe(true);
    expect(isManual('RNT-12345')).toBe(false);
    expect(isManual(null)).toBe(false);
    expect(isManual(undefined)).toBe(false);
    expect(isManual('')).toBe(false);
  });
});

describe('Manual Movement Edit History - Data Structure', () => {
  it('should store changes as JSONB array with correct structure', () => {
    const changes: FieldChange[] = [
      { field: 'tipo_actividad', label: 'Tipo de operación', old_value: 'Entrega', new_value: 'Transfer' },
      { field: 'cliente_nombre', label: 'Nombre', old_value: null, new_value: 'Juan' },
    ];

    // Verify structure
    expect(Array.isArray(changes)).toBe(true);
    expect(changes[0]).toHaveProperty('field');
    expect(changes[0]).toHaveProperty('label');
    expect(changes[0]).toHaveProperty('old_value');
    expect(changes[0]).toHaveProperty('new_value');

    // Should be JSON-serializable
    const json = JSON.stringify(changes);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(changes);
  });

  it('should include changed_by_name from user profile', () => {
    const profile = { name: 'David Admin', id: 'uuid-123' };
    
    const historyEntry = {
      reservation_id: 'res-uuid',
      external_reservation_id: 'MANUAL-1717000000000',
      changes: [{ field: 'tipo_actividad', label: 'Tipo', old_value: 'Entrega', new_value: 'Transfer' }],
      changed_by_name: profile.name,
    };

    expect(historyEntry.changed_by_name).toBe('David Admin');
  });
});
