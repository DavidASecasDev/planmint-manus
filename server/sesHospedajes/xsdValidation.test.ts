import { describe, expect, it } from 'vitest';
import { sha256Utf8, validateSesXmlAgainstXsd } from './xsdValidation';

const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="contrato">
    <xs:complexType><xs:sequence>
      <xs:element name="referencia" type="xs:string"/>
    </xs:sequence></xs:complexType>
  </xs:element>
</xs:schema>`;

describe('SES XSD validation', () => {
  it('accepts XML that conforms to the supplied XSD', async () => {
    const result = await validateSesXmlAgainstXsd('<contrato><referencia>TEST-1</referencia></contrato>', xsd);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('returns structured errors for invalid XML', async () => {
    const result = await validateSesXmlAgainstXsd('<contrato><otro>TEST-1</otro></contrato>', xsd);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ message: expect.any(String) });
  });

  it('hashes the exact UTF-8 content deterministically', () => {
    expect(sha256Utf8('á')).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Utf8('á')).toBe(sha256Utf8('á'));
  });
});

