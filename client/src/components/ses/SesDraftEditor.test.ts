import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'client/src/components/ses/SesDraftEditor.tsx'), 'utf8');

describe('editor operativo SES simplificado', () => {
  it('no expone procedencia, badges técnicos ni conflictos de sincronización', () => {
    expect(source).not.toContain('Procedencia de los datos');
    expect(source).not.toContain('draft.sourceByField');
    expect(source).not.toContain('draft.syncConflicts');
    expect(source).not.toContain('Rently propuso otro valor');
  });

  it('mantiene visibles los datos funcionales y la revisión de pendientes', () => {
    expect(source).toContain('Revisión necesaria');
    expect(source).toContain('Field label="Marca" required');
    expect(source).toContain('Field label="Modelo" required');
    expect(source).toContain('Field label="Matrícula" required');
    expect(source).toContain('Guardar y validar');
  });
});
