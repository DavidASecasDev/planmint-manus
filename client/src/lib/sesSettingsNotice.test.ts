import { describe, expect, it } from 'vitest';
import { getSesSettingsNotice } from './sesSettingsNotice';

describe('getSesSettingsNotice', () => {
  it('warns only when the required lessor code is missing', () => {
    expect(getSesSettingsNotice({ lessor_code: null, establishment_code: null })).toMatchObject({
      kind: 'warning',
      title: 'Falta el código de arrendador',
    });
  });

  it('treats the establishment code as optional when the office uses its full address', () => {
    expect(getSesSettingsNotice({ lessor_code: '0000065825', establishment_code: null })).toMatchObject({
      kind: 'info',
      title: 'Sede comunicada mediante dirección',
    });
  });

  it('shows no notice when both codes are configured', () => {
    expect(getSesSettingsNotice({ lessor_code: '0000065825', establishment_code: '0000129394' })).toBeNull();
  });
});
