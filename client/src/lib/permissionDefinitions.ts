import {
  ListTodo,
  FolderOpen,
  Tag,
  FileText,
  ArrowLeftRight,
  Wrench,
  Car,
  CalendarDays,
  Clock,
  BarChart3,
  Layout,
  Zap,
  Users,
  CreditCard,
  Shield,
  Route,
  ClipboardCheck,
  Truck,
  Camera,
  Receipt,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '@/hooks/usePermissions';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  permissions: PermissionDefinition[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'tasks',
    label: 'Tareas',
    icon: ListTodo,
    permissions: [
      { key: 'tasks.view', label: 'Ver tareas', description: 'Permite ver el módulo de tareas y acceder a lista, kanban y calendario' },
      { key: 'tasks.create', label: 'Crear tareas', description: 'Permite crear nuevas tareas en cualquier área visible' },
      { key: 'tasks.update', label: 'Editar tareas', description: 'Permite modificar título, descripción y campos de tareas' },
      { key: 'tasks.delete', label: 'Eliminar tareas', description: 'Permite eliminar tareas de forma permanente' },
      { key: 'tasks.assign', label: 'Asignar tareas', description: 'Permite asignar o reasignar tareas a otros miembros' },
      { key: 'tasks.change_status', label: 'Cambiar estado', description: 'Permite cambiar el estado de tareas y moverlas en el kanban' },
      { key: 'tasks.manage_columns', label: 'Gestionar columnas', description: 'Permite crear, editar y eliminar columnas del kanban' },
    ],
  },
  {
    id: 'areas',
    label: 'Áreas',
    icon: FolderOpen,
    permissions: [
      { key: 'areas.view', label: 'Ver áreas', description: 'Permite ver el módulo de áreas de trabajo' },
      { key: 'areas.create', label: 'Crear áreas', description: 'Permite crear nuevas áreas de trabajo' },
      { key: 'areas.update', label: 'Editar áreas', description: 'Permite modificar nombre, color e icono de áreas' },
      { key: 'areas.delete', label: 'Eliminar áreas', description: 'Permite eliminar áreas y mover sus tareas' },
      { key: 'areas.manage_visibility', label: 'Gestionar visibilidad', description: 'Permite cambiar la visibilidad de áreas (pública/privada/admins)' },
      { key: 'areas.manage_access_rules', label: 'Gestionar reglas de acceso', description: 'Permite configurar quién puede ver áreas con visibilidad personalizada' },
    ],
  },
  {
    id: 'tags',
    label: 'Etiquetas',
    icon: Tag,
    permissions: [
      { key: 'tags.view', label: 'Ver etiquetas', description: 'Permite ver el módulo de etiquetas' },
      { key: 'tags.create', label: 'Crear etiquetas', description: 'Permite crear nuevas etiquetas para clasificar tareas' },
      { key: 'tags.update', label: 'Editar etiquetas', description: 'Permite renombrar y cambiar el color de etiquetas existentes' },
      { key: 'tags.delete', label: 'Eliminar etiquetas', description: 'Permite eliminar etiquetas de forma permanente' },
      { key: 'tags.manage', label: 'Gestionar todo (Etiquetas)', description: 'Acceso completo para gestionar etiquetas' },
    ],
  },
  {
    id: 'forms',
    label: 'Formularios',
    icon: FileText,
    permissions: [
      { key: 'forms.view', label: 'Ver formularios', description: 'Permite ver el listado de formularios existentes' },
      { key: 'forms.create', label: 'Crear formularios', description: 'Permite crear nuevos formularios públicos o internos' },
      { key: 'forms.update', label: 'Editar formularios', description: 'Permite modificar formularios existentes (campos, configuración)' },
      { key: 'forms.delete', label: 'Eliminar formularios', description: 'Permite eliminar formularios de forma permanente' },
      { key: 'forms.view_responses', label: 'Ver respuestas', description: 'Permite ver las respuestas enviadas a formularios' },
      { key: 'forms.manage', label: 'Gestionar todo (Formularios)', description: 'Acceso completo para gestionar formularios' },
    ],
  },
  {
    id: 'transfers',
    label: 'Transfers',
    icon: ArrowLeftRight,
    permissions: [
      { key: 'transfers.view', label: 'Ver transfers', description: 'Permite ver el listado y detalles de transfers' },
      { key: 'transfers.create', label: 'Crear transfers', description: 'Permite crear nuevas solicitudes de transfer' },
      { key: 'transfers.update', label: 'Editar transfers', description: 'Permite modificar datos de solicitudes existentes' },
      { key: 'transfers.change_status', label: 'Cambiar estado', description: 'Permite cambiar el estado de transfers (confirmado, completado, etc.)' },
      { key: 'transfers.delete', label: 'Eliminar transfers', description: 'Permite eliminar transfers de forma permanente' },
      { key: 'transfers.manage_pricing', label: 'Gestionar precios', description: 'Permite editar precios y tarifas de items de transfer' },
      { key: 'transfers.manage_brokers', label: 'Gestionar brokers', description: 'Permite gestionar brokers y proveedores de transfers' },
      { key: 'transfers.manage', label: 'Gestionar todo (Transfers)', description: 'Acceso completo para gestionar transfers' },
    ],
  },
  {
    id: 'garatech',
    label: 'Garatech (Taller)',
    icon: Wrench,
    permissions: [
      { key: 'garatech.view', label: 'Ver módulo Garatech', description: 'Permite acceder al módulo de taller y ver reparaciones' },
      { key: 'garatech.create', label: 'Crear reparaciones', description: 'Permite crear nuevas reparaciones en el taller' },
      { key: 'garatech.update', label: 'Editar reparaciones', description: 'Permite modificar datos de reparaciones existentes' },
      { key: 'garatech.change_status', label: 'Cambiar estado', description: 'Permite cambiar el estado de reparaciones (pendiente, en curso, finalizado)' },
      { key: 'garatech.edit_dates', label: 'Editar fechas', description: 'Permite modificar fechas de entrada y salida de reparaciones' },
      { key: 'garatech.manage_catalog', label: 'Gestionar catálogo', description: 'Permite gestionar el catálogo de daños y talleres' },
      { key: 'garatech.manage_accidents', label: 'Gestionar siniestros', description: 'Permite crear, editar y gestionar siniestros' },
      { key: 'garatech.manage', label: 'Gestionar todo (Garatech)', description: 'Acceso completo para gestionar todos los aspectos del taller' },
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehículos',
    icon: Car,
    permissions: [
      { key: 'vehicles.view', label: 'Ver vehículos', description: 'Permite ver el listado y detalles de vehículos' },
      { key: 'vehicles.create', label: 'Crear vehículos', description: 'Permite dar de alta nuevos vehículos en la flota' },
      { key: 'vehicles.update', label: 'Editar vehículos', description: 'Permite modificar datos de vehículos existentes' },
      { key: 'vehicles.archive', label: 'Archivar vehículos', description: 'Permite archivar y desarchivar vehículos de la flota' },
      { key: 'vehicles.manage_daily_tasks', label: 'Gestionar tareas diarias', description: 'Permite gestionar el checklist de tareas diarias de vehículos' },
      { key: 'vehicles.change_status', label: 'Cambiar estado', description: 'Permite mover vehículos entre columnas del kanban (drag-and-drop)' },
      { key: 'vehicles.complete_tasks', label: 'Completar tareas limpieza', description: 'Permite marcar/desmarcar tareas del checklist de limpieza' },
      { key: 'vehicles.manage_locations', label: 'Gestionar ubicaciones', description: 'Permite crear, editar y eliminar ubicaciones de flota' },
      { key: 'vehicles.sync', label: 'Sincronizar flota', description: 'Permite sincronizar vehículos desde las reservas' },
      { key: 'vehicles.import', label: 'Importar vehículos', description: 'Permite importar vehículos desde archivos Excel' },
      { key: 'vehicles.manage', label: 'Gestionar todo (Vehículos)', description: 'Acceso completo para gestionar vehículos' },
    ],
  },
  {
    id: 'reservations',
    label: 'Reservas',
    icon: CalendarDays,
    permissions: [
      { key: 'reservations.view', label: 'Ver reservas', description: 'Permite acceder al módulo de reservas y ver el calendario' },
      { key: 'reservations.create', label: 'Crear reservas', description: 'Permite crear nuevas reservas en el calendario' },
      { key: 'reservations.manage', label: 'Gestionar reservas', description: 'Permite editar y cancelar reservas existentes' },
    ],
  },
  {
    id: 'time_tracking',
    label: 'Control horario',
    icon: Clock,
    permissions: [
      { key: 'time_tracking.view', label: 'Ver control horario', description: 'Permite ver los registros de fichajes propios' },
      { key: 'time_tracking.view_team', label: 'Ver fichajes del equipo', description: 'Permite ver los registros de fichajes de otros miembros' },
      { key: 'time_tracking.create', label: 'Registrar fichajes', description: 'Permite registrar fichajes de entrada y salida manualmente' },
      { key: 'time_tracking.manage', label: 'Gestionar fichajes', description: 'Permite editar y corregir fichajes de otros miembros' },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes',
    icon: BarChart3,
    permissions: [
      { key: 'reports.view', label: 'Ver reportes', description: 'Permite acceder a informes y estadísticas de la organización' },
      { key: 'reports.export', label: 'Exportar reportes', description: 'Permite exportar reportes a Excel o PDF' },
      { key: 'reports.view_financial', label: 'Ver datos financieros', description: 'Permite ver datos financieros y económicos en reportes' },
    ],
  },
  {
    id: 'templates',
    label: 'Plantillas',
    icon: Layout,
    permissions: [
      { key: 'templates.view', label: 'Ver plantillas', description: 'Permite ver el módulo de plantillas' },
      { key: 'templates.apply', label: 'Aplicar plantillas', description: 'Permite aplicar plantillas existentes para crear tareas' },
      { key: 'templates.create', label: 'Crear plantillas', description: 'Permite crear y publicar nuevas plantillas' },
      { key: 'templates.delete', label: 'Eliminar plantillas', description: 'Permite eliminar plantillas publicadas' },
    ],
  },
  {
    id: 'automations',
    label: 'Automatizaciones',
    icon: Zap,
    permissions: [
      { key: 'automations.view', label: 'Ver automatizaciones', description: 'Permite ver las reglas de automatización existentes' },
      { key: 'automations.create', label: 'Crear automatizaciones', description: 'Permite crear nuevas reglas de automatización' },
      { key: 'automations.manage', label: 'Gestionar automatizaciones', description: 'Permite editar y eliminar reglas de automatización' },
    ],
  },
  {
    id: 'members',
    label: 'Miembros',
    icon: Users,
    permissions: [
      { key: 'teams.view', label: 'Ver equipos', description: 'Permite ver el módulo de equipos en el sidebar' },
      { key: 'members.view', label: 'Ver miembros', description: 'Permite ver el listado de miembros de la organización' },
      { key: 'members.invite', label: 'Invitar miembros', description: 'Permite enviar invitaciones a nuevos miembros' },
      { key: 'members.change_role', label: 'Cambiar roles', description: 'Permite cambiar el rol asignado a un miembro' },
      { key: 'members.manage_permissions', label: 'Gestionar permisos', description: 'Permite configurar permisos individuales (overrides)' },
      { key: 'members.suspend', label: 'Suspender miembros', description: 'Permite suspender y reactivar miembros de la organización' },
    ],
  },
  {
    id: 'billing',
    label: 'Facturación',
    icon: CreditCard,
    permissions: [
      { key: 'billing.view', label: 'Ver facturación', description: 'Permite ver información de suscripción y pagos (solo lectura)' },
      { key: 'billing.manage', label: 'Gestionar facturación', description: 'Permite gestionar la suscripción y métodos de pago' },
    ],
  },
  {
    id: 'movements',
    label: 'Movimientos',
    icon: Route,
    permissions: [
      { key: 'movements.view', label: 'Ver movimientos', description: 'Permite ver el listado de movimientos de vehículos' },
      { key: 'movements.create', label: 'Crear movimientos', description: 'Permite registrar entregas, recogidas y movimientos' },
      { key: 'movements.manage', label: 'Gestionar movimientos', description: 'Permite editar y cancelar movimientos existentes' },
      { key: 'movements.delete', label: 'Eliminar movimientos', description: 'Permite eliminar movimientos de forma permanente' },
      { key: 'movements.edit_photos', label: 'Editar fotos', description: 'Permite añadir, editar y eliminar fotos de movimientos' },
      { key: 'movements.upload_receipt', label: 'Subir justificantes', description: 'Permite subir recibos y justificantes a movimientos' },
    ],
  },
  {
    id: 'daily_tasks',
    label: 'Tareas diarias',
    icon: ClipboardCheck,
    permissions: [
      { key: 'daily_tasks.view', label: 'Ver tareas diarias', description: 'Permite ver las tareas diarias asignadas' },
      { key: 'daily_tasks.view_other_days', label: 'Ver otros días', description: 'Permite ver tareas de días anteriores y futuros' },
      { key: 'daily_tasks.complete', label: 'Completar tareas', description: 'Permite marcar tareas diarias como completadas' },
      { key: 'daily_tasks.manage', label: 'Gestionar tareas diarias', description: 'Permite crear, editar y eliminar tareas diarias' },
    ],
  },
  {
    id: 'fleet',
    label: 'Flota e inspecciones',
    icon: Truck,
    permissions: [
      { key: 'fleet.view', label: 'Ver flota', description: 'Permite ver el listado de vehículos e inspecciones' },
      { key: 'fleet.manage', label: 'Gestionar flota', description: 'Permite gestionar inspecciones y datos de flota' },
      { key: 'fleet.import', label: 'Importar flota', description: 'Permite importar vehículos desde archivos Excel' },
    ],
  },
  {
    id: 'schedules',
    label: 'Horarios',
    icon: CalendarClock,
    permissions: [
      { key: 'schedules.view', label: 'Ver horarios', description: 'Permite ver la cuadrícula semanal de turnos del equipo' },
      { key: 'schedules.assign', label: 'Asignar turnos', description: 'Permite asignar y quitar turnos a empleados en la cuadrícula' },
      { key: 'schedules.manage_templates', label: 'Gestionar plantillas de turno', description: 'Permite crear, editar y eliminar plantillas de turno (horarios tipo)' },
      { key: 'schedules.view_directiva', label: 'Ver horarios de Directiva', description: 'Permite ver los turnos del equipo Directiva (si está desactivado, el equipo Directiva queda oculto)' },
      { key: 'schedules.manage_notes', label: 'Gestionar notas de horarios', description: 'Permite crear, ver y eliminar notas internas en la cuadrícula de horarios' },
      { key: 'schedules.manage', label: 'Gestionar todo (Horarios)', description: 'Acceso completo: copiar semanas, gestionar plantillas y asignar turnos' },
    ],
  },
  {
    id: 'security',
    label: 'Seguridad',
    icon: Shield,
    permissions: [
      { key: 'security.view_audit_logs', label: 'Ver logs de auditoría', description: 'Permite acceder al registro de actividad de la organización' },
      { key: 'integrations.manage_api_keys', label: 'Gestionar API keys', description: 'Permite crear y revocar claves de API para integraciones' },
    ],
  },
];

// Helper: get flat label map for quick lookups
export function getPermissionLabel(key: string): string {
  for (const cat of PERMISSION_CATEGORIES) {
    const perm = cat.permissions.find(p => p.key === key);
    if (perm) return perm.label;
  }
  return key;
}

// Helper: get flat description map
export function getPermissionDescription(key: string): string {
  for (const cat of PERMISSION_CATEGORIES) {
    const perm = cat.permissions.find(p => p.key === key);
    if (perm) return perm.description;
  }
  return '';
}

// Helper: all permission keys as flat array
export function getAllPermissionKeys(): PermissionKey[] {
  return PERMISSION_CATEGORIES.flatMap(cat => cat.permissions.map(p => p.key));
}
