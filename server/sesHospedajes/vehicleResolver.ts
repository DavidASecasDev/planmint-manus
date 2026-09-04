import { normalizeSesVehicleBrand, normalizeSesVehicleColor } from './codes';

type VehicleRecord = Record<string, any>;

function present(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
}

function firstPresent<T>(...values: T[]): T | null {
  return (values.find(present) as T | undefined) ?? null;
}

function normalizedComparable(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : JSON.stringify(value);
}

function consensus(rows: VehicleRecord[], field: string): unknown {
  const values = rows.map((row) => row[field]).filter(present);
  if (values.length === 0) return null;
  const unique = new Set(values.map(normalizedComparable));
  return unique.size === 1 ? values[0] : null;
}

export function normalizeSesVehiclePlateKey(value?: string | null): string {
  return String(value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function groupFleetVehiclesByPlate(rows: VehicleRecord[]): Map<string, VehicleRecord[]> {
  const grouped = new Map<string, VehicleRecord[]>();
  for (const row of rows) {
    const key = normalizeSesVehiclePlateKey(row.matricula);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

export function getFleetVehicleCandidates(
  grouped: Map<string, VehicleRecord[]>,
  plate?: string | null,
): VehicleRecord[] {
  const key = normalizeSesVehiclePlateKey(plate);
  return key ? grouped.get(key) ?? [] : [];
}

export function resolveSesVehicleData(input: {
  reservation: VehicleRecord;
  fleetVehicles?: VehicleRecord[];
  detail?: VehicleRecord | null;
}) {
  const reservation = input.reservation;
  const fleet = input.fleetVehicles ?? [];
  const detailCar = input.detail?.Car ?? {};
  const detailModel = detailCar.Model ?? {};

  const fleetPlate = consensus(fleet, 'matricula');
  const fleetBrand = consensus(fleet, 'marca');
  const fleetModel = consensus(fleet, 'modelo');
  const fleetCategory = consensus(fleet, 'categoria');
  const fleetVin = consensus(fleet, 'numero_bastidor');
  const fleetColor = consensus(fleet, 'color');
  const fleetPickupKm = consensus(fleet, 'km_recogida');
  const fleetReturnKm = consensus(fleet, 'km_devolucion');

  const brandSource = firstPresent(fleetBrand, detailModel.Brand?.Name);
  const colorSource = firstPresent(fleetColor, detailCar.Color, reservation.vehiculo_color);

  return {
    vehicle_category: firstPresent(fleetCategory, detailModel.Category?.Name, reservation.categoria),
    vehicle_brand: normalizeSesVehicleBrand(typeof brandSource === 'string' ? brandSource : null),
    vehicle_model: firstPresent(fleetModel, detailModel.Name, reservation.modelo),
    vehicle_plate: firstPresent(
      fleetPlate,
      typeof detailCar.Id === 'string' ? detailCar.Id : null,
      typeof detailCar.CurrentPlate === 'string' ? detailCar.CurrentPlate : detailCar.CurrentPlate?.Id,
      detailCar.CurrentPlateId,
      detailCar.Plate,
      reservation.auto,
    ),
    vehicle_vin: firstPresent(fleetVin, detailCar.ChassisIdentification, detailCar.ChassisId, reservation.vehiculo_chasis),
    vehicle_color: normalizeSesVehicleColor(typeof colorSource === 'string' ? colorSource : null),
    km_pickup: firstPresent(fleetPickupKm, input.detail?.DeliveryInfo?.Kms, reservation.vehiculo_kms),
    km_return: firstPresent(fleetReturnKm, input.detail?.DropoffInfo?.Kms),
    fleet_match_count: fleet.length,
  };
}

export function needsRentlyVehicleDetail(input: {
  existingDraft?: VehicleRecord | null;
  fleetVehicles?: VehicleRecord[];
}) {
  if (present(input.existingDraft?.vehicle_brand)) return false;
  return !present(consensus(input.fleetVehicles ?? [], 'marca'));
}
