// Vertical presets configuration for organization modules
// These define recommended module configurations per business vertical

export type VerticalPresetKey = 'internal_teams' | 'agencies' | 'operations';

export interface VerticalPreset {
  key: VerticalPresetKey;
  name: string;
  description: string;
  modules: Record<string, boolean>;
}

export const VERTICAL_PRESETS: Record<VerticalPresetKey, VerticalPreset> = {
  internal_teams: {
    key: 'internal_teams',
    name: 'Equipos internos',
    description: 'Para equipos internos y departamentos. Ideal para gestión de proyectos internos, colaboración entre áreas y seguimiento de tareas del equipo.',
    modules: {
      teams: true,
      reports: true,
      templates: true,
      automations: false,
      reservations: false,
      time_tracking: true,
      forms: false,
    },
  },
  agencies: {
    key: 'agencies',
    name: 'Agencias / Proyectos',
    description: 'Para agencias y gestión de proyectos con clientes. Incluye automatizaciones, plantillas y control de tiempo para facturación.',
    modules: {
      teams: true,
      reports: true,
      templates: true,
      automations: true,
      reservations: false,
      time_tracking: true,
      forms: true,
    },
  },
  operations: {
    key: 'operations',
    name: 'Operaciones / Reservas',
    description: 'Para rent-a-car, logística y gestión de operaciones. Enfocado en reservas, automatizaciones y reportes operativos.',
    modules: {
      reservations: true,
      reports: true,
      automations: true,
      teams: false,
      templates: false,
      time_tracking: false,
      forms: true,
      transfers: true,
      movements: true,
    },
  },
};

// Get list of modules that would be activated by applying a preset
// Only returns modules that are in the preset AND currently disabled
export function getModulesToActivate(
  preset: VerticalPreset,
  currentModules: Record<string, boolean>
): string[] {
  const toActivate: string[] = [];
  
  for (const [moduleKey, shouldBeEnabled] of Object.entries(preset.modules)) {
    // Only add if preset wants it enabled AND it's currently disabled
    if (shouldBeEnabled && !currentModules[moduleKey]) {
      toActivate.push(moduleKey);
    }
  }
  
  return toActivate;
}

// Get a nice display name for a module key
export const MODULE_DISPLAY_NAMES: Record<string, string> = {
  reservations: 'Reservas',
  automations: 'Automatizaciones',
  reports: 'Reportes',
  templates: 'Plantillas',
  teams: 'Equipos',
  time_tracking: 'Control de Tiempo',
  forms: 'Formularios',
  form_builder: 'Form Builder',
  transfers: 'Transfers',
  movements: 'Movimientos',
};
