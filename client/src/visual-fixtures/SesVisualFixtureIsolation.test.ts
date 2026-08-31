import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fixture = readFileSync(new URL('./SesHospedajesFixture.tsx', import.meta.url), 'utf8');
const fixtureHtml = readFileSync(new URL('../../ses-hospedajes-fixture.html', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useSesHospedajes.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/ses/SesHospedajes.tsx', import.meta.url), 'utf8');
const viteServer = readFileSync(new URL('../../../server/_core/vite.ts', import.meta.url), 'utf8');
const serverEntry = readFileSync(new URL('../../../server/_core/index.ts', import.meta.url), 'utf8');
const sesEndpoints = readFileSync(new URL('../../../server/sesHospedajes/sesEndpoints.ts', import.meta.url), 'utf8');

describe('aislamiento visual y UI operativa de SES', () => {
  it('mantiene la fixture visual desconectada de autenticación, Supabase y APIs', () => {
    expect(fixtureHtml).toContain('SesHospedajesFixture.tsx');
    expect(fixture).toContain('SYNTHETIC-65001');
    expect(fixture).not.toMatch(/apiInvoke|useSesHospedajes|integrations\/supabase|supabase\.co|SUPABASE_/);
    expect(viteServer).toContain('app.get("/__fixtures/ses-hospedajes"');
    expect(viteServer.indexOf('app.get("/__fixtures/ses-hospedajes"')).toBeLessThan(viteServer.indexOf('app.use(vite.middlewares)'));
    expect(serverEntry).toMatch(/NODE_ENV === "development"[\s\S]*await setupVite\(app, server\)[\s\S]*else[\s\S]*serveStatic\(app\)/);
  });

  it('no expone inventarios, XSD, preparación, elegibilidad ni conciliación en la interfaz operativa', () => {
    expect(hook).not.toMatch(/importOfficialInventory|ses\/official-inventory/);
    expect(page).not.toMatch(/Preparar reservas|Revalidar Rently|Control oficial|carga.*XSD|Elegibilidad|Excepción/);
    expect(page).toContain('Sincronizar Rently');
    expect(page).toContain('Descargar XML');
  });

  it('conecta la acción por fila con SesOfficialCheckDialog', () => {
    expect(fixture).toContain('<SesDraftActions');
    expect(fixture).toContain('<SesOfficialCheckDialog');
    expect(page).toContain('onCheck={() => setOfficialCheckDraft(draft)}');
    expect(page).toContain('<SesOfficialCheckDialog');
    expect(page).toContain('sticky right-0');
  });

  it('muestra tres estados y conserva seleccionable un aviso SES no bloqueante', () => {
    expect(fixture).toContain('Incompletos');
    expect(fixture).toContain('Listos');
    expect(fixture).toContain('XML generado');
    expect(fixture).toContain('sesDuplicateWarning');
    expect(fixture).toContain('canSelectSesDraftForXml(draft)');
  });

  it('mantiene XSD, elegibilidad y conciliación fuera de la descarga XML', () => {
    const exportHandler = sesEndpoints.slice(
      sesEndpoints.indexOf('export async function handleSesExportXml'),
      sesEndpoints.indexOf('\n}', sesEndpoints.indexOf('return sendError(res, error, \'export-xml\')')) + 2,
    );
    expect(exportHandler).toContain('validateSesDraft');
    expect(exportHandler).toContain('validateSesXmlAgainstOfficialContract');
    expect(exportHandler).not.toMatch(/selectSesXmlValidationMode|storageGet|evaluateSesEligibility|evaluateOfficialClearance|official_check_status/);
  });

  it('Comprobar SES no modifica estado ni ready_for_xml', () => {
    const checkHandler = sesEndpoints.slice(
      sesEndpoints.indexOf('export async function handleSesCheckOfficialCommunication'),
      sesEndpoints.indexOf('export async function handleSesCreateEligibilityException'),
    );
    const updateObject = checkHandler.slice(checkHandler.indexOf("from('ses_contract_drafts').update({"), checkHandler.indexOf("}).eq('organization_id'"));
    expect(updateObject).toContain('official_check_status');
    expect(updateObject).not.toMatch(/ready_for_xml|status: gates|is_eligible/);
  });
});
