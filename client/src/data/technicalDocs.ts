export interface DocSubsection {
  id: string;
  title: string;
  icon?: string;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  readTime?: number;
  tags?: string[];
  content: string;
}

export interface DocSection {
  id: string;
  title: string;
  icon: string;
  description?: string;
  subsections: DocSubsection[];
}

export const technicalDocs: DocSection[] = [
  {
    id: 'architecture',
    title: 'Arquitectura',
    icon: 'Boxes',
    description: 'Stack tecnológico, estructura de carpetas y patrones de diseño',
    subsections: [
      {
        id: 'stack',
        title: 'Stack Tecnológico',
        icon: 'Layers',
        difficulty: 'basic',
        readTime: 3,
        tags: ['react', 'typescript', 'supabase', 'tailwind'],
        content: `
## Stack Tecnológico

:::info
Esta sección describe las tecnologías principales utilizadas en PlanMint.
:::

### Frontend
- **React 18** con TypeScript
- **Vite** como bundler
- **TailwindCSS** para estilos
- **shadcn/ui** como librería de componentes
- **React Router v6** para navegación
- **TanStack Query (React Query)** para gestión de estado del servidor

### Backend
- **Supabase** (PostgreSQL + Auth + Edge Functions + Storage)
- **Lovable Cloud** como plataforma de hosting

:::tip
Supabase proporciona una base de datos PostgreSQL completa con Row Level Security (RLS) para multi-tenancy seguro.
:::

### Autenticación
- Supabase Auth con email/password
- Sistema de invitaciones por token
- Roles: owner, admin, manager, member, read_only

### Pagos
- **Stripe** para suscripciones y pagos
- Webhooks para sincronización de estados
        `
      },
      {
        id: 'folder-structure',
        title: 'Estructura de Carpetas',
        icon: 'FolderTree',
        difficulty: 'basic',
        readTime: 2,
        tags: ['estructura', 'carpetas', 'organización'],
        content: `
## Estructura de Carpetas

:::code
src/
├── components/     # Componentes React
│   ├── ui/         # Componentes base (shadcn)
│   ├── layout/     # AppLayout, AppSidebar, etc.
│   ├── tasks/      # Componentes de tareas
│   └── vehicles/   # Componentes de vehículos
├── contexts/       # React Contexts (Auth, Theme, Offline)
├── data/           # Datos estáticos y contenido
├── hooks/          # Custom hooks
├── integrations/   # Integraciones (Supabase client)
├── lib/            # Utilidades y helpers
├── pages/          # Páginas (una por ruta)
│   ├── auth/       # Login, Register, etc.
│   ├── public/     # Landing, Pricing, etc.
│   └── super-admin/# Panel de Super Admin
└── types/          # TypeScript types
:::

### Convenciones
- Un archivo por componente
- Hooks en carpeta hooks/ con prefijo "use"
- Types en carpeta types/ o co-ubicados
        `
      },
      {
        id: 'design-patterns',
        title: 'Patrones de Diseño',
        icon: 'Puzzle',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['patrones', 'estado', 'componentes', 'hooks'],
        content: `
## Patrones de Diseño

### Gestión de Estado
- **Local**: useState, useReducer
- **Servidor**: TanStack Query (queries + mutations)
- **Global**: React Context (Auth, Theme)

:::tip
Usa TanStack Query para todo el estado que venga del servidor. Evita duplicar datos en estado local.
:::

### Componentes
- **Composición**: Usar children y slots
- **Container/Presentational**: Separar lógica de UI
- **Compound Components**: Para UI compleja (ej: Tabs)

### Hooks Personalizados
Patrón típico de hook con query:

:::code
function useMyData() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['my-data', profile?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('my_table')
        .select('*');
      return data;
    },
    enabled: !!profile?.organization_id
  });
}
:::
        `
      }
    ]
  },
  {
    id: 'database',
    title: 'Base de Datos',
    icon: 'Database',
    description: 'Tablas, RLS policies y funciones SQL',
    subsections: [
      {
        id: 'tables',
        title: 'Tablas Principales',
        icon: 'Table',
        difficulty: 'basic',
        readTime: 3,
        tags: ['tablas', 'esquema', 'postgresql'],
        content: `
## Tablas Principales

### Núcleo
| Tabla | Descripción |
|-------|-------------|
| organizations | Organizaciones/tenants |
| profiles | Perfiles de usuario (extiende auth.users) |
| organization_members | Membresía usuario-organización con rol |

### Operativo
| Tabla | Descripción |
|-------|-------------|
| tasks | Tareas (core del sistema) |
| areas | Áreas/categorías de trabajo |
| tags | Etiquetas para clasificación |
| reminders | Recordatorios de tareas |
| subtasks | Subtareas dentro de tareas |

### Módulos Opcionales
| Tabla | Módulo |
|-------|--------|
| reservations | Reservas de vehículos |
| vehicles | Estado de flota |
| time_entries | Control de tiempo |
| forms / form_fields / form_responses | Formularios |
| teams / team_members | Equipos |

:::info
Todas las tablas incluyen organization_id para filtrado multi-tenant.
:::
        `
      },
      {
        id: 'rls',
        title: 'Row Level Security (RLS)',
        icon: 'Shield',
        difficulty: 'advanced',
        readTime: 5,
        tags: ['rls', 'seguridad', 'políticas', 'postgresql'],
        content: `
## Row Level Security

:::security
RLS es CRÍTICO para la seguridad. Todas las tablas DEBEN tener RLS habilitado.
:::

Todas las tablas tienen RLS habilitado. Patrones comunes:

### Filtro por Organización

:::code
CREATE POLICY "Users can view their org data"
ON tasks FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));
:::

### Filtro por Rol

:::code
CREATE POLICY "Admins can manage"
ON settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND organization_id = settings.organization_id
    AND role IN ('owner', 'admin')
  )
);
:::

### Funciones Helper
- \`get_user_organization_id(uuid)\`: Obtiene org_id del usuario
- \`is_super_admin()\`: Verifica si es super admin
- \`can_view_reservations(uuid, uuid)\`: Permiso para ver reservas
        `
      },
      {
        id: 'functions',
        title: 'Funciones SQL',
        icon: 'Code',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['funciones', 'sql', 'triggers'],
        content: `
## Funciones SQL Importantes

### Autenticación y Permisos

:::api
- get_user_organization_id(user_id uuid) RETURNS uuid
- is_super_admin() RETURNS boolean
- can_access_area(area_id uuid, action text) RETURNS boolean
:::

### Módulos
- \`get_my_enabled_modules()\` RETURNS TABLE(module_key text, enabled boolean)

### Triggers
- \`update_updated_at_column()\`: Actualiza updated_at automáticamente
- Triggers de auditoría para acciones críticas

:::tip
Usa triggers para mantener datos sincronizados automáticamente sin lógica en el frontend.
:::
        `
      }
    ]
  },
  {
    id: 'permissions',
    title: 'Sistema de Permisos',
    icon: 'Shield',
    description: 'RBAC, roles personalizados y control de acceso',
    subsections: [
      {
        id: 'rbac',
        title: 'RBAC (Role-Based Access Control)',
        icon: 'UserCog',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['rbac', 'roles', 'permisos'],
        content: `
## Sistema RBAC

### Roles del Sistema
| Rol | Nivel | Descripción |
|-----|-------|-------------|
| owner | 100 | Propietario de la organización |
| admin | 80 | Administrador con acceso completo |
| manager | 60 | Gestiona equipos y tareas |
| member | 40 | Usuario estándar |
| read_only | 20 | Solo lectura |

:::info
Los roles superiores heredan permisos de los inferiores automáticamente.
:::

### Hook usePermissions

:::code
const { role, isOwner, isAdmin, hasPermission } = usePermissions();

if (hasPermission('tasks.delete')) {
  // Puede eliminar tareas
}
:::

Proporciona: role, isOwner, isAdmin, isManager, hasPermission, canAccessAdminPanel
        `
      },
      {
        id: 'custom-roles',
        title: 'Roles Personalizados',
        icon: 'Users',
        difficulty: 'advanced',
        readTime: 4,
        tags: ['roles', 'personalizados', 'permisos'],
        content: `
## Roles Personalizados

Las organizaciones pueden crear roles personalizados con permisos granulares.

### Tabla custom_roles

:::code
CREATE TABLE custom_roles (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations,
  name text NOT NULL,
  description text,
  permissions_json jsonb DEFAULT '{}',
  is_system boolean DEFAULT false
);
:::

### Permisos Disponibles
- \`tasks.*\`: create, read, update, delete, assign
- \`areas.*\`: create, read, update, delete, manage_access
- \`reports.*\`: view, export
- \`reservations.*\`: view, manage, assign
- \`integrations.*\`: manage_api_keys

:::warning
Los roles personalizados NO pueden superar los permisos del rol base asignado al usuario.
:::
        `
      },
      {
        id: 'area-access',
        title: 'Control de Acceso a Áreas',
        icon: 'FolderLock',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['áreas', 'acceso', 'visibilidad'],
        content: `
## Acceso a Áreas

Las áreas tienen tres niveles de visibilidad:

### Tipos de Visibilidad
| Tipo | Descripción |
|------|-------------|
| public | Visible para todos los miembros |
| admins | Solo owner y admin |
| private | Solo miembros con acceso explícito |

### Reglas de Acceso
Para áreas privadas, se pueden añadir reglas en \`area_access_rules\` con:
- \`area_id\`
- \`subject_type\`: user, team, role
- \`subject_id\`
- \`permission\`: view, edit, etc.

:::tip
Usa áreas privadas para proyectos confidenciales o información sensible.
:::
        `
      }
    ]
  },
  {
    id: 'modules',
    title: 'Sistema de Módulos',
    icon: 'Puzzle',
    description: 'Módulos opcionales y presets verticales',
    subsections: [
      {
        id: 'module-system',
        title: 'Cómo Funcionan los Módulos',
        icon: 'ToggleLeft',
        difficulty: 'basic',
        readTime: 3,
        tags: ['módulos', 'configuración', 'features'],
        content: `
## Sistema Modular

Los módulos permiten activar/desactivar funcionalidades por organización.

### Módulos Opcionales
- \`reservations\`: Gestión de reservas
- \`vehicle_status\`: Estado de flota
- \`time_tracking\`: Control de tiempo
- \`form_builder\`: Constructor de formularios
- \`teams\`: Equipos de trabajo
- \`automations\`: Automatizaciones
- \`templates\`: Plantillas
- \`reports\`: Reportes avanzados

### Módulos Core (siempre activos)
- Tareas
- Áreas
- Etiquetas
- Recordatorios
- Calendario

:::info
Los módulos se gestionan desde la tabla organization_modules.
:::
        `
      },
      {
        id: 'module-implementation',
        title: 'Implementar un Nuevo Módulo',
        icon: 'Plus',
        difficulty: 'advanced',
        readTime: 5,
        tags: ['módulos', 'desarrollo', 'implementación'],
        content: `
## Añadir un Nuevo Módulo

### 1. Definir el módulo

:::code
// hooks/useOrganizationModules.ts
export type ModuleKey = 
  | 'reservations'
  | 'my_new_module' // Añadir aquí
  | ...;

export const OPTIONAL_MODULES: ModuleInfo[] = [
  { key: 'my_new_module', label: 'Mi Módulo' },
  ...
];
:::

### 2. Crear las rutas
En App.tsx usar ProtectedRoute + ModuleRoute con moduleKey

### 3. Añadir al sidebar
En AppSidebar.tsx añadir a MENU_MODULE_MAP

### 4. Crear tablas (si necesario)
Usar el sistema de migraciones para crear las tablas del módulo.

:::warning
Recuerda añadir RLS policies a todas las tablas nuevas.
:::
        `
      },
      {
        id: 'vertical-presets',
        title: 'Presets Verticales',
        icon: 'Layout',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['presets', 'verticales', 'configuración'],
        content: `
## Presets Verticales

Los presets configuran módulos según el tipo de negocio:

### Presets Disponibles
| Preset | Módulos Activos |
|--------|-----------------|
| equipos_internos | Teams, Reports, Time Tracking |
| agencias | Reservations, Vehicles, Forms |
| operaciones | Vehicles, Reservations, Automations |

:::admin
Solo Super Admins pueden aplicar presets desde el panel de administración.
:::

### Aplicar un Preset
- /super-admin/organizations/:id (organización específica)
- /super-admin/operations (masivo)

### Implementación
Definido en \`lib/verticalPresets.ts\` con objeto VERTICAL_PRESETS
        `
      }
    ]
  },
  {
    id: 'edge-functions',
    title: 'Edge Functions',
    icon: 'Zap',
    description: 'Funciones serverless para lógica de backend',
    subsections: [
      {
        id: 'functions-list',
        title: 'Lista de Funciones',
        icon: 'List',
        difficulty: 'basic',
        readTime: 3,
        tags: ['edge-functions', 'serverless', 'api'],
        content: `
## Edge Functions

### Stripe / Billing
| Función | Propósito |
|---------|-----------|
| create-checkout | Crear sesión de checkout |
| customer-portal | Acceso al portal de Stripe |
| stripe-webhook | Procesar webhooks de Stripe |
| check-subscription | Verificar estado de suscripción |
| cancel-subscription | Cancelar suscripción |
| update-subscription | Modificar plan |

### Notificaciones
| Función | Propósito |
|---------|-----------|
| send-email | Enviar emails transaccionales |
| send-push | Notificaciones push |
| send-slack | Mensajes a Slack |
| send-whatsapp | Mensajes de WhatsApp |
| process-outbound | Procesar cola de notificaciones |

### Integraciones
| Función | Propósito |
|---------|-----------|
| sync-rently | Sincronizar con Rently |
| scim | Provisioning SCIM para SSO |
| ai-assistant | Asistente de IA |
| apply-template | Aplicar plantillas |
        `
      },
      {
        id: 'function-structure',
        title: 'Estructura de una Función',
        icon: 'FileCode',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['edge-functions', 'deno', 'estructura'],
        content: `
## Estructura de Edge Function

Cada función sigue este patrón:

:::code
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Get auth token
    const authHeader = req.headers.get('Authorization');
    
    // 3. Create Supabase client
    const supabase = createClient(url, serviceKey);
    
    // 4. Execute business logic
    const result = await doSomething();
    
    // 5. Return response
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
});
:::

:::tip
Siempre maneja CORS y errores correctamente para evitar problemas en producción.
:::
        `
      }
    ]
  },
  {
    id: 'integrations',
    title: 'Integraciones',
    icon: 'Link',
    description: 'Stripe, Rently y canales de notificación',
    subsections: [
      {
        id: 'stripe',
        title: 'Stripe',
        icon: 'CreditCard',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['stripe', 'pagos', 'suscripciones'],
        content: `
## Integración con Stripe

### Productos y Planes
Configurados en billing_products:
- \`starter\`: Plan básico
- \`professional\`: Plan profesional
- \`enterprise\`: Plan empresarial

### Flujo de Suscripción
1. Usuario selecciona plan
2. create-checkout crea sesión de Stripe
3. Usuario completa pago en Stripe
4. Webhook actualiza subscriptions en DB
5. App refleja nuevo plan

:::security
Secrets Necesarios:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
:::

:::warning
Nunca expongas las claves secretas de Stripe en el frontend.
:::
        `
      },
      {
        id: 'rently',
        title: 'Rently',
        icon: 'Car',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['rently', 'reservas', 'sincronización'],
        content: `
## Integración con Rently

### Configuración
En integration_settings:
- \`rently_api_host\`
- \`rently_client_id\`
- \`rently_client_secret\`

### Sincronización
La función sync-rently:
1. Obtiene credenciales de la organización
2. Llama a la API de Rently
3. Upsert de reservas y vehículos
4. Registra resultado en logs

### Campos Mapeados
| Rently | PlanMint |
|--------|----------|
| reservation_id | external_reservation_id |
| vehicle_plate | auto |
| customer_name | cliente_nombre |

:::tip
Configura la sincronización automática para mantener los datos actualizados.
:::
        `
      },
      {
        id: 'notifications',
        title: 'Canales de Notificación',
        icon: 'Bell',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['notificaciones', 'email', 'slack', 'whatsapp'],
        content: `
## Canales de Notificación

### Email (Resend)
Secret: \`RESEND_API_KEY\`

### Slack
Configurar webhook URL en \`integration_settings.slack_webhook_url\`

### WhatsApp (Meta Business)
Secrets:
- \`WHATSAPP_ACCESS_TOKEN\`
- \`WHATSAPP_PHONE_NUMBER_ID\`

### Push Notifications
Secrets:
- \`VAPID_PUBLIC_KEY\`
- \`VAPID_PRIVATE_KEY\`

### Cola de Procesamiento
Las notificaciones se encolan en \`outbound_notifications\` y se procesan por process-outbound.

:::info
Cada usuario puede configurar sus preferencias de notificación en su perfil.
:::
        `
      }
    ]
  },
  {
    id: 'security',
    title: 'Seguridad',
    icon: 'Lock',
    description: 'Modelo de seguridad, límites de acceso y Super Admin',
    subsections: [
      {
        id: 'security-model',
        title: 'Modelo de Seguridad',
        icon: 'ShieldCheck',
        difficulty: 'advanced',
        readTime: 5,
        tags: ['seguridad', 'multi-tenancy', 'autenticación'],
        content: `
## Modelo de Seguridad

:::security
La seguridad es la prioridad #1. Todos los cambios deben pasar revisión de seguridad.
:::

### Multi-tenancy
- Cada organización es un tenant aislado
- RLS filtra datos por organization_id
- Usuarios solo ven datos de su organización

### Autenticación
- Supabase Auth maneja sesiones
- Tokens JWT con claims personalizados
- Refresh token rotation habilitado

### Autorización
- RBAC con roles jerárquicos
- Permisos granulares por recurso
- Validación tanto en frontend como backend

### Auditoría
- Tabla audit_logs registra acciones críticas
- Inmutable (RLS bloquea UPDATE/DELETE)
- Retención configurable por organización
        `
      },
      {
        id: 'security-boundaries',
        title: 'Límites de Acceso',
        icon: 'Ban',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['acceso', 'roles', 'límites'],
        content: `
## Límites de Acceso por Rol

### Solo Owner
- Configuración SAML/SSO
- Tokens SCIM
- Claves de API de integraciones
- Eliminar organización

### Owner + Admin
- Áreas con visibilidad admins
- Configuración de seguridad
- Gestión de roles personalizados

### Owner + Admin + Manager
- Ver respuestas de formularios
- Asignar tareas a cualquier usuario
- Acceder al panel de administración

### Todos los Miembros
- Sus propias tareas
- Áreas públicas
- Su propio perfil

:::warning
Revisa regularmente los permisos asignados a cada rol.
:::
        `
      },
      {
        id: 'super-admin',
        title: 'Super Admin',
        icon: 'Crown',
        difficulty: 'advanced',
        readTime: 4,
        tags: ['super-admin', 'plataforma', 'gestión'],
        content: `
## Rol Super Admin

:::admin
El Super Admin tiene acceso completo a TODA la plataforma. Usa con precaución.
:::

### Acceso
- Tabla \`super_admins\` define quién es super admin
- Función \`is_super_admin()\` verifica acceso
- Ruta protegida por SuperAdminRoute

### Capacidades
- Ver/gestionar TODAS las organizaciones
- Modificar suscripciones y planes
- Gestionar feature flags globales
- Aplicar presets verticales
- Ver feedback de usuarios
- Acceder a logs de auditoría globales

### Panel Super Admin
Rutas /super-admin/* con layout dedicado

:::security
Las acciones de Super Admin se registran en audit_logs para trazabilidad completa.
:::
        `
      }
    ]
  }
];
