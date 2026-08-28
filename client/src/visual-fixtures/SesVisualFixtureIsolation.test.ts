import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fixture = readFileSync(new URL('./SesHospedajesFixture.tsx', import.meta.url), 'utf8');
const fixtureHtml = readFileSync(new URL('../../ses-hospedajes-fixture.html', import.meta.url), 'utf8');
const compliance = readFileSync(new URL('../components/ses/SesComplianceDialog.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useSesHospedajes.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/ses/SesHospedajes.tsx', import.meta.url), 'utf8');
const viteServer = readFileSync(new URL('../../../server/_core/vite.ts', import.meta.url), 'utf8');
const serverEntry = readFileSync(new URL('../../../server/_core/index.ts', import.meta.url), 'utf8');

describe('aislamiento visual y UI operativa de SES', () => {
  it('mantiene la fixture visual desconectada de autenticación, Supabase y APIs', () => {
    expect(fixtureHtml).toContain('SesHospedajesFixture.tsx');
    expect(fixture).toContain('SYNTHETIC-65001');
    expect(fixture).not.toMatch(/apiInvoke|useSesHospedajes|integrations\/supabase|supabase\.co|SUPABASE_/);
    expect(viteServer).toContain('app.get("/__fixtures/ses-hospedajes"');
    expect(viteServer.indexOf('app.get("/__fixtures/ses-hospedajes"')).toBeLessThan(viteServer.indexOf('app.use(vite.middlewares)'));
    expect(serverEntry).toMatch(/NODE_ENV === "development"[\s\S]*await setupVite\(app, server\)[\s\S]*else[\s\S]*serveStatic\(app\)/);
  });

  it('no expone importación JSON ni inventarios masivos en la interfaz operativa', () => {
    expect(compliance).not.toMatch(/JSON\.parse|inventoryJson|onImportInventory|Lista JSON|Añadir evidencia/);
    expect(hook).not.toMatch(/importOfficialInventory|ses\/official-inventory/);
    expect(compliance).toContain('Sin cargas masivas');
  });

  it('conecta la acción por fila con SesOfficialCheckDialog', () => {
    expect(fixture).toContain('<SesDraftActions');
    expect(fixture).toContain('<SesOfficialCheckDialog');
    expect(page).toContain('onCheck={() => setOfficialCheckDraft(draft)}');
    expect(page).toContain('<SesOfficialCheckDialog');
    expect(page).toContain('sticky right-0');
  });
});
