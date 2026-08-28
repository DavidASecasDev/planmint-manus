import { describe, expect, it } from 'vitest';
import { buildSesFieldAuditRows } from './fieldAudit';

describe('SES field audit', () => {
  it('records one row per real field change with source, values and reason', () => {
    const rows = buildSesFieldAuditRows({
      organizationId: 'org-1', entityType: 'draft', entityId: 'draft-1', source: 'manual',
      actorUserId: 'user-1', previous: { payment_type: null, vehicle_plate: '1234BCD' },
      changes: { payment_type: 'TARJT', vehicle_plate: '1234BCD' }, reason: 'Corrección manual',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ field_name: 'payment_type', previous_value: null, new_value: 'TARJT', source: 'manual' });
  });
});

