import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve('server/rentlyHub.ts'), 'utf8');

describe('seguridad y contrato de Rently Hub', () => {
  it('deshabilita el proxy HTTP arbitrario', () => {
    expect(source).toContain('explorador HTTP arbitrario de Rently está deshabilitado');
    expect(source).not.toContain('httpMethod || "GET"');
    expect(source).not.toContain('raw: data');
  });

  it('usa las rutas y parámetros oficiales de autos y clientes', () => {
    expect(source).toContain('/api/cars/{id}');
    expect(source).toContain('/api/customers?filter=');
    expect(source).not.toContain('/api/car/{id}');
    expect(source).not.toContain('/api/customers?search=');
  });

  it('informa truncamiento en lugar de ocultarlo', () => {
    expect(source).toContain('const truncated = allResults.length < total');
    expect(source).toContain('truncated }');
  });
});
