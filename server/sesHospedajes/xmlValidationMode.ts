import { SES_OFFICIAL_CONTRACT_VERSION } from './officialStructuralContract';

export type SesStoredXsdSettings = {
  official_xsd_storage_key?: string | null;
  official_xsd_hash?: string | null;
  official_xsd_version?: string | null;
};

export function selectSesXmlValidationMode(settings: SesStoredXsdSettings | null | undefined) {
  const storageKey = settings?.official_xsd_storage_key?.trim() || null;
  const hash = settings?.official_xsd_hash?.trim() || null;
  const version = settings?.official_xsd_version?.trim() || null;
  const configuredParts = [storageKey, hash, version].filter(Boolean).length;
  if (configuredParts > 0 && configuredParts < 3) {
    throw new Error('La configuración XSD está incompleta; corrígela o retírala antes de generar XML');
  }
  if (configuredParts === 3) {
    return { mode: 'official_xsd' as const, storageKey: storageKey!, hash: hash!, version: version! };
  }
  return {
    mode: 'official_contract' as const,
    storageKey: null,
    hash: null,
    version: SES_OFFICIAL_CONTRACT_VERSION,
  };
}
