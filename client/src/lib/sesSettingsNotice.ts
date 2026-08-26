export type SesSettingsLike = {
  lessor_code?: string | null;
  establishment_code?: string | null;
} | null | undefined;

export type SesSettingsNotice = {
  kind: 'warning' | 'info';
  title: string;
  description: string;
} | null;

export function getSesSettingsNotice(settings: SesSettingsLike): SesSettingsNotice {
  if (!settings?.lessor_code) {
    return {
      kind: 'warning',
      title: 'Falta el código de arrendador',
      description: 'Configura el código oficial de arrendador antes de exportar. La revisión de contratos ya puede comenzar.',
    };
  }

  if (!settings.establishment_code) {
    return {
      kind: 'info',
      title: 'Sede comunicada mediante dirección',
      description: 'Son Malferit se incluye con su dirección completa. El código de establecimiento solo debe añadirse si SES asigna uno válido a esta sede.',
    };
  }

  return null;
}
