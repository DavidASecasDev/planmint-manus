/**
 * Shared Permission Defaults — Single Source of Truth
 *
 * This file defines the complete list of permission keys and the base defaults
 * for each system role. Both the frontend (usePermissions, EffectivePermissionsView)
 * and backend (checkUserPermission, handleGetMyPermissions) should reference these.
 *
 * Resolution chain:
 *   1. ALL_PERMISSION_KEYS — the complete set of permission keys
 *   2. BASE_VIEW_PERMISSIONS — granted to ALL active members regardless of role
 *   3. ROLE_DEFAULTS[role] — additional permissions per system role
 *   4. role_permissions table — per-role overrides (enabled/disabled)
 *   5. custom_roles.permissions_json — for custom roles (replaces steps 2-4)
 *   6. user_permissions table — per-user overrides (HIGHEST PRIORITY)
 */

/**
 * Complete list of all permission keys in the system.
 */
export const ALL_PERMISSION_KEYS = [
  // Tasks
  "tasks.view", "tasks.create", "tasks.update", "tasks.delete", "tasks.assign", "tasks.change_status", "tasks.manage_columns",
  // Areas
  "areas.view", "areas.create", "areas.update", "areas.delete", "areas.manage_visibility", "areas.manage_access_rules",
  // Tags
  "tags.view", "tags.create", "tags.update", "tags.delete", "tags.manage",
  // Templates
  "templates.view", "templates.apply", "templates.create", "templates.delete",
  // Teams
  "teams.view",
  // Automations
  "automations.view", "automations.create", "automations.manage",
  // Reports
  "reports.view", "reports.export", "reports.view_financial",
  // Billing
  "billing.view", "billing.manage",
  // Members
  "members.view", "members.create", "members.invite", "members.change_role", "members.manage_permissions", "members.suspend",
  // Security
  "security.view_audit_logs",
  // Integrations
  "integrations.manage_api_keys",
  // Reservations
  "reservations.view", "reservations.create", "reservations.manage",
  // Garatech
  "garatech.view", "garatech.create", "garatech.update", "garatech.change_status", "garatech.edit_dates", "garatech.manage_catalog", "garatech.manage_accidents", "garatech.manage",
  // Transfers
  "transfers.view", "transfers.create", "transfers.update", "transfers.change_status", "transfers.delete", "transfers.manage_brokers", "transfers.manage",
  // Forms
  "forms.view", "forms.create", "forms.update", "forms.delete", "forms.view_responses", "forms.manage",
  // Vehicles
  "vehicles.view", "vehicles.create", "vehicles.update", "vehicles.archive", "vehicles.manage_daily_tasks", "vehicles.change_status", "vehicles.complete_tasks", "vehicles.manage_locations", "vehicles.sync", "vehicles.import", "vehicles.manage",
  // Time Tracking
  "time_tracking.view", "time_tracking.view_team", "time_tracking.create", "time_tracking.manage",
  // Movements
  "movements.view", "movements.create", "movements.manage", "movements.delete", "movements.edit_photos", "movements.upload_receipt",
  // Daily Tasks
  "daily_tasks.view", "daily_tasks.view_other_days", "daily_tasks.complete", "daily_tasks.manage",
  // Fleet
  "fleet.view", "fleet.manage", "fleet.import", "fleet.gps",
  // Schedules (Horarios)
  "schedules.view", "schedules.assign", "schedules.manage_templates", "schedules.view_directiva", "schedules.manage_notes", "schedules.manage",
  // Preparation (Lista de preparación)
  "preparation.view", "preparation.start", "preparation.complete_tasks", "preparation.view_progress", "preparation.manage",
  // Lost & Found (Objetos Perdidos)
  "lost_found.view", "lost_found.create", "lost_found.update", "lost_found.manage",
  // Rently (Bidirectional Sync)
  "rently.booking_confirm", "rently.booking_cancel", "rently.booking_uncancel", "rently.booking_update", "rently.booking_create",
  "rently.operations_delivery", "rently.operations_return", "rently.customer_manage", "rently.cars_relocate", "rently.manage",
] as const;

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

/**
 * Base view permissions granted to ALL active members regardless of role.
 * These are the minimum permissions any active member has.
 */
