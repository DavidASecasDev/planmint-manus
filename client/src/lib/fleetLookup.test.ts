import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIlike = vi.fn();
const mockIs = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// Helper to create a chainable query mock
function createChainMock(resolvedData: any, resolvedError: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError }),
  };
  return chain;
}

describe('lookupVehicleByPlate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find a vehicle in fleet_vehicles', async () => {
    const fleetChain = createChainMock([{ id: 'fleet-123' }]);
    const vehiclesChain = createChainMock([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'fleet_vehicles') return fleetChain;
      if (table === 'vehicles') return vehiclesChain;
      return createChainMock([]);
    });

    const { lookupVehicleByPlate } = await import('./fleetLookup');
    const result = await lookupVehicleByPlate('3906MWM', 'org-1');

    expect(result.found).toBe(true);
    expect(result.fleetVehicleId).toBe('fleet-123');
    expect(result.operationalVehicleId).toBeNull();
    expect(result.matricula).toBe('3906MWM');

    // Verify fleet_vehicles was queried first
    expect(mockFrom).toHaveBeenCalledWith('fleet_vehicles');
    expect(fleetChain.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    expect(fleetChain.ilike).toHaveBeenCalledWith('matricula', '3906MWM');
  });

  it('should find a vehicle in both tables', async () => {
    const fleetChain = createChainMock([{ id: 'fleet-123' }]);
    const vehiclesChain = createChainMock([{ id: 'op-456' }]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'fleet_vehicles') return fleetChain;
      if (table === 'vehicles') return vehiclesChain;
      return createChainMock([]);
    });

    const { lookupVehicleByPlate } = await import('./fleetLookup');
    const result = await lookupVehicleByPlate('3906MWM', 'org-1');

    expect(result.found).toBe(true);
    expect(result.fleetVehicleId).toBe('fleet-123');
    expect(result.operationalVehicleId).toBe('op-456');
  });

  it('should find a vehicle only in operational vehicles table', async () => {
    const fleetChain = createChainMock([]);
    const vehiclesChain = createChainMock([{ id: 'op-456' }]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'fleet_vehicles') return fleetChain;
      if (table === 'vehicles') return vehiclesChain;
      return createChainMock([]);
    });

    const { lookupVehicleByPlate } = await import('./fleetLookup');
    const result = await lookupVehicleByPlate('1234ABC', 'org-1');

    expect(result.found).toBe(true);
    expect(result.fleetVehicleId).toBeNull();
    expect(result.operationalVehicleId).toBe('op-456');
  });

  it('should return not found when plate is in neither table', async () => {
    const fleetChain = createChainMock([]);
    const vehiclesChain = createChainMock([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'fleet_vehicles') return fleetChain;
      if (table === 'vehicles') return vehiclesChain;
      return createChainMock([]);
    });

    const { lookupVehicleByPlate } = await import('./fleetLookup');
    const result = await lookupVehicleByPlate('XXXX999', 'org-1');

    expect(result.found).toBe(false);
    expect(result.fleetVehicleId).toBeNull();
    expect(result.operationalVehicleId).toBeNull();
  });

  it('should strip spaces from plate before searching', async () => {
    const fleetChain = createChainMock([{ id: 'fleet-123' }]);
    const vehiclesChain = createChainMock([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'fleet_vehicles') return fleetChain;
      if (table === 'vehicles') return vehiclesChain;
      return createChainMock([]);
    });

    const { lookupVehicleByPlate } = await import('./fleetLookup');
    const result = await lookupVehicleByPlate('3906 MWM', 'org-1');

    expect(result.matricula).toBe('3906MWM');
    expect(fleetChain.ilike).toHaveBeenCalledWith('matricula', '3906MWM');
  });

  it('should throw error when fleet_vehicles query fails', async () => {
    const fleetChain = createChainMock(null, { message: 'DB error' });
    const vehiclesChain = createChainMock([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'fleet_vehicles') return fleetChain;
      if (table === 'vehicles') return vehiclesChain;
      return createChainMock([]);
    });

    const { lookupVehicleByPlate } = await import('./fleetLookup');
    await expect(lookupVehicleByPlate('3906MWM', 'org-1')).rejects.toThrow(
      'Error al verificar la matrícula'
    );
  });
});
