import { describe, it, expect } from 'vitest';
import { generateTransfersCsv } from './exportTransfersCsv';
import type { TransferRequest } from '@/types/transfers';

function makeRequest(overrides: Partial<TransferRequest> = {}): TransferRequest {
  return {
    id: 'req-1',
    request_number: 'TR-001',
    organization_id: 'org-1',
    broker_id: 'broker-1',
    broker_name: 'Yacht Broker',
    client_name: 'John Doe',
    status: 'confirmado',
    pricing_mode: 'zone_tariff',
    items_count: 2,
    first_transfer_date: '2025-06-15',
    total_amount: 500,
    client_total: 500,
    provider_cost: 300,
    internal_margin: 200,
    created_at: '2025-06-01T10:00:00Z',
    ...overrides,
  } as TransferRequest;
}

describe('generateTransfersCsv', () => {
  it('should generate CSV with BOM and semicolon delimiter', () => {
    const csv = generateTransfersCsv([makeRequest()]);
    // BOM character
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    // Semicolon delimiter
    expect(csv).toContain(';');
  });

  it('should include header row', () => {
    const csv = generateTransfersCsv([makeRequest()]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Número');
    expect(lines[0]).toContain('Broker');
    expect(lines[0]).toContain('Cliente');
    expect(lines[0]).toContain('Estado');
    expect(lines[0]).toContain('Modo de precio');
    expect(lines[0]).toContain('Total cliente');
    expect(lines[0]).toContain('Coste proveedor');
    expect(lines[0]).toContain('Margen');
  });

  it('should include request data row', () => {
    const csv = generateTransfersCsv([makeRequest()]);
    const lines = csv.split('\n');
    const dataLine = lines[1]; // BOM is on line 0 header
    expect(dataLine).toContain('TR-001');
    expect(dataLine).toContain('Yacht Broker');
    expect(dataLine).toContain('John Doe');
    expect(dataLine).toContain('Confirmado');
    expect(dataLine).toContain('Tarifa por zona');
  });

  it('should include totals row at the end', () => {
    const requests = [
      makeRequest({ total_amount: 500, provider_cost: 300 }),
      makeRequest({ id: 'req-2', total_amount: 800, provider_cost: 400 }),
    ];
    const csv = generateTransfersCsv(requests);
    const lines = csv.split('\n').filter(l => l.trim());
    const totalsLine = lines[lines.length - 1];
    expect(totalsLine).toContain('TOTALES');
    // Total client: 500 + 800 = 1300 → "1300,00"
    expect(totalsLine).toContain('1300,00');
    // Total provider: 300 + 400 = 700 → "700,00"
    expect(totalsLine).toContain('700,00');
    // Total margin: 1300 - 700 = 600 → "600,00"
    expect(totalsLine).toContain('600,00');
  });

  it('should format numbers with comma as decimal separator', () => {
    const csv = generateTransfersCsv([makeRequest({ total_amount: 1234.56 })]);
    expect(csv).toContain('1234,56');
  });

  it('should handle empty requests array', () => {
    const csv = generateTransfersCsv([]);
    const lines = csv.split('\n').filter(l => l.trim());
    // Header + empty totals row
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('TOTALES');
  });

  it('should show provider_quote mode label', () => {
    const csv = generateTransfersCsv([makeRequest({ pricing_mode: 'provider_quote' })]);
    expect(csv).toContain('Presupuesto proveedor');
  });

  it('should escape fields containing semicolons', () => {
    const csv = generateTransfersCsv([makeRequest({ client_name: 'Smith; Jones' })]);
    expect(csv).toContain('"Smith; Jones"');
  });

  it('should handle null/undefined values gracefully', () => {
    const csv = generateTransfersCsv([makeRequest({
      total_amount: undefined as any,
      provider_cost: null as any,
      first_transfer_date: null as any,
    })]);
    // Should not throw
    expect(csv).toContain('TR-001');
  });
});
