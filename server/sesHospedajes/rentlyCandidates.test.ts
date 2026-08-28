import { describe, expect, it, vi } from 'vitest';
import { fetchRentlyDeliveredCandidatesForSes } from './rentlyEnrichment';

describe('Rently delivered candidates for SES', () => {
  it('uses every paged result even when the dashboard widget count is lower', async () => {
    const first = Array.from({ length: 40 }, (_, index) => ({ Id: index + 1, CurrentStatus: 2, Car: { Plate: `${index}ABC` } }));
    const second = Array.from({ length: 25 }, (_, index) => ({ Id: index + 41, CurrentStatus: 2, Car: { Plate: `${index + 40}ABC` } }));
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ Results: first, NextOffset: 40, Total: 64 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ Results: second, NextOffset: null, Total: 64 }), { status: 200 }));

    const rows = await fetchRentlyDeliveredCandidatesForSes({ host: 'rently.invalid', token: 'synthetic', pageSize: 40, fetchImpl });
    expect(rows).toHaveLength(65);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(firstUrl.searchParams.get('IsTransfer')).toBe('false');
    expect(firstUrl.searchParams.get('CurrentStatus')).toBe('2');
    expect(firstUrl.searchParams.get('DeliveryBranchOffice')).toBe('1');
  });
});
