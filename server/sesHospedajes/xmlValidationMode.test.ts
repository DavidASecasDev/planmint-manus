import { describe, expect, it } from 'vitest';
import { selectSesXmlValidationMode } from './xmlValidationMode';

describe('SES XML validator precedence', () => {
  it('uses the documented official structural contract when no authentic XSD exists', () => {
    expect(selectSesXmlValidationMode(null)).toMatchObject({ mode: 'official_contract', version: '1.2.0' });
  });

  it('gives strict precedence to a future fully configured authentic XSD', () => {
    expect(selectSesXmlValidationMode({
      official_xsd_storage_key: 'official/xsd/v-next.xsd',
      official_xsd_hash: 'abc123',
      official_xsd_version: 'future-official-version',
    })).toEqual({
      mode: 'official_xsd', storageKey: 'official/xsd/v-next.xsd', hash: 'abc123', version: 'future-official-version',
    });
  });

  it('rejects any partial XSD configuration instead of silently falling back', () => {
    expect(() => selectSesXmlValidationMode({ official_xsd_hash: 'partial' })).toThrow(/incompleta/i);
  });
});
