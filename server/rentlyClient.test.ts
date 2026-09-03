import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRentlyTokenCacheForTests, getCachedRentlyToken, RentlyApiError, rentlyRequest } from './rentlyClient';

const credentials = { host: 'tenant.rently.com.ar', clientId: 'client', clientSecret: 'secret' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearRentlyTokenCacheForTests();
});

describe('cliente Rently compartido', () => {
  it('reutiliza el token OAuth mientras siga vigente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'token-1', expires_in: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getCachedRentlyToken(credentials)).resolves.toBe('token-1');
    await expect(getCachedRentlyToken(credentials)).resolves.toBe('token-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renueva una sola vez el token después de un 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'old', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ ErrorMessage: 'Expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'new', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await rentlyRequest<{ ok: boolean }>({ credentials, path: '/api/bookings/list' });
    expect(result.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('expone solo el error oficial estructurado y no el cuerpo arbitrario', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ ErrorMessage: 'Dato inválido', ErrorCode: 'BookingError', Id: 'err-1', secret: 'no' }, 400));
    vi.stubGlobal('fetch', fetchMock);
    await expect(rentlyRequest({ credentials, path: '/api/booking/book', method: 'POST', body: {} }))
      .rejects.toMatchObject<RentlyApiError>({ status: 400, errorCode: 'BookingError', errorId: 'err-1' });
  });

  it('rechaza hosts y rutas fuera del contrato Rently', async () => {
    await expect(getCachedRentlyToken({ ...credentials, host: 'evil.example.com' })).rejects.toThrow();
    await expect(rentlyRequest({ credentials, path: 'https://evil.example.com' })).rejects.toThrow('Ruta Rently no permitida');
  });
});