export const BASE_VIEW_PERMISSIONS: PermissionKey[] = [
  "tasks.view",
  "areas.view",
  "tags.view",
  "templates.view",
  "teams.view",
  "members.view",
  "reservations.view",
  "vehicles.view",
  "movements.view",
  "daily_tasks.view",
  "fleet.view",
  "garatech.view",
  "transfers.view",
  "forms.view",
  "time_tracking.view",
  "schedules.view",
  "preparation.view",
  "lost_found.view",
];

/**
 * Additional permissions granted to each system role ON TOP of BASE_VIEW_PERMISSIONS.
 * Owner gets ALL permissions (handled separately).
 */
export const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  admin: [
    "tasks.create", "tasks.update", "tasks.delete", "tasks.assign", "tasks.change_status", "tasks.manage_columns",
    "areas.create", "areas.update", "areas.delete", "areas.manage_visibility",
    "tags.create", "tags.update", "tags.delete", "tags.manage",
    "templates.apply", "templates.create", "templates.delete",
    "automations.view", "automations.create", "automations.manage",
    "reports.view", "reports.export", "reports.view_financial",
    "billing.view", "billing.manage",
    "members.create", "members.invite", "members.change_role", "members.manage_permissions", "members.suspend",
    "security.view_audit_logs",
    "integrations.manage_api_keys",
    "reservations.create", "reservations.manage",
    "garatech.create", "garatech.update", "garatech.change_status", "garatech.edit_dates", "garatech.manage_catalog", "garatech.manage_accidents", "garatech.manage",
    "transfers.create", "transfers.update", "transfers.change_status", "transfers.delete", "transfers.manage_brokers", "transfers.manage",
    "forms.create", "forms.update", "forms.delete", "forms.view_responses", "forms.manage",
    "vehicles.create", "vehicles.update", "vehicles.archive", "vehicles.manage_daily_tasks", "vehicles.change_status", "vehicles.complete_tasks", "vehicles.manage_locations", "vehicles.sync", "vehicles.import", "vehicles.manage",
    "time_tracking.view_team", "time_tracking.create", "time_tracking.manage",
    "movements.create", "movements.manage", "movements.delete", "movements.edit_photos", "movements.upload_receipt",
    "daily_tasks.view_other_days", "daily_tasks.complete", "daily_tasks.manage",
    "fleet.manage", "fleet.import", "fleet.gps",
    "schedules.assign", "schedules.manage_templates", "schedules.view_directiva", "schedules.manage_notes", "schedules.manage",
    "preparation.start", "preparation.complete_tasks", "preparation.view_progress", "preparation.manage",
    "lost_found.create", "lost_found.update", "lost_found.manage",
    // Rently
    "rently.booking_confirm", "rently.booking_cancel", "rently.booking_uncancel", "rently.booking_update", "rently.booking_create",
    "rently.operations_delivery", "rently.operations_return", "rently.customer_manage", "rently.cars_relocate", "rently.manage",
  ],
  manager: [
    "tasks.create", "tasks.update", "tasks.assign", "tasks.change_status",
    "areas.create", "areas.update",
    "tags.create", "tags.update",
    "templates.apply",
    "automations.view",
    "reports.view",
    "reservations.create",
    "garatech.create", "garatech.update", "garatech.change_status",
    "transfers.create", "transfers.update", "transfers.change_status",
    "forms.create", "forms.update", "forms.view_responses",
    "vehicles.update", "vehicles.manage_daily_tasks", "vehicles.change_status", "vehicles.complete_tasks", "vehicles.manage_locations",
    "time_tracking.view_team", "time_tracking.create",
    "movements.create", "movements.manage", "movements.edit_photos", "movements.upload_receipt",
    "daily_tasks.view_other_days", "daily_tasks.complete", "daily_tasks.manage",
    "schedules.assign",
    "preparation.start", "preparation.complete_tasks", "preparation.view_progress", "preparation.manage",
    "lost_found.create", "lost_found.update",
    // Rently (limited)
    "rently.booking_confirm", "rently.booking_cancel", "rently.booking_update",
    "rently.operations_delivery", "rently.operations_return", "rently.customer_manage",
  ],
  member: [
    "tasks.create", "tasks.update",
    "vehicles.change_status", "vehicles.complete_tasks",
    "movements.create", "movements.upload_receipt",
    "daily_tasks.complete",
    "time_tracking.create",
    "preparation.start", "preparation.complete_tasks",
    "lost_found.create",
  ],
  read_only: [],
};

