// Phase 30: Enterprise Light Types

export interface AuditLog {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata_json: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Joined data
  actor?: {
    id: string;
    name: string | null;
  };
}

export interface CustomRole {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  permissions_json: RolePermissions;
  is_system: boolean;
  created_at: string;
}

export interface RolePermissions {
  tasks: { view: boolean; read: boolean; create: boolean; update: boolean; delete: boolean; change_status: boolean; manage_columns: boolean };
  areas: { view: boolean; read: boolean; manage: boolean; manage_access_rules: boolean };
  tags: { view: boolean; read: boolean; create: boolean; update: boolean; delete: boolean; manage: boolean };
  automations: { read: boolean; view: boolean; create: boolean; manage: boolean };
  integrations: { read: boolean; manage: boolean };
  billing: { read: boolean; view: boolean; manage: boolean };
  audit_logs: { read: boolean };
  templates: { view: boolean; read: boolean; manage: boolean; delete: boolean };
  team: { view: boolean; read: boolean; manage: boolean; suspend: boolean };
  // Phase 37+: Visibility-controlled modules
  reports: { view: boolean; export: boolean; view_financial: boolean };
  reservations: { view: boolean; create: boolean; manage: boolean };
  // Garatech module permissions
  garatech: { view: boolean; create: boolean; update: boolean; change_status: boolean; edit_dates: boolean; manage_catalog: boolean; manage_accidents: boolean; manage: boolean };
  // Transfers
  transfers: { view: boolean; create: boolean; update: boolean; change_status: boolean; delete: boolean; manage_pricing: boolean; manage_brokers: boolean; manage: boolean };
  // Forms
  forms: { view: boolean; create: boolean; update: boolean; delete: boolean; view_responses: boolean; manage: boolean };
  // Vehicles
  vehicles: { view: boolean; create: boolean; update: boolean; archive: boolean; manage_daily_tasks: boolean; change_status: boolean; complete_tasks: boolean; manage_locations: boolean; sync: boolean; import: boolean; manage: boolean };
  // Time Tracking
  time_tracking: { view: boolean; view_team: boolean; create: boolean; manage: boolean };
  // Fleet Backup
  fleet: { view: boolean; manage: boolean; import: boolean };
}

export interface UserRoleAssignment {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  created_at: string;
  // Joined data
  role?: CustomRole;
  user?: {
    id: string;
    name: string | null;
  };
}

export interface OrgSecuritySettings {
  id: string;
  organization_id: string;
  allowed_domains: string[] | null;
  require_sso: boolean;
  session_timeout_minutes: number;
  audit_retention_days: number;
  mfa_required: boolean;
  ip_allowlist: string[] | null;
  block_public_sharing: boolean;
  block_exports: boolean;
  block_api_keys: boolean;
  block_webhooks: boolean;
  created_at: string;
}

// ============= Phase 36: Enterprise Integrations =============

