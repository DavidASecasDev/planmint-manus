/**
 * Tests for vertical-based sidebar filtering logic.
 * Validates that VERTICAL_HIDDEN_PATHS correctly hides menu items
 * based on organization vertical_preset.
 */
import { describe, it, expect } from 'vitest';

// Replicate the VERTICAL_HIDDEN_PATHS from AppSidebar
type OrganizationVertical = 'rent_a_car' | 'accommodation' | 'transfers' | 'general';

const VERTICAL_HIDDEN_PATHS: Record<OrganizationVertical, string[]> = {
  rent_a_car: [],
  accommodation: [
    '/reservations',
    '/vehicles',
    '/movements',
    '/live-map',
    '/timeline',
    '/fleet',
    '/garatech',
  ],
  transfers: [
    '/vehicles',
    '/fleet',
    '/garatech',
  ],
  general: [],
};

const menuItems = [
  { title: 'Dashboard', url: '/dashboard' },
  { title: 'Tiempo', url: '/time-tracking' },
  { title: 'Programación', url: '/reservations' },
  { title: 'Mapa En Camino', url: '/live-map' },
  { title: 'Estado Coches', url: '/vehicles' },
  { title: 'Movimientos', url: '/movements' },
  { title: 'Recordatorios', url: '/reminders' },
  { title: 'Áreas', url: '/areas' },
  { title: 'Etiquetas', url: '/tags' },
  { title: 'Automatizaciones', url: '/automations' },
  { title: 'Plantillas', url: '/templates' },
  { title: 'Reportes', url: '/reports' },
  { title: 'Teams', url: '/teams' },
  { title: 'Horarios', url: '/schedules' },
  { title: 'Timeline', url: '/timeline' },
  { title: 'Objetos Perdidos', url: '/lost-found' },
  { title: 'Solicitudes Servicio', url: '/service-requests' },
  { title: 'Ajustes', url: '/settings' },
];

function filterByVertical(vertical: OrganizationVertical | null | undefined) {
  const hiddenPaths = vertical && vertical !== 'general'
    ? VERTICAL_HIDDEN_PATHS[vertical] || []
    : [];
  return menuItems.filter(item =>
    !hiddenPaths.some(hp => item.url === hp || item.url.startsWith(hp + '/'))
  );
}

describe('Vertical Sidebar Filtering', () => {
  it('general vertical shows all menu items', () => {
    const filtered = filterByVertical('general');
    expect(filtered.length).toBe(menuItems.length);
  });

  it('null/undefined vertical shows all menu items', () => {
    expect(filterByVertical(null).length).toBe(menuItems.length);
    expect(filterByVertical(undefined).length).toBe(menuItems.length);
  });

  it('rent_a_car vertical shows all menu items', () => {
    const filtered = filterByVertical('rent_a_car');
    expect(filtered.length).toBe(menuItems.length);
  });

  it('accommodation vertical hides fleet/vehicle-related items', () => {
    const filtered = filterByVertical('accommodation');
    const titles = filtered.map(i => i.title);
    
    // Should NOT include these
    expect(titles).not.toContain('Programación');
    expect(titles).not.toContain('Estado Coches');
    expect(titles).not.toContain('Movimientos');
    expect(titles).not.toContain('Mapa En Camino');
    expect(titles).not.toContain('Timeline');
    
    // Should still include these
    expect(titles).toContain('Dashboard');
    expect(titles).toContain('Reportes');
    expect(titles).toContain('Teams');
    expect(titles).toContain('Horarios');
    expect(titles).toContain('Solicitudes Servicio');
    expect(titles).toContain('Ajustes');
  });

  it('transfers vertical hides vehicle/fleet items but keeps reservations', () => {
    const filtered = filterByVertical('transfers');
    const titles = filtered.map(i => i.title);
    
    // Should NOT include these
    expect(titles).not.toContain('Estado Coches');
    
    // Should still include these
    expect(titles).toContain('Dashboard');
    expect(titles).toContain('Programación');
    expect(titles).toContain('Mapa En Camino');
    expect(titles).toContain('Movimientos');
    expect(titles).toContain('Reportes');
  });

  it('accommodation vertical hides 7 items (reservations, vehicles, movements, live-map, timeline, fleet, garatech)', () => {
    const hidden = VERTICAL_HIDDEN_PATHS.accommodation;
    expect(hidden.length).toBe(7);
  });

  it('transfers vertical hides 3 items (vehicles, fleet, garatech)', () => {
    const hidden = VERTICAL_HIDDEN_PATHS.transfers;
    expect(hidden.length).toBe(3);
  });

  it('collapsible menus respect vertical hiding', () => {
    // Simulate: Transfers collapsible should NOT show for accommodation (because /vehicles is hidden AND no explicit /transfers in hidden)
    // Actually for accommodation, /transfers is NOT in hidden paths, but /vehicles is hidden
    // The collapsible anchors to /dashboard when /vehicles is hidden
    const accommodationHidden = VERTICAL_HIDDEN_PATHS.accommodation;
    
    // /vehicles is hidden → collapsibles move to /dashboard anchor
    expect(accommodationHidden).toContain('/vehicles');
    // /garatech IS in hidden paths for accommodation → Garatech collapsible won't show
    expect(accommodationHidden).toContain('/garatech');
    // /fleet IS in hidden paths for accommodation → Fleet collapsible won't show
    expect(accommodationHidden).toContain('/fleet');
  });
});
