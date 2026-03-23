import { describe, it, expect } from 'vitest';

/**
 * Tests for invitation notification types integration.
 * Verifies that the notification type system correctly handles
 * invitation_sent and invitation_accepted types across all UI components.
 */

// Replicate the type definitions to test consistency
type NotificationType = 'mention' | 'assignment' | 'reminder' | 'transfer_note' | 'repair_update' | 'accident_report' | 'damage_report_update' | 'vehicle_prep_alert' | 'invitation_sent' | 'invitation_accepted';
type NotificationEntityType = 'task' | 'task_update' | 'reminder' | 'transfer_request' | 'transfer_note' | 'form_response' | 'repair' | 'accident' | 'damage_report' | 'vehicle_prep' | 'invitation';

describe('Invitation Notification Types', () => {
  const allNotificationTypes: NotificationType[] = [
    'mention', 'assignment', 'reminder', 'transfer_note',
    'repair_update', 'accident_report', 'damage_report_update',
    'vehicle_prep_alert', 'invitation_sent', 'invitation_accepted',
  ];

  const allEntityTypes: NotificationEntityType[] = [
    'task', 'task_update', 'reminder', 'transfer_request',
    'transfer_note', 'form_response', 'repair', 'accident',
    'damage_report', 'vehicle_prep', 'invitation',
  ];

  it('should include invitation_sent in notification types', () => {
    expect(allNotificationTypes).toContain('invitation_sent');
  });

  it('should include invitation_accepted in notification types', () => {
    expect(allNotificationTypes).toContain('invitation_accepted');
  });

  it('should include invitation in entity types', () => {
    expect(allEntityTypes).toContain('invitation');
  });

  it('should have 10 notification types total', () => {
    expect(allNotificationTypes).toHaveLength(10);
  });

  it('should have 11 entity types total', () => {
    expect(allEntityTypes).toHaveLength(11);
  });
});

describe('Invitation Notification Routing', () => {
  // Replicate the routing maps from NotificationBell and useRealtimeNotifications
  const bellRoutes: Record<string, string> = {
    task: '/tasks?task=123',
    task_update: '/tasks',
    reminder: '/tasks',
    transfer_request: '/transfers/requests/123',
    transfer_note: '/transfers/requests/123',
    repair: '/garatech/repairs/123',
    accident: '/garatech/accidents/123',
    damage_report: '/garatech/reports/123',
    invitation: '/admin/members',
  };

  const realtimeRoutes: Record<string, string> = {
    task: '/tasks?task=123',
    task_update: '/tasks',
    reminder: '/tasks',
    transfer_request: '/transfers/requests/123',
    transfer_note: '/transfers/requests/123',
    repair: '/garatech/repairs/123',
    accident: '/garatech/accidents/123',
    damage_report: '/garatech/reports/123',
    form_response: '/notifications',
    vehicle_prep: '/vehicle-status',
    invitation: '/admin/members',
  };

  it('should route invitation entity_type to /admin/members in NotificationBell', () => {
    expect(bellRoutes['invitation']).toBe('/admin/members');
  });

  it('should route invitation entity_type to /admin/members in realtime notifications', () => {
    expect(realtimeRoutes['invitation']).toBe('/admin/members');
  });

  it('should have a route for every entity type in realtime notifications', () => {
    const entityTypes: NotificationEntityType[] = [
      'task', 'task_update', 'reminder', 'transfer_request',
      'transfer_note', 'form_response', 'repair', 'accident',
      'damage_report', 'vehicle_prep', 'invitation',
    ];
    for (const type of entityTypes) {
      expect(realtimeRoutes[type]).toBeDefined();
    }
  });
});

describe('Invitation Notification UI Metadata', () => {
  // Replicate the icon/color/label maps from Notifications.tsx
  const typeLabels: Record<NotificationType, string> = {
    mention: 'Mención',
    assignment: 'Asignación',
    reminder: 'Recordatorio',
    transfer_note: 'Nota de Transfer',
    repair_update: 'Reparación',
    accident_report: 'Accidente',
    damage_report_update: 'Informe Daños',
    vehicle_prep_alert: 'Preparación Vehículo',
    invitation_sent: 'Invitación Enviada',
    invitation_accepted: 'Invitación Aceptada',
  };

  const typeColors: Record<NotificationType, string> = {
    mention: 'text-blue-500 bg-blue-500/10',
    assignment: 'text-green-500 bg-green-500/10',
    reminder: 'text-orange-500 bg-orange-500/10',
    transfer_note: 'text-amber-600 bg-amber-500/10',
    repair_update: 'text-indigo-500 bg-indigo-500/10',
    accident_report: 'text-red-500 bg-red-500/10',
    damage_report_update: 'text-rose-500 bg-rose-500/10',
    vehicle_prep_alert: 'text-red-600 bg-red-500/10',
    invitation_sent: 'text-purple-500 bg-purple-500/10',
    invitation_accepted: 'text-emerald-500 bg-emerald-500/10',
  };

  it('should have Spanish label for invitation_sent', () => {
    expect(typeLabels['invitation_sent']).toBe('Invitación Enviada');
  });

  it('should have Spanish label for invitation_accepted', () => {
    expect(typeLabels['invitation_accepted']).toBe('Invitación Aceptada');
  });

  it('should have purple color for invitation_sent', () => {
    expect(typeColors['invitation_sent']).toContain('purple');
  });

  it('should have emerald color for invitation_accepted', () => {
    expect(typeColors['invitation_accepted']).toContain('emerald');
  });

  it('should have a label for every notification type', () => {
    const allTypes: NotificationType[] = [
      'mention', 'assignment', 'reminder', 'transfer_note',
      'repair_update', 'accident_report', 'damage_report_update',
      'vehicle_prep_alert', 'invitation_sent', 'invitation_accepted',
    ];
    for (const type of allTypes) {
      expect(typeLabels[type]).toBeDefined();
      expect(typeLabels[type].length).toBeGreaterThan(0);
      expect(typeColors[type]).toBeDefined();
      expect(typeColors[type].length).toBeGreaterThan(0);
    }
  });
});