// SAML Connection
export interface SAMLConnection {
  id: string;
  organization_id: string;
  name: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_x509_cert: string;
  sp_entity_id: string;
  acs_url: string;
  email_attribute: string;
  first_name_attribute: string | null;
  last_name_attribute: string | null;
  is_active: boolean;
  last_tested_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SAMLConnectionInput {
  name: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_x509_cert: string;
  email_attribute?: string;
  first_name_attribute?: string;
  last_name_attribute?: string;
}

// SCIM Token
export interface SCIMToken {
  id: string;
  organization_id: string;
  name: string;
  token_hash: string;
  last_used_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// SCIM Identity
export interface SCIMIdentity {
  id: string;
  organization_id: string;
  user_id: string;
  scim_external_id: string;
  scim_user_name: string;
  is_active: boolean;
  created_at: string;
}

// SCIM Group
export interface SCIMGroup {
  id: string;
  organization_id: string;
  scim_group_external_id: string;
  display_name: string;
  created_at: string;
}

// SCIM Group Membership
export interface SCIMGroupMembership {
  id: string;
  organization_id: string;
  scim_group_id: string;
  user_id: string;
  created_at: string;
}

// SCIM Group Mapping
export interface SCIMGroupMapping {
  id: string;
  organization_id: string;
  scim_group_id: string;
  map_to_type: 'role' | 'team';
  map_to_id: string;
  priority: number;
  created_at: string;
}

// Provisioning Log
export interface ProvisioningLog {
  id: string;
  organization_id: string;
  source: 'saml' | 'scim';
  action: string;
  external_id: string | null;
  user_id: string | null;
  status: 'success' | 'failed';
  message: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

// IT Admin Console Status
export interface EnterpriseStatus {
  saml: {
    configured: boolean;
    active: boolean;
    lastTested: string | null;
    connectionName: string | null;
  };
  scim: {
    configured: boolean;
    active: boolean;
    lastUsed: string | null;
    tokenCount: number;
  };
  policies: {
    requireSso: boolean;
    allowedDomains: string[];
    ipAllowlist: string[];
    blockPublicSharing: boolean;
    blockExports: boolean;
    blockApiKeys: boolean;
    blockWebhooks: boolean;
  };
}

// Provisioning Log Filters
export interface ProvisioningLogFilters {
  source?: 'saml' | 'scim';
  status?: 'success' | 'failed';
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export interface UserSession {
  id: string;
  user_id: string;
  organization_id: string;
  session_token: string;
  created_at: string;
  last_seen_at: string;
  ip_address: string | null;
  user_agent: string | null;
  device_name: string | null;
  is_active: boolean;
}

// Audit log action types
export const AUDIT_ACTIONS = {
  // Tasks
  TASK_CREATE: 'task.create',
  TASK_UPDATE: 'task.update',
  TASK_DELETE: 'task.delete',
  TASK_STATUS_CHANGE: 'task.status_change',
  TASK_ASSIGN: 'task.assign',
  
  // Areas
  AREA_CREATE: 'area.create',
  AREA_UPDATE: 'area.update',
  AREA_DELETE: 'area.delete',
  
  // Tags
  TAG_CREATE: 'tag.create',
  TAG_UPDATE: 'tag.update',
  TAG_DELETE: 'tag.delete',
  
  // Automations
  AUTOMATION_CREATE: 'automation.create',
  AUTOMATION_UPDATE: 'automation.update',
  AUTOMATION_DELETE: 'automation.delete',
  AUTOMATION_TOGGLE: 'automation.toggle',
  AUTOMATION_RUN: 'automation.run',
  
  // Integrations
  INTEGRATION_UPDATE_SLACK: 'integration.update_slack',
  INTEGRATION_UPDATE_WHATSAPP: 'integration.update_whatsapp',
  
  // Billing
  BILLING_PLAN_CHANGE: 'billing.plan_change',
  BILLING_CANCEL: 'billing.cancel',
  BILLING_PAYMENT_FAILED: 'billing.payment_failed',
  
  // Templates
  TEMPLATE_APPLY: 'template.apply',
  TEMPLATE_CREATE: 'template.create',
  TEMPLATE_PUBLISH: 'template.publish',
  TEMPLATE_IMPORT: 'template.import',
  TEMPLATE_EXPORT: 'template.export',
  
  // Security
  SECURITY_UPDATE_SETTINGS: 'security.update_settings',
  SECURITY_SESSION_REVOKED: 'security.session_revoked',
  SECURITY_LOGOUT_ALL: 'security.logout_all',
  
  // Auth
  AUTH_SSO_LOGIN: 'auth.sso_login',
  AUTH_LOGIN_FAILED_DOMAIN: 'auth.login_failed_domain_not_allowed',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  
  // Team
  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_ROLE_CHANGE: 'member.role_change',
  
  // Organization
  ORG_DELETE_REQUESTED: 'org.delete_requested',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'task.create': 'Tarea creada',
  'task.update': 'Tarea actualizada',
  'task.delete': 'Tarea eliminada',
  'task.status_change': 'Estado cambiado',
  'task.assign': 'Tarea asignada',
  'area.create': 'Área creada',
  'area.update': 'Área actualizada',
  'area.delete': 'Área eliminada',
  'tag.create': 'Etiqueta creada',
  'tag.update': 'Etiqueta actualizada',
  'tag.delete': 'Etiqueta eliminada',
  'automation.create': 'Automatización creada',
  'automation.update': 'Automatización actualizada',
  'automation.delete': 'Automatización eliminada',
  'automation.toggle': 'Automatización activada/desactivada',
  'automation.run': 'Automatización ejecutada',
  'integration.update_slack': 'Slack configurado',
  'integration.update_whatsapp': 'WhatsApp configurado',
  'billing.plan_change': 'Plan cambiado',
  'billing.cancel': 'Suscripción cancelada',
  'billing.payment_failed': 'Pago fallido',
  'template.apply': 'Plantilla aplicada',
  'template.create': 'Plantilla creada',
  'template.publish': 'Plantilla publicada',
  'template.import': 'Plantilla importada',
  'template.export': 'Plantilla exportada',
  'security.update_settings': 'Configuración de seguridad actualizada',
  'security.session_revoked': 'Sesión revocada',
  'security.logout_all': 'Cerrar todas las sesiones',
  'auth.sso_login': 'Inicio de sesión SSO',
  'auth.login_failed_domain_not_allowed': 'Login fallido - dominio no permitido',
  'auth.login': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'member.invite': 'Miembro invitado',
  'member.remove': 'Miembro eliminado',
  'member.role_change': 'Rol cambiado',
  'org.delete_requested': 'Eliminación de organización solicitada',
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  task: 'Tarea',
  area: 'Área',
  tag: 'Etiqueta',
  automation_rule: 'Automatización',
  integration: 'Integración',
  subscription: 'Suscripción',
  template: 'Plantilla',
  user_template: 'Plantilla de usuario',
  security: 'Seguridad',
  session: 'Sesión',
  member: 'Miembro',
  organization: 'Organización',
};

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  tasks: { view: true, read: true, create: true, update: true, delete: false, change_status: true, manage_columns: false },
  areas: { view: true, read: true, manage: false, manage_access_rules: false },
  tags: { view: true, read: true, create: false, update: false, delete: false, manage: false },
  automations: { read: false, view: false, create: false, manage: false },
  integrations: { read: false, manage: false },
  billing: { read: false, view: false, manage: false },
  audit_logs: { read: false },
  templates: { view: true, read: true, manage: false, delete: false },
  team: { view: false, read: false, manage: false, suspend: false },
  reports: { view: false, export: false, view_financial: false },
  reservations: { view: false, create: false, manage: false },
  garatech: { view: true, create: false, update: false, change_status: false, edit_dates: false, manage_catalog: false, manage_accidents: false, manage: false },
  transfers: { view: false, create: false, update: false, change_status: false, delete: false, manage_pricing: false, manage_brokers: false, manage: false },
  forms: { view: true, create: false, update: false, delete: false, view_responses: false, manage: false },
  vehicles: { view: true, create: false, update: false, archive: false, manage_daily_tasks: false, change_status: true, complete_tasks: true, manage_locations: false, sync: false, import: false, manage: false },
  time_tracking: { view: true, view_team: false, create: false, manage: false },
  fleet: { view: true, manage: false, import: false },
};

export const PERMISSION_LABELS: Record<string, Record<string, string>> = {
  tasks: {
    view: 'Ver tareas',
    read: 'Ver tareas',
    create: 'Crear tareas',
    update: 'Editar tareas',
    delete: 'Eliminar tareas',
    change_status: 'Cambiar estado',
    manage_columns: 'Gestionar columnas',
  },
  areas: {
    view: 'Ver áreas',
    read: 'Ver áreas',
    manage: 'Gestionar áreas',
    manage_access_rules: 'Gestionar reglas de acceso',
  },
  tags: {
    view: 'Ver etiquetas',
    read: 'Ver etiquetas',
    create: 'Crear etiquetas',
    update: 'Editar etiquetas',
    delete: 'Eliminar etiquetas',
    manage: 'Gestionar etiquetas',
  },
  automations: {
    read: 'Ver automatizaciones',
    view: 'Ver reglas',
    create: 'Crear automatizaciones',
    manage: 'Gestionar automatizaciones',
  },
  integrations: {
    read: 'Ver integraciones',
    manage: 'Gestionar integraciones',
  },
  billing: {
    read: 'Ver facturación',
    view: 'Ver suscripción',
    manage: 'Gestionar facturación',
  },
  audit_logs: {
    read: 'Ver registros de auditoría',
  },
  templates: {
    view: 'Ver plantillas',
    read: 'Ver plantillas',
    manage: 'Gestionar plantillas',
    delete: 'Eliminar plantillas',
  },
  team: {
    view: 'Ver equipos',
    read: 'Ver equipo',
    manage: 'Gestionar equipo',
    suspend: 'Suspender miembros',
  },
  reports: {
    view: 'Ver reportes',
    export: 'Exportar reportes',
    view_financial: 'Ver datos financieros',
  },
  reservations: {
    view: 'Ver reservas',
    create: 'Crear reservas',
    manage: 'Gestionar reservas',
  },
  garatech: {
    view: 'Ver módulo Garatech',
    create: 'Crear reparaciones',
    update: 'Editar reparaciones',
    change_status: 'Cambiar estado',
    edit_dates: 'Editar fechas',
    manage_catalog: 'Gestionar catálogo',
    manage_accidents: 'Gestionar siniestros',
    manage: 'Gestionar todo',
  },
  transfers: {
    view: 'Ver transfers',
    create: 'Crear transfers',
    update: 'Editar transfers',
    change_status: 'Cambiar estado',
    delete: 'Eliminar transfers',
    manage_pricing: 'Gestionar precios',
    manage_brokers: 'Gestionar brokers',
    manage: 'Gestionar todo',
  },
  forms: {
    view: 'Ver formularios',
    create: 'Crear formularios',
    update: 'Editar formularios',
    delete: 'Eliminar formularios',
    view_responses: 'Ver respuestas',
    manage: 'Gestionar todo',
  },
  vehicles: {
    view: 'Ver vehículos',
    create: 'Crear vehículos',
    update: 'Editar vehículos',
    archive: 'Archivar vehículos',
    manage_daily_tasks: 'Gestionar tareas diarias',
    change_status: 'Cambiar estado',
    complete_tasks: 'Completar tareas limpieza',
    manage_locations: 'Gestionar ubicaciones',
    sync: 'Sincronizar flota',
    import: 'Importar vehículos',
    manage: 'Gestionar todo',
  },
  time_tracking: {
    view: 'Ver seguimiento de tiempo',
    view_team: 'Ver fichajes del equipo',
    create: 'Registrar fichajes',
    manage: 'Gestionar fichajes',
  },
  fleet: {
    view: 'Ver flota',
    manage: 'Gestionar flota e inspecciones',
    import: 'Importar flota desde Excel',
  },
};
