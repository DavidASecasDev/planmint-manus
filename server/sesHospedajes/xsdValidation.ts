import { createHash } from 'node:crypto';
import { validateXML } from 'xmllint-wasm';

export function sha256Utf8(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function validateSesXmlAgainstXsd(xml: string, xsd: string) {
  const result = await validateXML({
    xml: { fileName: 'ses-alquiler.xml', contents: xml },
    schema: { fileName: 'ses-alquiler.xsd', contents: xsd },
    extension: 'schema',
    initialMemoryPages: 256,
    maxMemoryPages: 512,
  });
  return {
    valid: result.valid,
    errors: result.errors.map((error) => ({
      message: error.message,
      line: error.loc?.lineNumber ?? null,
    })),
  };
}

