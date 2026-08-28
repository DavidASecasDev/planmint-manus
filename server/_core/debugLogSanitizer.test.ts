import { describe, expect, it } from 'vitest';
import { sanitizeConsoleEntries, sanitizeNetworkEntries, sanitizeSessionEntries } from './debugLogSanitizer';

describe('privacidad de logs de preview', () => {
  it('elimina token, query, cuerpos y respuesta de cada petición', () => {
    const raw = [{
      timestamp: 1, type: 'fetch', method: 'POST', url: '/api/ses/drafts?reference=REAL-123', duration: 40,
      request: { headers: { authorization: 'Bearer secret-token' }, body: { customer: 'Persona Real' } },
      response: { status: 200, body: { data: [{ reference: 'REAL-123' }] } },
    }];
    const safe = sanitizeNetworkEntries(raw);
    expect(safe).toEqual([{ timestamp: 1, type: 'fetch', method: 'POST', url: '/api/ses/drafts', status: 200, duration: 40, failed: false }]);
    expect(JSON.stringify(safe)).not.toMatch(/secret-token|Persona Real|REAL-123|authorization|request|response/);
  });

  it('no conserva mensajes de consola ni contenido de eventos de sesión', () => {
    expect(JSON.stringify(sanitizeConsoleEntries([{ level: 'error', message: 'Nombre real' }]))).not.toContain('Nombre real');
    expect(JSON.stringify(sanitizeSessionEntries([{ type: 'input', value: 'Documento real' }]))).not.toContain('Documento real');
  });
});