/**
 * Compute the full set of default permissions for a given system role.
 * Returns a Record<string, boolean> with ALL permission keys.
 */
export function getDefaultPermissionsForRole(role: string): Record<string, boolean> {
  const permissions: Record<string, boolean> = {};

  // Start with all permissions as false
  for (const key of ALL_PERMISSION_KEYS) {
    permissions[key] = false;
  }

  // Owner gets everything
  if (role === "owner") {
    for (const key of ALL_PERMISSION_KEYS) {
      permissions[key] = true;
    }
    return permissions;
  }

  // Apply base view permissions
  for (const key of BASE_VIEW_PERMISSIONS) {
    permissions[key] = true;
  }

  // Apply role-specific defaults
  const roleDefaults = ROLE_DEFAULTS[role];
  if (roleDefaults) {
    for (const key of roleDefaults) {
      permissions[key] = true;
    }
  }

  return permissions;
}

/**
 * Flatten nested permissions_json from custom_roles into flat "module.action" keys.
 * This is the single source of truth for custom role flattening logic.
 */
export function flattenCustomRolePermissions(pj: Record<string, any>): Record<string, boolean> {
  const flat: Record<string, boolean> = {};

  // Tasks
  flat["tasks.view"] = pj?.tasks?.view ?? false;
  flat["tasks.create"] = pj?.tasks?.create ?? false;
  flat["tasks.update"] = pj?.tasks?.update ?? false;
  flat["tasks.delete"] = pj?.tasks?.delete ?? false;
  flat["tasks.assign"] = pj?.tasks?.update ?? false;
  flat["tasks.change_status"] = pj?.tasks?.change_status ?? pj?.tasks?.update ?? false;
  flat["tasks.manage_columns"] = pj?.tasks?.manage_columns ?? pj?.tasks?.delete ?? false;
  // Areas
  flat["areas.view"] = pj?.areas?.view ?? false;
  flat["areas.create"] = pj?.areas?.manage ?? false;
  flat["areas.update"] = pj?.areas?.manage ?? false;
  flat["areas.delete"] = pj?.areas?.manage ?? false;
  flat["areas.manage_visibility"] = pj?.areas?.manage ?? false;
  flat["areas.manage_access_rules"] = pj?.areas?.manage_access_rules ?? pj?.areas?.manage ?? false;
  // Tags
  flat["tags.view"] = pj?.tags?.view ?? false;
  flat["tags.create"] = pj?.tags?.create ?? false;
  flat["tags.update"] = pj?.tags?.manage ?? false;
  flat["tags.delete"] = pj?.tags?.manage ?? false;
  flat["tags.manage"] = pj?.tags?.manage ?? false;
  // Templates
  flat["templates.view"] = pj?.templates?.view ?? pj?.templates?.read ?? false;
  flat["templates.apply"] = pj?.templates?.read ?? false;
  flat["templates.create"] = pj?.templates?.manage ?? false;
  flat["templates.delete"] = pj?.templates?.manage ?? false;
  // Teams
  flat["teams.view"] = pj?.team?.read ?? false;
  // Automations
  flat["automations.view"] = pj?.automations?.view ?? pj?.automations?.read ?? false;
  flat["automations.create"] = pj?.automations?.manage ?? false;
  flat["automations.manage"] = pj?.automations?.manage ?? false;
  // Reports
  flat["reports.view"] = pj?.reports?.view ?? false;
  flat["reports.export"] = pj?.reports?.export ?? pj?.reports?.view ?? false;
  flat["reports.view_financial"] = pj?.reports?.view_financial ?? pj?.reports?.view ?? false;
  // Billing
  flat["billing.view"] = pj?.billing?.view ?? pj?.billing?.read ?? false;
  flat["billing.manage"] = pj?.billing?.manage ?? false;
  // Members
  flat["members.view"] = pj?.team?.read ?? false;
  flat["members.create"] = pj?.team?.manage ?? false;
  flat["members.invite"] = pj?.team?.manage ?? false;
  flat["members.change_role"] = pj?.team?.manage ?? false;
  flat["members.manage_permissions"] = pj?.team?.manage ?? false;
  flat["members.suspend"] = pj?.team?.suspend ?? pj?.team?.manage ?? false;
  // Security
  flat["security.view_audit_logs"] = pj?.audit_logs?.read ?? false;
  flat["integrations.manage_api_keys"] = pj?.integrations?.manage ?? false;
  // Reservations
  flat["reservations.view"] = pj?.reservations?.view ?? false;
  flat["reservations.create"] = pj?.reservations?.create ?? false;
  flat["reservations.manage"] = pj?.reservations?.manage ?? false;
  // Garatech
  flat["garatech.view"] = pj?.garatech?.view ?? false;
  flat["garatech.create"] = pj?.garatech?.create ?? pj?.garatech?.manage ?? false;
  flat["garatech.update"] = pj?.garatech?.update ?? pj?.garatech?.manage ?? false;
  flat["garatech.change_status"] = pj?.garatech?.change_status ?? pj?.garatech?.manage ?? false;
  flat["garatech.edit_dates"] = pj?.garatech?.edit_dates ?? false;
  flat["garatech.manage_catalog"] = pj?.garatech?.manage_catalog ?? pj?.garatech?.manage ?? false;
  flat["garatech.manage_accidents"] = pj?.garatech?.manage_accidents ?? pj?.garatech?.manage ?? false;
  flat["garatech.manage"] = pj?.garatech?.manage ?? false;
  // Transfers
  flat["transfers.view"] = pj?.transfers?.view ?? false;
  flat["transfers.create"] = pj?.transfers?.create ?? pj?.transfers?.manage ?? false;
  flat["transfers.update"] = pj?.transfers?.update ?? pj?.transfers?.manage ?? false;
  flat["transfers.change_status"] = pj?.transfers?.change_status ?? pj?.transfers?.manage ?? false;
  flat["transfers.delete"] = pj?.transfers?.delete ?? false;
  flat["transfers.manage_brokers"] = pj?.transfers?.manage_brokers ?? pj?.transfers?.manage ?? false;
  flat["transfers.manage"] = pj?.transfers?.manage ?? false;
  // Forms
  flat["forms.view"] = pj?.forms?.view ?? false;
  flat["forms.create"] = pj?.forms?.create ?? false;
  flat["forms.update"] = pj?.forms?.update ?? pj?.forms?.manage ?? false;
  flat["forms.delete"] = pj?.forms?.delete ?? pj?.forms?.manage ?? false;
  flat["forms.view_responses"] = pj?.forms?.view_responses ?? pj?.forms?.view ?? false;
  flat["forms.manage"] = pj?.forms?.manage ?? false;
  // Vehicles
  flat["vehicles.view"] = pj?.vehicles?.view ?? false;
  flat["vehicles.create"] = pj?.vehicles?.create ?? pj?.vehicles?.manage ?? false;
  flat["vehicles.update"] = pj?.vehicles?.update ?? pj?.vehicles?.manage ?? false;
  flat["vehicles.archive"] = pj?.vehicles?.archive ?? pj?.vehicles?.manage ?? false;
  flat["vehicles.manage_daily_tasks"] = pj?.vehicles?.manage_daily_tasks ?? pj?.vehicles?.manage ?? false;
  flat["vehicles.change_status"] = pj?.vehicles?.change_status ?? false;
  flat["vehicles.complete_tasks"] = pj?.vehicles?.complete_tasks ?? false;
  flat["vehicles.manage_locations"] = pj?.vehicles?.manage_locations ?? pj?.vehicles?.manage ?? false;
  flat["vehicles.sync"] = pj?.vehicles?.sync ?? pj?.vehicles?.manage ?? false;
  flat["vehicles.import"] = pj?.vehicles?.import ?? pj?.vehicles?.manage ?? false;
  flat["vehicles.manage"] = pj?.vehicles?.manage ?? false;
  // Time Tracking
  flat["time_tracking.view"] = pj?.time_tracking?.view ?? false;
  flat["time_tracking.view_team"] = pj?.time_tracking?.view_team ?? pj?.time_tracking?.manage ?? false;
  flat["time_tracking.create"] = pj?.time_tracking?.create ?? pj?.time_tracking?.view ?? false;
  flat["time_tracking.manage"] = pj?.time_tracking?.manage ?? false;
  // Movements
  flat["movements.view"] = pj?.movements?.view ?? false;
  flat["movements.create"] = pj?.movements?.create ?? false;
  flat["movements.manage"] = pj?.movements?.manage ?? false;
  flat["movements.delete"] = pj?.movements?.delete ?? pj?.movements?.manage ?? false;
  flat["movements.edit_photos"] = pj?.movements?.edit_photos ?? pj?.movements?.manage ?? false;
  flat["movements.upload_receipt"] = pj?.movements?.upload_receipt ?? pj?.movements?.manage ?? false;
  // Daily Tasks
  flat["daily_tasks.view"] = pj?.daily_tasks?.view ?? false;
  flat["daily_tasks.view_other_days"] = pj?.daily_tasks?.view_other_days ?? pj?.daily_tasks?.manage ?? false;
  flat["daily_tasks.complete"] = pj?.daily_tasks?.complete ?? false;
  flat["daily_tasks.manage"] = pj?.daily_tasks?.manage ?? false;
  // Fleet
  flat["fleet.view"] = pj?.fleet?.view ?? false;
  flat["fleet.manage"] = pj?.fleet?.manage ?? false;
  flat["fleet.import"] = pj?.fleet?.import ?? pj?.fleet?.manage ?? false;
  flat["fleet.gps"] = pj?.fleet?.gps ?? false;
  // Schedules (Horarios)
  flat["schedules.view"] = pj?.schedules?.view ?? false;
  flat["schedules.assign"] = pj?.schedules?.assign ?? pj?.schedules?.manage ?? false;
  flat["schedules.manage_templates"] = pj?.schedules?.manage_templates ?? pj?.schedules?.manage ?? false;
  flat["schedules.view_directiva"] = pj?.schedules?.view_directiva ?? pj?.schedules?.manage ?? false;
  flat["schedules.manage_notes"] = pj?.schedules?.manage_notes ?? pj?.schedules?.manage ?? false;
  flat["schedules.manage"] = pj?.schedules?.manage ?? false;
  // Preparation (Lista de preparación)
  flat["preparation.view"] = pj?.preparation?.view ?? false;
  flat["preparation.start"] = pj?.preparation?.start ?? pj?.preparation?.manage ?? false;
  flat["preparation.complete_tasks"] = pj?.preparation?.complete_tasks ?? pj?.preparation?.manage ?? false;
  flat["preparation.view_progress"] = pj?.preparation?.view_progress ?? pj?.preparation?.manage ?? false;
  flat["preparation.manage"] = pj?.preparation?.manage ?? false;
  // Lost & Found (Objetos Perdidos)
  flat["lost_found.view"] = pj?.lost_found?.view ?? false;
  flat["lost_found.create"] = pj?.lost_found?.create ?? pj?.lost_found?.manage ?? false;
  flat["lost_found.update"] = pj?.lost_found?.update ?? pj?.lost_found?.manage ?? false;
  flat["lost_found.manage"] = pj?.lost_found?.manage ?? false;
  // Rently (Bidirectional Sync)
  flat["rently.booking_confirm"] = pj?.rently?.booking_confirm ?? pj?.rently?.manage ?? false;
  flat["rently.booking_cancel"] = pj?.rently?.booking_cancel ?? pj?.rently?.manage ?? false;
  flat["rently.booking_uncancel"] = pj?.rently?.booking_uncancel ?? pj?.rently?.manage ?? false;
  flat["rently.booking_update"] = pj?.rently?.booking_update ?? pj?.rently?.manage ?? false;
  flat["rently.booking_create"] = pj?.rently?.booking_create ?? pj?.rently?.manage ?? false;
  flat["rently.operations_delivery"] = pj?.rently?.operations_delivery ?? pj?.rently?.manage ?? false;
  flat["rently.operations_return"] = pj?.rently?.operations_return ?? pj?.rently?.manage ?? false;
  flat["rently.customer_manage"] = pj?.rently?.customer_manage ?? pj?.rently?.manage ?? false;
  flat["rently.cars_relocate"] = pj?.rently?.cars_relocate ?? pj?.rently?.manage ?? false;
  flat["rently.manage"] = pj?.rently?.manage ?? false;

  return flat;
}
