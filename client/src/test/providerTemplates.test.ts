import { describe, it, expect } from 'vitest';

/**
 * Tests for Provider Parsing Templates and Auto-Created Movements History features.
 * These test the data validation, template matching, and hint building logic.
 */

// ── Provider Template Data Validation ──

describe('Provider Template Data Validation', () => {
  it('should validate required fields for template creation', () => {
    const validTemplate = {
      provider_name: 'TransferMallorca',
      parsing_hints: 'Este proveedor usa tablas con columnas: Servicio, Fecha, Hora, Precio',
      is_active: true,
    };

    expect(validTemplate.provider_name.trim()).not.toBe('');
    expect(validTemplate.parsing_hints.trim()).not.toBe('');
    expect(typeof validTemplate.is_active).toBe('boolean');
  });

  it('should reject empty provider_name', () => {
    const invalidTemplate = {
      provider_name: '',
      parsing_hints: 'Some hints',
    };

    const isValid = invalidTemplate.provider_name.trim().length > 0 && 
                    invalidTemplate.parsing_hints.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('should reject empty parsing_hints', () => {
    const invalidTemplate = {
      provider_name: 'ValidName',
      parsing_hints: '   ',
    };

    const isValid = invalidTemplate.provider_name.trim().length > 0 && 
                    invalidTemplate.parsing_hints.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('should parse comma-separated aliases correctly', () => {
    const aliasInput = 'TM, Transfer Mallorca SL, TransMallorca';
    const aliases = aliasInput.split(',').map(a => a.trim()).filter(Boolean);

    expect(aliases).toEqual(['TM', 'Transfer Mallorca SL', 'TransMallorca']);
  });

  it('should handle empty alias input', () => {
    const aliasInput = '';
    const aliases = aliasInput.split(',').map(a => a.trim()).filter(Boolean);

    expect(aliases).toEqual([]);
  });

  it('should handle aliases with extra commas and spaces', () => {
    const aliasInput = '  TM , , Transfer Mallorca,  , ';
    const aliases = aliasInput.split(',').map(a => a.trim()).filter(Boolean);

    expect(aliases).toEqual(['TM', 'Transfer Mallorca']);
  });
});

// ── Provider Template Matching Logic ──

describe('Provider Template Matching Logic', () => {
  const templates = [
    {
      id: '1',
      provider_name: 'TransferMallorca',
      provider_aliases: ['TM', 'Transfer Mallorca SL'],
      parsing_hints: 'Uses table format',
      is_active: true,
    },
    {
      id: '2',
      provider_name: 'Autocares Balear',
      provider_aliases: ['AB', 'Balear Transport'],
      parsing_hints: 'Uses list format',
      is_active: true,
    },
    {
      id: '3',
      provider_name: 'Inactive Provider',
      provider_aliases: [],
      parsing_hints: 'Should not match',
      is_active: false,
    },
  ];

  function findMatchingTemplate(providerName: string) {
    const searchName = providerName.toLowerCase().trim();
    const activeTemplates = templates.filter(t => t.is_active);

    for (const t of activeTemplates) {
      const tName = t.provider_name.toLowerCase().trim();
      const aliases = t.provider_aliases.map(a => a.toLowerCase().trim());

      if (tName === searchName || aliases.includes(searchName) ||
          searchName.includes(tName) || tName.includes(searchName) ||
          aliases.some(a => searchName.includes(a) || a.includes(searchName))) {
        return t;
      }
    }
    return null;
  }

  it('should match by exact provider name', () => {
    const match = findMatchingTemplate('TransferMallorca');
    expect(match?.id).toBe('1');
  });

  it('should match by alias', () => {
    const match = findMatchingTemplate('TM');
    expect(match?.id).toBe('1');
  });

  it('should match by partial name (provider name contains search)', () => {
    const match = findMatchingTemplate('Transfer');
    expect(match?.id).toBe('1');
  });

  it('should match case-insensitively', () => {
    const match = findMatchingTemplate('transfermallorca');
    expect(match?.id).toBe('1');
  });

  it('should match by alias case-insensitively', () => {
    const match = findMatchingTemplate('balear transport');
    expect(match?.id).toBe('2');
  });

  it('should not match inactive templates', () => {
    const match = findMatchingTemplate('Inactive Provider');
    expect(match).toBeNull();
  });

  it('should return null for unknown providers', () => {
    const match = findMatchingTemplate('Unknown Provider XYZ');
    expect(match).toBeNull();
  });
});

// ── Provider Hints Building ──

describe('Provider Hints Building', () => {
  function buildProviderHints(template: {
    provider_name: string;
    parsing_hints: string;
    field_mappings?: Record<string, string>;
    default_vehicle_type?: string | null;
  }): string {
    const parts: string[] = [];
    parts.push(`\n\n--- INSTRUCCIONES ESPECÍFICAS DEL PROVEEDOR: ${template.provider_name} ---`);
    parts.push(template.parsing_hints);

    const mappings = template.field_mappings || {};
    const entries = Object.entries(mappings).filter(([, v]) => v);
    if (entries.length > 0) {
      parts.push('\nMapeo de campos del proveedor:');
      for (const [field, label] of entries) {
        parts.push(`- "${label}" en el PDF → campo "${field}" en el JSON`);
      }
    }

    if (template.default_vehicle_type) {
      parts.push(`\nSi no se especifica tipo de vehículo, usar por defecto: "${template.default_vehicle_type}"`);
    }

    parts.push('\n--- FIN INSTRUCCIONES PROVEEDOR ---');
    return parts.join('\n');
  }

  it('should include provider name in hints', () => {
    const hints = buildProviderHints({
      provider_name: 'TestProvider',
      parsing_hints: 'Test instructions',
    });

    expect(hints).toContain('TestProvider');
    expect(hints).toContain('Test instructions');
  });

  it('should include field mappings when present', () => {
    const hints = buildProviderHints({
      provider_name: 'TestProvider',
      parsing_hints: 'Test',
      field_mappings: {
        pickup_location: 'Origen',
        dropoff_location: 'Destino',
      },
    });

    expect(hints).toContain('"Origen" en el PDF → campo "pickup_location" en el JSON');
    expect(hints).toContain('"Destino" en el PDF → campo "dropoff_location" en el JSON');
  });

  it('should include default vehicle type when present', () => {
    const hints = buildProviderHints({
      provider_name: 'TestProvider',
      parsing_hints: 'Test',
      default_vehicle_type: 'minivan',
    });

    expect(hints).toContain('usar por defecto: "minivan"');
  });

  it('should not include vehicle type section when null', () => {
    const hints = buildProviderHints({
      provider_name: 'TestProvider',
      parsing_hints: 'Test',
      default_vehicle_type: null,
    });

    expect(hints).not.toContain('usar por defecto');
  });

  it('should skip empty field mappings', () => {
    const hints = buildProviderHints({
      provider_name: 'TestProvider',
      parsing_hints: 'Test',
      field_mappings: {},
    });

    expect(hints).not.toContain('Mapeo de campos');
  });
});

// ── Auto-Created Movements Badge Logic ──

describe('Auto-Created Movements Badge Logic', () => {
  it('should identify movements created from PDF by source field', () => {
    const movements = [
      { id: '1', source: 'pdf_auto', transfer_request_id: 'tr1' },
      { id: '2', source: 'manual', transfer_request_id: 'tr1' },
      { id: '3', source: 'pdf_auto', transfer_request_id: 'tr1' },
    ];

    const autoCreated = movements.filter(m => m.source === 'pdf_auto');
    expect(autoCreated).toHaveLength(2);
  });

  it('should identify movements linked to a specific transfer', () => {
    const movements = [
      { id: '1', transfer_request_id: 'tr1', notes: 'Auto-generado desde presupuesto' },
      { id: '2', transfer_request_id: 'tr2', notes: 'Manual' },
      { id: '3', transfer_request_id: 'tr1', notes: 'Auto-generado desde presupuesto' },
    ];

    const linkedToTr1 = movements.filter(m => m.transfer_request_id === 'tr1');
    expect(linkedToTr1).toHaveLength(2);
  });

  it('should detect auto-generated movements by notes pattern', () => {
    const autoPattern = /auto-generado|auto-creado|desde presupuesto/i;
    
    expect(autoPattern.test('Auto-generado desde presupuesto PDF')).toBe(true);
    expect(autoPattern.test('Auto-creado por sistema')).toBe(true);
    expect(autoPattern.test('Movimiento desde presupuesto #123')).toBe(true);
    expect(autoPattern.test('Movimiento manual')).toBe(false);
  });

  it('should group movements by date for display', () => {
    const movements = [
      { id: '1', scheduled_date: '2025-06-15', pickup_location: 'Airport' },
      { id: '2', scheduled_date: '2025-06-15', pickup_location: 'Hotel' },
      { id: '3', scheduled_date: '2025-06-16', pickup_location: 'Airport' },
    ];

    const grouped = movements.reduce<Record<string, typeof movements>>((acc, m) => {
      const date = m.scheduled_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(m);
      return acc;
    }, {});

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['2025-06-15']).toHaveLength(2);
    expect(grouped['2025-06-16']).toHaveLength(1);
  });
});

// ── Movement Status Display ──

describe('Movement Status Display', () => {
  const statusLabels: Record<string, string> = {
    'scheduled': 'Programado',
    'in_progress': 'En curso',
    'completed': 'Completado',
    'cancelled': 'Cancelado',
  };

  const statusColors: Record<string, string> = {
    'scheduled': 'bg-blue-100 text-blue-700',
    'in_progress': 'bg-amber-100 text-amber-700',
    'completed': 'bg-green-100 text-green-700',
    'cancelled': 'bg-red-100 text-red-700',
  };

  it('should have labels for all statuses', () => {
    expect(statusLabels['scheduled']).toBe('Programado');
    expect(statusLabels['completed']).toBe('Completado');
    expect(statusLabels['cancelled']).toBe('Cancelado');
    expect(statusLabels['in_progress']).toBe('En curso');
  });

  it('should have colors for all statuses', () => {
    for (const status of Object.keys(statusLabels)) {
      expect(statusColors[status]).toBeDefined();
    }
  });
});
