import { normalizeDocumentNumber, type RentlyCustomerForSes } from './rentlyProfiles';

export type StoredRentlyDriver = { nombre?: string; documento?: string; carnet?: string };

export function parseStoredRentlyDrivers(value: unknown): StoredRentlyDriver[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

export function mapStoredRentlyDriverToCustomer(driver: StoredRentlyDriver): RentlyCustomerForSes | null {
  const document = normalizeDocumentNumber(driver.documento);
  const nameParts = (driver.nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!document || nameParts.length < 2) return null;
  return {
    Firstname: nameParts[0],
    Lastname: nameParts.slice(1).join(' '),
    DocumentId: document,
    DriverLicenceNumber: normalizeDocumentNumber(driver.carnet) ?? undefined,
  };
}
