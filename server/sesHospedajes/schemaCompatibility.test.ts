import { describe, expect, it } from 'vitest';
import {
  createSesMigrationRequiredError,
  isSesSchemaCompatibilityError,
  parseLegacyOfficialLotCode,
  withLegacyBatchFields,
  withLegacyDraftGates,
} from './schemaCompatibility';

describe('SES schema compatibility', () => {
  it('recognizes missing table and column errors without treating business errors as schema failures', () => {
    expect(isSesSchemaCompatibilityError({ code: '42703', message: 'column x does not exist' })).toBe(true);
    expect(isSesSchemaCompatibilityError({ code: '42P01', message: 'relation x does not exist' })).toBe(true);
    expect(isSesSchemaCompatibilityError({ code: '23505', message: 'duplicate key' })).toBe(false);
  });

  it('returns an explicit non-mutating migration-required error', () => {
    const error = createSesMigrationRequiredError({ code: '42703' });
    expect(error.status).toBe(503);
    expect(error.message).toContain('No se ha modificado ningún dato');
  });

  it('preserves legacy counts but never makes an unmigrated ready draft exportable', () => {
    const restored = withLegacyDraftGates({
      id: 'draft-1', reference: '5000', status: 'ready', validation_errors: [],
    });
    expect(restored.is_complete).toBe(true);
    expect(restored.ready_for_xml).toBe(false);
    expect(restored.document_version).toBe('1.2.0');
  });

  it('keeps every historical reference non-exportable while the schema is legacy', () => {
    expect(withLegacyDraftGates({ reference: 'RANDOM-A', status: 'ready', ready_for_xml: true }).ready_for_xml).toBe(false);
    expect(withLegacyDraftGates({ reference: 'RANDOM-B', status: 'accepted', ready_for_xml: true }).ready_for_xml).toBe(false);
  });

  it('recovers structured official identifiers from legacy batch fields', () => {
    const lotCode = '3d0ccc9e-a184-11f1-80b7-005056957a69';
    expect(parseLegacyOfficialLotCode(`Código oficial de lote: ${lotCode}`)).toBe(lotCode);
    const restored = withLegacyBatchFields({
      schema_version: '1.2.0', notes: `Código oficial de lote: ${lotCode}`,
      items: [{ draft_version: 8, result_code: 'communication-code' }],
    });
    expect(restored.official_lot_code).toBe(lotCode);
    expect(restored.items[0].official_communication_code).toBe('communication-code');
  });
});
