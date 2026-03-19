import { ModuleKey } from '@/hooks/useOrganizationModules';

export type HelpDifficulty = 'basic' | 'intermediate' | 'advanced';

export interface HelpSubsection {
  id: string;
  title: string;
  icon?: string;
  difficulty?: HelpDifficulty;
  readTime?: number;
  tags?: string[];
  content: string;
  relatedTopics?: string[];
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string;
  description?: string;
  moduleKey?: ModuleKey;
  subsections: HelpSubsection[];
}

export const helpSections: HelpSection[] = [
  // =====================================================================
  // 1. PRIMEROS PASOS
  // =====================================================================
  {
    id: 'getting-started',
    title: 'Primeros Pasos',
    icon: 'Rocket',
    description: 'Aprende los conceptos básicos para comenzar a usar PlanMint',
    subsections: [
      {
        id: 'login',
        title: 'Acceder a PlanMint',
        icon: 'LogIn',
        difficulty: 'basic',
        readTime: 2,
        tags: ['acceso', 'login', 'contraseña', 'inicio', 'sesión'],
        content: `
## Acceder a PlanMint

Para acceder a la aplicación:

1. Abre tu navegador y ve a la dirección proporcionada por tu organización
2. Introduce tu **email** y **contraseña**
3. Haz clic en **"Iniciar sesión"**

:::tip
Si es tu primera vez, habrás recibido una invitación por email con un enlace para crear tu cuenta. El enlace de invitación es válido por 7 días.
:::

### ¿Olvidaste tu contraseña?

1. Haz clic en **"¿Olvidaste tu contraseña?"** en la pantalla de login
2. Introduce tu email registrado
3. Revisa tu bandeja de entrada (y spam) para el enlace de recuperación
4. Haz clic en el enlace y establece una nueva contraseña

:::info
El enlace de recuperación expira en 24 horas. Si no lo recibes, revisa tu carpeta de spam o contacta con tu administrador.
:::

### Instalar como aplicación (PWA)

PlanMint puede instalarse como una aplicación en tu dispositivo:

1. En **Chrome**: Haz clic en el icono de instalación en la barra de direcciones (o menú > "Instalar aplicación")
2. En **Safari (iOS)**: Toca "Compartir" > "Añadir a pantalla de inicio"
3. En **Android**: El navegador te mostrará un banner de instalación automáticamente

:::tip
La versión instalada se abre más rápido y te permite recibir notificaciones push incluso con el navegador cerrado.
:::
        `,
        relatedTopics: ['navigation', 'profile', 'faq-pwa']
      },
      {
        id: 'navigation',
        title: 'Navegación y estructura',
        icon: 'Compass',
        difficulty: 'basic',
        readTime: 3,
        tags: ['navegación', 'sidebar', 'menú', 'interfaz', 'estructura'],
        content: `
## Navegación y estructura

PlanMint tiene una **barra lateral (sidebar)** a la izquierda con todas las secciones principales. Las secciones visibles dependen de tu rol y los módulos habilitados en tu organización.

### Secciones principales

| Sección | Descripción | Siempre visible |
|---------|-------------|:---------------:|
| **Dashboard** | Vista general con estadísticas y tareas pendientes | ✅ |
| **Tareas** | Lista de todas las tareas | ✅ |
| **Kanban** | Tablero visual para gestionar tareas | ✅ |
| **Calendario** | Vista de tareas por fecha | ✅ |
| **Recordatorios** | Gestión de alertas y notificaciones | ✅ |
| **Áreas** | Categorías para organizar el trabajo | ✅ |
| **Etiquetas** | Marcadores para clasificar tareas | ✅ |

### Secciones de módulos (si están habilitados)

| Sección | Módulo | Descripción |
|---------|--------|-------------|
| **Equipos** | Teams | Gestión de equipos de trabajo |
| **Control de Tiempo** | Time Tracking | Registro de horas trabajadas |
| **Reservas** | Reservations | Gestión de entregas y devoluciones |
| **Estado de Coches** | Vehicle Status | Estado y limpieza de flota |
| **Transfers** | Transfers | Gestión de trayectos y brokers |
| **Garatech** | Garatech | Reparaciones, accidentes y talleres |
| **Automatizaciones** | Automations | Reglas automáticas |
| **Reportes** | Reports | Informes y estadísticas |
| **Plantillas** | Templates | Plantillas reutilizables |

:::tip
Puedes **colapsar el sidebar** haciendo clic en el icono de flecha para tener más espacio de trabajo. En móvil, el sidebar se oculta automáticamente.
:::

### Búsqueda global

Usa el atajo **Ctrl+K** (o **Cmd+K** en Mac) para abrir la búsqueda global. Puedes buscar:

- Tareas por título o descripción
- Áreas y etiquetas
- Miembros del equipo
- Secciones de la aplicación

### Notificaciones

El icono de campana en la parte superior muestra tus notificaciones pendientes. Un **badge rojo** indica notificaciones no leídas.
        `,
        relatedTopics: ['login', 'profile', 'dashboard']
      },
      {
        id: 'profile',
        title: 'Configurar tu perfil',
        icon: 'User',
        difficulty: 'basic',
        readTime: 3,
        tags: ['perfil', 'configuración', 'tema', 'avatar', 'preferencias'],
        content: `
## Configurar tu perfil

Para personalizar tu cuenta:

1. Haz clic en tu **avatar** en la parte inferior del sidebar, o ve a **Ajustes**
2. En la sección **"Perfil"**, puedes modificar:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Tu nombre visible para el equipo |
| **Avatar** | Tu foto de perfil (sube una imagen) |
| **Tema** | Claro, oscuro o automático (según tu sistema) |

3. Los cambios se guardan automáticamente al modificar cada campo

### Preferencias de notificaciones

En la pestaña **Notificaciones** puedes configurar:

- **Canales**: Email, push, in-app, Slack, WhatsApp
- **Eventos**: Qué tipos de eventos generan notificación (asignaciones, comentarios, vencimientos, etc.)
- **Horario silencioso**: Define horas sin notificaciones (ej: 22:00 - 08:00)
- **Zona horaria**: Para que las notificaciones respeten tu horario local

:::info
Los cambios en tu perfil se guardan automáticamente. Tu nombre y avatar son visibles para todos los miembros de la organización.
:::

:::admin
Los administradores pueden ver y modificar los perfiles de otros miembros desde **Ajustes > Miembros**.
:::
        `,
        relatedTopics: ['navigation', 'faq-notifications', 'settings-profile']
      },
      {
        id: 'roles-overview',
        title: 'Roles y permisos',
        icon: 'Shield',
        difficulty: 'basic',
        readTime: 4,
        tags: ['roles', 'permisos', 'acceso', 'owner', 'admin', 'manager', 'member'],
        content: `
## Roles y permisos

PlanMint utiliza un sistema de roles para controlar el acceso a las funciones:

### Roles predefinidos

| Rol | Descripción | Nivel de acceso |
|-----|-------------|:---------------:|
| **Owner** | Propietario de la organización | Total |
| **Admin** | Administrador con acceso completo | Muy alto |
| **Manager** | Gestor de equipos y tareas | Alto |
| **Member** | Miembro estándar del equipo | Básico |

### ¿Qué puede hacer cada rol?

| Acción | Owner | Admin | Manager | Member |
|--------|:-----:|:-----:|:-------:|:------:|
| Crear tareas | ✅ | ✅ | ✅ | ✅ |
| Editar cualquier tarea | ✅ | ✅ | ✅ | ❌ |
| Editar sus propias tareas | ✅ | ✅ | ✅ | ✅ |
| Gestionar miembros | ✅ | ✅ | ❌ | ❌ |
| Configurar organización | ✅ | ✅ | ❌ | ❌ |
| Gestionar roles personalizados | ✅ | ✅ | ❌ | ❌ |
| Facturación y suscripción | ✅ | ❌ | ❌ | ❌ |

:::info
Los administradores pueden otorgar **permisos individuales** a cualquier miembro, permitiendo excepciones al rol base. Por ejemplo, un Member puede recibir permiso para editar tareas de su área.
:::

:::tip
Si necesitas más control, pide a tu administrador que cree **Roles personalizados** con permisos específicos para tu equipo.
:::
        `,
        relatedTopics: ['admin-members', 'admin-custom-roles', 'admin-permissions']
      }
    ]
  },

  // =====================================================================
  // 2. DASHBOARD
  // =====================================================================
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: 'LayoutDashboard',
    description: 'Tu centro de control con estadísticas y acceso rápido',
    subsections: [
      {
        id: 'dashboard-overview',
        title: 'Vista general del Dashboard',
        icon: 'BarChart3',
        difficulty: 'basic',
        readTime: 3,
        tags: ['dashboard', 'resumen', 'estadísticas', 'widgets'],
        content: `
## Vista general del Dashboard

El Dashboard es la primera pantalla que ves al iniciar sesión. Muestra un resumen de la actividad:

### Widgets principales

| Widget | Qué muestra |
|--------|-------------|
| **Tareas pendientes** | Número de tareas sin completar asignadas a ti |
| **Tareas vencidas** | Tareas que han pasado su fecha límite |
| **Completadas hoy** | Tareas finalizadas en el día |
| **Actividad reciente** | Últimas acciones en la organización |

### Estadísticas

- **Gráfico de progreso**: Porcentaje de tareas completadas vs pendientes
- **Distribución por área**: Cuántas tareas hay en cada área
- **Tendencia semanal**: Evolución del trabajo durante la semana

### Acciones rápidas

Desde el Dashboard puedes:

1. **Crear tarea rápida**: Botón "+" para nueva tarea sin salir del Dashboard
2. **Ver tareas urgentes**: Lista filtrada de tareas con prioridad alta/urgente
3. **Acceder a notificaciones**: Campana con contador de no leídas

:::tip
El Dashboard se actualiza automáticamente. Si quieres datos al instante, recarga la página o usa el botón de actualizar.
:::
        `,
        relatedTopics: ['create-task', 'task-status', 'navigation']
      }
    ]
  },

  // =====================================================================
  // 3. TAREAS
  // =====================================================================
  {
    id: 'tasks',
    title: 'Tareas',
    icon: 'ClipboardList',
    description: 'Todo lo que necesitas saber sobre la gestión de tareas',
    subsections: [
      {
        id: 'create-task',
        title: 'Crear una tarea',
        icon: 'Plus',
        difficulty: 'basic',
        readTime: 4,
        tags: ['crear', 'nueva', 'tarea', 'formulario'],
        content: `
## Crear una tarea

Para crear una nueva tarea:

1. Ve a la sección **Tareas** en el sidebar
2. Haz clic en el botón **"+ Nueva tarea"** en la esquina superior derecha
3. Completa los campos del formulario
4. Haz clic en **"Guardar"**

### Campos del formulario

| Campo | Descripción | Obligatorio |
|-------|-------------|:-----------:|
| **Título** | Nombre descriptivo de la tarea | ✅ |
| **Descripción** | Detalles adicionales y contexto | ❌ |
| **Tipo** | Simple, Objetivo, Hitos u Operación | ✅ |
| **Área** | Categoría principal de la tarea | ✅ |
| **Prioridad** | Baja, Media, Alta o Urgente | ✅ |
| **Estado** | Estado inicial (por defecto: Pendiente) | ✅ |
| **Fecha de vencimiento** | Cuándo debe completarse | ❌ |
| **Asignados** | Quién realizará la tarea (uno o varios) | ❌ |
| **Etiquetas** | Clasificación transversal | ❌ |

:::tip
Puedes crear tareas rápidamente usando el atajo **Ctrl+N** desde cualquier pantalla.
:::

:::warning
Las tareas sin fecha de vencimiento no aparecerán en el calendario. Asigna siempre una fecha para mejor seguimiento.
:::

:::info
Si tienes el permiso **tasks.create**, puedes crear tareas. Todos los roles tienen este permiso por defecto.
:::
        `,
        relatedTopics: ['task-types', 'task-status', 'task-assign', 'kanban', 'calendar']
      },
      {
        id: 'task-types',
        title: 'Tipos de tareas',
        icon: 'Layers',
        difficulty: 'intermediate',
        readTime: 5,
        tags: ['tipo', 'simple', 'objetivo', 'hitos', 'operación', 'subtareas'],
        content: `
## Tipos de tareas

PlanMint ofrece cuatro tipos de tareas para adaptarse a diferentes necesidades:

### 1. Tarea Simple

La más básica. Tiene un título, descripción, y se marca como completada cuando se termina.

- Ideal para tareas individuales sin dependencias
- Ejemplo: "Enviar informe mensual"

### 2. Tarea Objetivo

Similar a la simple, pero incluye un **indicador de progreso** que se actualiza manualmente.

- Tiene un porcentaje de avance (0-100%)
- Ideal para tareas de larga duración
- Ejemplo: "Migrar base de datos" (30% completado)

### 3. Tarea con Hitos (Subtareas)

Incluye una lista de **subtareas** que se van completando individualmente. El progreso general se calcula automáticamente según las subtareas completadas.

- Cada subtarea tiene su propio estado (pendiente/completada)
- Se pueden reordenar arrastrando
- Ejemplo: "Preparar evento" → Reservar sala, Enviar invitaciones, Preparar materiales

### 4. Tarea de Operación

Diseñada para procesos con **múltiples fases** (tramos o legs). Cada tramo tiene su propio asignado, estado y checklist.

- Ideal para operaciones logísticas con varios pasos
- Cada tramo se asigna independientemente
- Incluye checklist configurable por tramo
- Ejemplo: "Entrega vehículo" → Preparación, Transporte, Entrega al cliente

:::tip
Puedes cambiar el tipo de una tarea después de crearla, pero ten en cuenta que las subtareas o tramos existentes pueden perderse.
:::

### Añadir subtareas (Tipo Hitos)

1. Abre una tarea de tipo **Hitos**
2. En la sección de subtareas, escribe el título de la nueva subtarea
3. Pulsa **Enter** o haz clic en **"+ Añadir"**
4. Arrastra las subtareas para reordenarlas
5. Haz clic en el checkbox para marcarlas como completadas

:::info
El progreso de la tarea se calcula automáticamente: si tienes 4 subtareas y 2 están completadas, el progreso será del 50%.
:::
        `,
        relatedTopics: ['create-task', 'task-status', 'task-operation-legs']
      },
      {
        id: 'task-operation-legs',
        title: 'Tramos de operación',
        icon: 'GitBranch',
        difficulty: 'advanced',
        readTime: 5,
        tags: ['operación', 'tramos', 'legs', 'checklist', 'logística'],
        content: `
## Tramos de operación

Las tareas de tipo **Operación** se dividen en tramos (legs), cada uno representando una fase del proceso.

### Crear tramos

1. Abre una tarea de tipo **Operación**
2. En la sección de tramos, haz clic en **"+ Añadir tramo"**
3. Define el tipo de tramo y el asignado
4. Repite para cada fase necesaria

### Propiedades de cada tramo

| Propiedad | Descripción |
|-----------|-------------|
| **Tipo** | Categoría del tramo (Preparación, Transporte, etc.) |
| **Asignado** | Quién realiza esta fase |
| **Estado** | Pendiente, En progreso, Completado |
| **Fecha programada** | Cuándo debe ejecutarse |
| **Checklist** | Lista de verificación para esta fase |
| **Notas** | Observaciones específicas del tramo |

### Flujo de trabajo

1. Cada tramo se inicia individualmente por su asignado
2. El asignado marca los puntos del checklist
3. Al completar todos los puntos, marca el tramo como **Completado**
4. Cuando todos los tramos están completados, la tarea general puede cerrarse

:::admin
Los administradores pueden configurar los tipos de tramos disponibles y los checklists predeterminados.
:::

:::tip
Los tramos se pueden reasignar en cualquier momento si el responsable original no está disponible.
:::
        `,
        relatedTopics: ['task-types', 'task-assign']
      },
      {
        id: 'task-status',
        title: 'Estados de tareas',
        icon: 'Activity',
        difficulty: 'basic',
        readTime: 3,
        tags: ['estado', 'progreso', 'completada', 'pendiente', 'kanban'],
        content: `
## Estados de tareas

Cada tarea pasa por diferentes estados durante su ciclo de vida:

### Estados predeterminados

| Estado | Significado | Color |
|--------|-------------|-------|
| **Pendiente** | Tarea sin comenzar | Gris |
| **En progreso** | Trabajo en curso | Azul |
| **En revisión** | Esperando aprobación | Amarillo |
| **Completada** | Tarea finalizada | Verde |
| **Cancelada** | Tarea descartada | Rojo |

### Cambiar el estado

Hay varias formas de cambiar el estado:

1. **Desde la tarea**: Abre la tarea y selecciona el nuevo estado en el menú desplegable
2. **Desde el Kanban**: Arrastra la tarjeta a la columna correspondiente
3. **Desde la lista**: Haz clic en el indicador de estado junto al título

:::tip
En la vista Kanban puedes cambiar el estado arrastrando la tarea a otra columna. Es la forma más rápida.
:::

:::admin
Los administradores pueden configurar qué columnas son visibles en el Kanban, sus colores y el orden en **Ajustes > Kanban**. También pueden crear estados personalizados.
:::

:::info
Necesitas el permiso **tasks.change_status** para cambiar estados. Por defecto, todos los roles excepto Member pueden cambiar el estado de cualquier tarea. Un Member solo puede cambiar el estado de las tareas que tiene asignadas.
:::
        `,
        relatedTopics: ['kanban', 'create-task', 'kanban-config']
      },
      {
        id: 'task-assign',
        title: 'Asignar tareas',
        icon: 'UserPlus',
        difficulty: 'basic',
        readTime: 3,
        tags: ['asignar', 'asignado', 'multi-asignación', 'equipo'],
        content: `
## Asignar tareas

PlanMint soporta **multi-asignación**: una tarea puede tener varios responsables.

### Asignar al crear

1. En el formulario de creación, busca el campo **"Asignados"**
2. Haz clic y busca miembros por nombre
3. Selecciona uno o varios miembros
4. Guarda la tarea

### Reasignar una tarea existente

1. Abre la tarea
2. En la sección de asignados, haz clic en **"Editar asignados"**
3. Añade o elimina miembros
4. Los cambios se guardan automáticamente

:::info
Cuando asignas una tarea a alguien, esa persona recibe una notificación automática (según sus preferencias de notificación).
:::

:::warning
Para reasignar tareas de otros, necesitas el permiso **tasks.assign**. Los Members solo pueden gestionar asignaciones en sus propias tareas a menos que tengan un override de permisos.
:::

:::tip
Si tienes el módulo de **Equipos** habilitado, también puedes asignar tareas a equipos completos.
:::
        `,
        relatedTopics: ['create-task', 'task-types', 'teams-overview']
      },
      {
        id: 'task-filters',
        title: 'Filtrar y buscar tareas',
        icon: 'Filter',
        difficulty: 'basic',
        readTime: 3,
        tags: ['filtrar', 'buscar', 'ordenar', 'vista'],
        content: `
## Filtrar y buscar tareas

### Barra de filtros

En la vista de lista de tareas, la barra superior te permite filtrar por:

| Filtro | Opciones |
|--------|----------|
| **Estado** | Pendiente, En progreso, En revisión, Completada, Cancelada |
| **Prioridad** | Baja, Media, Alta, Urgente |
| **Área** | Cualquier área activa |
| **Asignado** | Miembros específicos o "Sin asignar" |
| **Etiquetas** | Una o varias etiquetas |
| **Fecha** | Rango de fechas de vencimiento |
| **Tipo** | Simple, Objetivo, Hitos, Operación |

### Búsqueda por texto

Usa el campo de búsqueda para encontrar tareas por **título** o **descripción**. La búsqueda es instantánea y no distingue mayúsculas.

### Ordenar

Haz clic en los encabezados de columna para ordenar por:
- Fecha de creación
- Fecha de vencimiento
- Prioridad
- Estado
- Título (alfabético)

:::tip
Los filtros se mantienen mientras navegas. Para resetearlos, haz clic en **"Limpiar filtros"**.
:::

:::info
La búsqueda global (**Ctrl+K**) busca en todas las tareas. Los filtros de la lista solo aplican a la vista actual.
:::
        `,
        relatedTopics: ['create-task', 'kanban', 'calendar']
      },
      {
        id: 'task-archive-trash',
        title: 'Archivar y papelera',
        icon: 'Archive',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['archivar', 'eliminar', 'papelera', 'restaurar', 'borrar'],
        content: `
## Archivar y papelera

### Archivar una tarea

Archivar oculta la tarea de las vistas principales sin eliminarla:

1. Abre la tarea
2. Haz clic en el menú de opciones (⋯)
3. Selecciona **"Archivar"**

Las tareas archivadas se pueden ver activando el filtro **"Mostrar archivadas"**.

### Eliminar una tarea

Eliminar envía la tarea a la **papelera**:

1. Abre la tarea
2. Haz clic en el menú de opciones (⋯)
3. Selecciona **"Eliminar"**
4. Confirma la acción

:::warning
Las tareas en la papelera se eliminan permanentemente después de 30 días.
:::

### Restaurar desde la papelera

1. Ve a **Ajustes > Papelera** (solo admins)
2. Encuentra la tarea eliminada
3. Haz clic en **"Restaurar"**

:::admin
Solo los administradores pueden acceder a la papelera y restaurar tareas eliminadas. La eliminación permanente también requiere permisos de admin.
:::
        `,
        relatedTopics: ['create-task', 'admin-trash']
      }
    ]
  },

  // =====================================================================
  // 4. KANBAN
  // =====================================================================
  {
    id: 'kanban',
    title: 'Kanban',
    icon: 'Columns',
    description: 'Gestiona tus tareas visualmente con el tablero Kanban',
    subsections: [
      {
        id: 'kanban-overview',
        title: 'Usar el tablero Kanban',
        icon: 'LayoutGrid',
        difficulty: 'basic',
        readTime: 4,
        tags: ['kanban', 'tablero', 'columnas', 'arrastrar', 'visual'],
        content: `
## Usar el tablero Kanban

El tablero Kanban te permite visualizar tareas como tarjetas organizadas en columnas por estado:

1. Ve a **Kanban** en el sidebar
2. Las columnas representan los estados de las tareas
3. **Arrastra y suelta** tarjetas para cambiar su estado
4. Haz clic en una tarjeta para ver sus detalles completos

### Información visible en cada tarjeta

| Elemento | Descripción |
|----------|-------------|
| **Título** | Nombre de la tarea |
| **Prioridad** | Indicador de color según la prioridad |
| **Asignados** | Avatares de las personas asignadas |
| **Área** | Badge con el nombre del área |
| **Etiquetas** | Chips con las etiquetas asociadas |
| **Fecha** | Fecha de vencimiento (roja si está vencida) |

### Filtros del Kanban

Usa la barra de filtros superior para filtrar por:
- **Área**: Ver solo tareas de un área específica
- **Asignado**: Ver tareas de una persona
- **Prioridad**: Filtrar por urgencia
- **Etiquetas**: Filtrar por clasificación

:::tip
El Kanban se actualiza en tiempo real. Si otro miembro mueve una tarjeta, verás el cambio inmediatamente.
:::
        `,
        relatedTopics: ['task-status', 'kanban-config', 'create-task']
      },
      {
        id: 'kanban-config',
        title: 'Configurar columnas del Kanban',
        icon: 'Settings',
        difficulty: 'advanced',
        readTime: 4,
        tags: ['kanban', 'columnas', 'configurar', 'personalizar', 'color'],
        content: `
## Configurar columnas del Kanban

:::admin
Esta función solo está disponible para Owners y Admins.
:::

Para personalizar las columnas del Kanban:

1. Ve a **Ajustes > Kanban** (o haz clic en el icono de engranaje en el tablero)
2. Verás la lista de columnas/estados disponibles

### Opciones por columna

| Opción | Descripción |
|--------|-------------|
| **Nombre** | Texto que se muestra en la columna |
| **Color** | Color del encabezado de la columna |
| **Visible** | Si la columna aparece en el tablero |
| **Orden** | Posición de izquierda a derecha |

### Acciones disponibles

- **Reordenar**: Arrastra las columnas para cambiar su posición
- **Ocultar**: Desactiva columnas que no necesites (las tareas en ese estado seguirán existiendo)
- **Cambiar color**: Haz clic en el color para seleccionar uno nuevo

:::warning
Ocultar una columna no elimina las tareas que tienen ese estado. Simplemente dejan de ser visibles en el tablero Kanban, pero siguen accesibles desde la lista de tareas.
:::

:::tip
Es recomendable mantener entre 3 y 6 columnas visibles para que el tablero sea manejable.
:::
        `,
        relatedTopics: ['kanban-overview', 'task-status']
      }
    ]
  },

  // =====================================================================
  // 5. CALENDARIO
  // =====================================================================
  {
    id: 'calendar',
    title: 'Calendario',
    icon: 'Calendar',
    description: 'Visualiza y planifica tus tareas en un calendario',
    subsections: [
      {
        id: 'calendar-views',
        title: 'Vistas del calendario',
        icon: 'CalendarDays',
        difficulty: 'basic',
        readTime: 3,
        tags: ['calendario', 'mes', 'semana', 'día', 'planificación'],
        content: `
## Vistas del calendario

El calendario muestra tus tareas organizadas por su fecha de vencimiento:

### Vistas disponibles

| Vista | Descripción | Ideal para |
|-------|-------------|------------|
| **Mensual** | Panorama general del mes completo | Planificación a largo plazo |
| **Semanal** | Detalle de la semana actual | Organización semanal |
| **Diaria** | Agenda del día seleccionado | Enfoque diario |

### Navegar entre fechas

- Usa las flechas **◀ ▶** para avanzar o retroceder
- Haz clic en **"Hoy"** para volver a la fecha actual
- En vista mensual, haz clic en un día para ver sus tareas

### Crear tarea desde el calendario

1. Haz clic en un **día vacío** en la vista mensual
2. Se abrirá el formulario de nueva tarea con la fecha preseleccionada
3. Completa los campos y guarda

### Filtros

Usa los filtros superiores para ver solo:
- Tareas asignadas a ti
- Tareas de un área específica
- Tareas con cierta prioridad

:::info
Solo las tareas con fecha de vencimiento aparecen en el calendario. Asigna fechas a todas tus tareas para mejor visibilidad.
:::

:::tip
Las tareas vencidas se muestran en **rojo** para identificarlas rápidamente.
:::
        `,
        relatedTopics: ['create-task', 'task-status', 'task-filters']
      }
    ]
  },

  // =====================================================================
  // 6. ÁREAS Y ETIQUETAS
  // =====================================================================
  {
    id: 'areas-tags',
    title: 'Áreas y Etiquetas',
    icon: 'Layers',
    description: 'Organiza tu trabajo con categorías y clasificaciones',
    subsections: [
      {
        id: 'areas',
        title: 'Gestionar Áreas',
        icon: 'FolderOpen',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['áreas', 'categorías', 'organización', 'visibilidad', 'acceso'],
        content: `
## Gestionar Áreas

Las **Áreas** son categorías principales para organizar el trabajo en tu organización.

### Crear un área

:::admin
Solo los Owners, Admins y Managers pueden crear áreas.
:::

1. Ve a **Áreas** en el sidebar
2. Haz clic en **"+ Nueva área"**
3. Completa los campos:

| Campo | Descripción | Obligatorio |
|-------|-------------|:-----------:|
| **Nombre** | Nombre descriptivo del área | ✅ |
| **Descripción** | Contexto sobre el área | ❌ |
| **Color** | Color identificativo | ✅ |
| **Icono** | Icono representativo | ❌ |
| **Visibilidad** | Quién puede ver las tareas del área | ✅ |

### Tipos de visibilidad

| Tipo | Quién puede ver | Uso recomendado |
|------|-----------------|-----------------|
| **Pública** | Todos los miembros | Trabajo general |
| **Solo admins** | Solo Owners y Admins | Información confidencial |
| **Privada** | Solo miembros autorizados | Proyectos específicos |

### Reglas de acceso (Áreas privadas)

Para áreas con visibilidad **Privada**, puedes definir reglas de acceso:

1. Abre el área
2. Ve a la pestaña **"Acceso"**
3. Añade miembros o equipos específicos
4. Define el tipo de permiso (ver o editar)

:::warning
Archivar un área no elimina las tareas asociadas, pero estas dejarán de ser visibles en los filtros principales. Se pueden ver activando "Mostrar archivadas".
:::

:::tip
Usa colores distintos para cada área para identificarlas rápidamente en el Kanban y la lista de tareas.
:::
        `,
        relatedTopics: ['tags', 'create-task', 'admin-modules']
      },
      {
        id: 'tags',
        title: 'Gestionar Etiquetas',
        icon: 'Tag',
        difficulty: 'basic',
        readTime: 3,
        tags: ['etiquetas', 'tags', 'clasificación', 'filtrar'],
        content: `
## Gestionar Etiquetas

Las **Etiquetas** son marcadores flexibles para clasificar tareas de forma transversal. A diferencia de las Áreas, una tarea puede tener **múltiples etiquetas**.

### Crear una etiqueta

1. Ve a **Etiquetas** en el sidebar
2. Haz clic en **"+ Nueva etiqueta"**
3. Define nombre y color
4. Guarda

### Añadir etiquetas a una tarea

1. Abre la tarea
2. En la sección de etiquetas, haz clic en **"+ Añadir"**
3. Busca y selecciona las etiquetas deseadas
4. También puedes crear una nueva etiqueta directamente desde aquí

### Ejemplos de uso

| Etiqueta | Uso |
|----------|-----|
| **Urgente** | Prioridad máxima |
| **Cliente VIP** | Tareas de clientes importantes |
| **Requiere revisión** | Necesita aprobación |
| **Bug** | Errores a corregir |
| **Mejora** | Ideas de mejora |

:::tip
Puedes filtrar tareas por etiquetas en la vista de Lista, Kanban y Calendario. Combina filtros de área + etiqueta para búsquedas precisas.
:::
        `,
        relatedTopics: ['areas', 'create-task', 'task-filters']
      }
    ]
  },

  // =====================================================================
  // 7. RECORDATORIOS
  // =====================================================================
  {
    id: 'reminders',
    title: 'Recordatorios',
    icon: 'Bell',
    description: 'Configura alertas para no olvidar nada importante',
    subsections: [
      {
        id: 'create-reminder',
        title: 'Crear y gestionar recordatorios',
        icon: 'AlarmClock',
        difficulty: 'basic',
        readTime: 3,
        tags: ['recordatorio', 'alerta', 'notificación', 'recurrente'],
        content: `
## Crear y gestionar recordatorios

Los recordatorios te avisan antes de que una tarea venza o en cualquier momento que necesites.

### Crear un recordatorio

1. Abre una tarea existente
2. Ve a la sección **Recordatorios** (icono de campana)
3. Haz clic en **"+ Añadir recordatorio"**
4. Configura:

| Campo | Descripción |
|-------|-------------|
| **Fecha y hora** | Cuándo quieres recibir el aviso |
| **Recurrencia** | Si debe repetirse y con qué frecuencia |
| **Zona horaria** | Tu zona horaria (se configura en el perfil) |

5. Haz clic en **Guardar**

### Tipos de recurrencia

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **Una vez** | Aviso único | "Recordar el viernes a las 9:00" |
| **Diario** | Cada día a la misma hora | "Cada día a las 08:00" |
| **Semanal** | Cada semana en el mismo día | "Cada lunes a las 09:00" |
| **Personalizado** | Cada X días/semanas | "Cada 3 días" |

### Gestionar recordatorios

- **Desactivar**: Haz clic en el toggle para pausar un recordatorio sin eliminarlo
- **Eliminar**: Haz clic en el icono de basura para borrar el recordatorio
- **Editar**: Haz clic en el recordatorio para modificar fecha, hora o recurrencia

:::tip
Configura múltiples recordatorios para tareas importantes: uno con 2 días de antelación y otro el día del vencimiento.
:::

:::warning
Los recordatorios requieren que tengas las **notificaciones push** activadas en tu navegador. Ve a Ajustes > Notificaciones para verificar.
:::
        `,
        relatedTopics: ['faq-notifications', 'create-task', 'profile']
      }
    ]
  },

  // =====================================================================
  // 8. EQUIPOS
  // =====================================================================
  {
    id: 'teams',
    title: 'Equipos',
    icon: 'Users',
    moduleKey: 'teams',
    description: 'Organiza a tu personal en equipos de trabajo',
    subsections: [
      {
        id: 'teams-overview',
        title: 'Gestionar equipos',
        icon: 'UsersRound',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['equipos', 'grupo', 'miembros', 'organizar'],
        content: `
## Gestionar equipos

El módulo de **Equipos** te permite agrupar miembros en equipos de trabajo para asignar tareas y gestionar cargas de trabajo.

### Crear un equipo

:::admin
Solo los Owners, Admins y Managers pueden crear y gestionar equipos.
:::

1. Ve a **Equipos** en el sidebar
2. Haz clic en **"+ Nuevo equipo"**
3. Define:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre del equipo (ej: "Operaciones Madrid") |
| **Descripción** | Descripción del propósito del equipo |
| **Miembros** | Selecciona los miembros que formarán parte |

4. Haz clic en **Guardar**

### Gestionar miembros del equipo

1. Abre el equipo
2. En la sección de miembros:
   - **Añadir**: Busca y selecciona nuevos miembros
   - **Eliminar**: Haz clic en la X junto al miembro
3. Los cambios se guardan automáticamente

### Asignar tareas a equipos

Cuando creas o editas una tarea, puedes seleccionar un equipo completo como asignado. Todos los miembros del equipo serán notificados.

:::info
Un miembro puede pertenecer a **múltiples equipos** simultáneamente.
:::

:::tip
Los equipos son útiles para filtrar tareas en el Dashboard, la lista de tareas y los reportes.
:::
        `,
        relatedTopics: ['task-assign', 'admin-members', 'reports-team']
      }
    ]
  },

  // =====================================================================
  // 9. CONTROL DE TIEMPO
  // =====================================================================
  {
    id: 'time-tracking',
    title: 'Control de Tiempo',
    icon: 'Clock',
    moduleKey: 'time_tracking',
    description: 'Registra el tiempo dedicado a cada tarea',
    subsections: [
      {
        id: 'time-tracking-overview',
        title: 'Registrar tiempo',
        icon: 'Timer',
        difficulty: 'basic',
        readTime: 4,
        tags: ['tiempo', 'timer', 'registro', 'horas', 'cronómetro'],
        content: `
## Registrar tiempo

El módulo de **Control de Tiempo** te permite registrar cuánto tiempo dedicas a cada tarea.

### Usar el cronómetro

1. Abre una tarea
2. Haz clic en el botón de **cronómetro** (▶) en la parte superior
3. El timer comenzará a contar automáticamente
4. Cuando termines, haz clic en **Detener** (⏹)
5. El tiempo se guardará automáticamente

:::tip
El cronómetro sigue contando aunque navegues a otras secciones o cierres la pestaña. Se sincroniza cuando vuelvas.
:::

### Entrada manual

Si olvidaste iniciar el cronómetro, puedes añadir tiempo manualmente:

1. Abre la tarea
2. Ve a la sección **"Tiempo"**
3. Haz clic en **"+ Entrada manual"**
4. Define:

| Campo | Descripción |
|-------|-------------|
| **Fecha** | Día en que trabajaste |
| **Hora inicio** | Cuándo comenzaste |
| **Hora fin** | Cuándo terminaste |
| **Descripción** | Qué hiciste durante ese tiempo |

5. Guarda la entrada

### Ver resumen de tiempo

En la sección de **Control de Tiempo**:

- **Por tarea**: Tiempo total dedicado a cada tarea
- **Por día**: Horas trabajadas cada día
- **Por miembro**: Tiempo registrado por cada persona

:::info
Los administradores pueden ver el tiempo registrado por todos los miembros. Los miembros solo ven su propio tiempo.
:::

:::warning
El tiempo registrado no se puede modificar después de 48 horas sin permisos de admin.
:::
        `,
        relatedTopics: ['create-task', 'reports-personal']
      }
    ]
  },

  // =====================================================================
  // 10. RESERVAS
  // =====================================================================
  {
    id: 'reservations',
    title: 'Reservas',
    icon: 'CarFront',
    moduleKey: 'reservations',
    description: 'Gestiona entregas y devoluciones de vehículos',
    subsections: [
      {
        id: 'reservations-overview',
        title: 'Vista general de reservas',
        icon: 'Table',
        difficulty: 'intermediate',
        readTime: 5,
        tags: ['reservas', 'tabla', 'importar', 'excel', 'rently'],
        content: `
## Vista general de reservas

El módulo de reservas gestiona las entregas y devoluciones de vehículos del día.

### Tabla de reservas

La tabla principal muestra:

| Columna | Descripción |
|---------|-------------|
| **Código** | Identificador único de la reserva |
| **Cliente** | Nombre del cliente |
| **Vehículo** | Matrícula y modelo asignado |
| **Fecha entrega** | Cuándo se entrega al cliente |
| **Fecha devolución** | Cuándo el cliente devuelve |
| **Estado** | Estado de la operación |
| **Asignado (Rental)** | Empleado que gestiona documentación |
| **Asignado (Escoba)** | Empleado que prepara/recoge el vehículo |

### Importar reservas

Las reservas se pueden importar de dos formas:

1. **Archivo Excel (.xlsx)**:
   - Haz clic en **"Importar"** en la parte superior
   - Sube tu archivo con el formato requerido
   - Revisa la previsualización
   - Confirma la importación

2. **Sincronización automática (Rently)**:
   - Configurada por el administrador en **Ajustes > Integraciones**
   - Las reservas se sincronizan automáticamente cada cierto tiempo

:::warning
Al importar, las reservas existentes con el mismo código de reserva se **actualizarán automáticamente** con los nuevos datos. No se crean duplicados.
:::

:::admin
Solo los Owners y Admins pueden importar reservas y configurar la sincronización con sistemas externos.
:::

### Filtros

Filtra la tabla por:
- **Fecha**: Ver operaciones de un día específico
- **Tipo de operación**: Solo entregas o solo devoluciones
- **Estado**: Pendientes, en progreso, completadas
- **Asignado**: Tareas de un empleado específico
        `,
        relatedTopics: ['reservations-assignments', 'vehicle-overview']
      },
      {
        id: 'reservations-assignments',
        title: 'Asignar operaciones',
        icon: 'UserCheck',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['asignación', 'entrega', 'devolución', 'rental', 'escoba'],
        content: `
## Asignar operaciones de reserva

Cada reserva tiene dos operaciones principales que pueden tener personal asignado:

| Operación | Descripción | Responsable |
|-----------|-------------|-------------|
| **Entrega** | El cliente recoge el vehículo | Personal de rental + preparación |
| **Devolución** | El cliente devuelve el vehículo | Personal de recepción + preparación |

### Roles en cada operación

| Rol | Descripción |
|-----|-------------|
| **Rental** | Gestiona la documentación, contrato y llaves |
| **Escoba** | Prepara el vehículo (entrega) o lo recoge y limpia (devolución) |

### Pasos para asignar

1. En la tabla de reservas, localiza la reserva
2. Haz clic en la celda de **"Rental"** o **"Escoba"** de la operación correspondiente
3. Selecciona el empleado del menú desplegable
4. El cambio se guarda automáticamente

### Completar una operación

1. Cuando la operación se realiza, haz clic en **"Completar"**
2. El sistema registra la hora de finalización y quién la completó
3. El estado del vehículo se actualiza automáticamente

:::tip
Usa los filtros de fecha para ver solo las operaciones de **hoy** o **esta semana**, lo que facilita la planificación diaria.
:::

:::info
Cuando se completa una devolución, el vehículo pasa automáticamente a estado de "limpieza" si el módulo de vehículos está habilitado.
:::
        `,
        relatedTopics: ['reservations-overview', 'vehicle-overview']
      }
    ]
  },

  // =====================================================================
  // 11. ESTADO DE COCHES
  // =====================================================================
  {
    id: 'vehicles',
    title: 'Estado de Coches',
    icon: 'Car',
    moduleKey: 'vehicle_status',
    description: 'Gestiona el estado, limpieza y ubicación de tu flota',
    subsections: [
      {
        id: 'vehicle-overview',
        title: 'Vista general de vehículos',
        icon: 'LayoutGrid',
        difficulty: 'basic',
        readTime: 4,
        tags: ['vehículos', 'flota', 'estado', 'matrícula'],
        content: `
## Vista general de vehículos

Este módulo permite gestionar el estado de toda tu flota:

### Panel de vehículos

Cada vehículo se muestra como una tarjeta con:
- **Matrícula** y modelo
- **Estado actual** (indicador de color)
- **Ubicación** actual
- **Último cambio** de estado

### Estados de vehículos

| Estado | Descripción | Color |
|--------|-------------|-------|
| **Disponible** | Listo para asignar | 🟢 Verde |
| **En uso** | Actualmente asignado a un cliente | 🔵 Azul |
| **En limpieza** | Siendo preparado | 🟡 Amarillo |
| **En mantenimiento** | En taller o reparación | 🟠 Naranja |
| **En servicio** | En reparación activa (Garatech) | 🔴 Rojo |
| **Fuera de servicio** | No disponible temporalmente | ⚫ Gris |

### Filtros y búsqueda

- **Buscar por matrícula**: Escribe la matrícula en el buscador
- **Filtrar por estado**: Ver solo vehículos disponibles, en limpieza, etc.
- **Filtrar por ubicación**: Ver vehículos en una sede específica

:::info
El estado se actualiza automáticamente cuando se completan operaciones de reservas o se vinculan reparaciones activas.
:::
        `,
        relatedTopics: ['vehicle-cleaning', 'vehicle-daily-tasks', 'reservations-overview']
      },
      {
        id: 'vehicle-cleaning',
        title: 'Registrar limpieza',
        icon: 'Sparkles',
        difficulty: 'basic',
        readTime: 3,
        tags: ['limpieza', 'checklist', 'vehículo', 'preparación'],
        content: `
## Registrar limpieza de vehículo

Para marcar un vehículo como limpio:

1. Encuentra el vehículo en la lista (por matrícula o nombre)
2. Haz clic en el botón de **limpieza** (icono de escoba/sparkles)
3. Si hay un checklist configurado, completa todos los puntos
4. Confirma la operación

### El sistema registra automáticamente:

| Dato | Descripción |
|------|-------------|
| **Quién** | El usuario que registró la limpieza |
| **Cuándo** | Fecha y hora exacta |
| **Estado** | El vehículo pasa a "Disponible" |

:::tip
Usa la función de búsqueda rápida para identificar el vehículo por matrícula sin recorrer toda la lista.
:::

:::admin
Los administradores pueden configurar el checklist de limpieza personalizado en **Ajustes > Vehículos**. Esto garantiza que todos los pasos se cumplan antes de marcar como limpio.
:::
        `,
        relatedTopics: ['vehicle-overview', 'vehicle-daily-tasks']
      },
      {
        id: 'vehicle-daily-tasks',
        title: 'Tareas diarias de vehículos',
        icon: 'ListChecks',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['tareas diarias', 'plantilla', 'recurrente', 'vehículo'],
        content: `
## Tareas diarias de vehículos

Las **tareas diarias** son actividades recurrentes que deben realizarse cada día (o en días específicos de la semana).

### Crear una plantilla de tarea diaria

:::admin
Solo Owners, Admins y usuarios con permiso **vehicles.manage_daily_tasks** pueden crear plantillas.
:::

1. Ve a **Estado de Coches > Tareas diarias**
2. Haz clic en **"+ Nueva plantilla"**
3. Define:

| Campo | Descripción |
|-------|-------------|
| **Título** | Nombre de la tarea (ej: "Revisión niveles") |
| **Descripción** | Instrucciones detalladas |
| **Asignado** | Quién debe realizarla |
| **Días de la semana** | En qué días aplica (L-M-X-J-V-S-D) |

4. Guarda la plantilla

### Completar tareas diarias

1. Cada día, las tareas activas aparecen en la lista
2. Al completarla, haz clic en **"Marcar como completada"**
3. Opcionalmente, añade notas sobre la tarea

:::info
Las tareas diarias se reinician cada día automáticamente. El historial de completados se mantiene para consulta.
:::
        `,
        relatedTopics: ['vehicle-overview', 'vehicle-cleaning']
      }
    ]
  },

  // =====================================================================
  // 12. TRANSFERS
  // =====================================================================
  {
    id: 'transfers',
    title: 'Transfers',
    icon: 'Route',
    moduleKey: 'transfers',
    description: 'Gestiona trayectos, brokers y presupuestos de transfers',
    subsections: [
      {
        id: 'transfers-overview',
        title: 'Vista general de Transfers',
        icon: 'MapPin',
        difficulty: 'intermediate',
        readTime: 5,
        tags: ['transfers', 'trayectos', 'transporte', 'movimientos'],
        content: `
## Vista general de Transfers

El módulo de Transfers gestiona trayectos de vehículos o personas entre ubicaciones. Cada transfer es un **trayecto independiente**.

### Tabla de transfers

La tabla principal muestra:

| Columna | Descripción |
|---------|-------------|
| **Código** | Identificador único del transfer |
| **Origen** | Punto de partida |
| **Destino** | Punto de llegada |
| **Fecha** | Cuándo se realiza el trayecto |
| **Broker** | Empresa intermediaria (si aplica) |
| **Proveedor** | Empresa que ejecuta el transporte |
| **Estado** | Estado actual del transfer |
| **Precio** | Coste del trayecto (IVA incluido) |

### Estados del transfer

| Estado | Descripción |
|--------|-------------|
| **Pendiente** | Creado, sin asignar |
| **Presupuesto enviado** | Presupuesto enviado al broker para aprobación |
| **Aceptado** | Broker ha aceptado el presupuesto |
| **Rechazado** | Broker ha rechazado el presupuesto |
| **En curso** | Trayecto en ejecución |
| **Completado** | Trayecto finalizado |
| **Cancelado** | Trayecto cancelado |

:::info
Los precios se muestran **con IVA incluido (21%)** tanto en la tabla como en los documentos generados.
:::
        `,
        relatedTopics: ['transfers-create', 'transfers-brokers', 'transfers-budgets']
      },
      {
        id: 'transfers-create',
        title: 'Crear un transfer',
        icon: 'PlusCircle',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['crear', 'transfer', 'trayecto', 'nuevo'],
        content: `
## Crear un transfer

1. Ve a **Transfers** en el sidebar
2. Haz clic en **"+ Nuevo transfer"**
3. Completa los campos:

| Campo | Descripción | Obligatorio |
|-------|-------------|:-----------:|
| **Origen** | Punto de partida | ✅ |
| **Destino** | Punto de llegada | ✅ |
| **Fecha** | Fecha del trayecto | ✅ |
| **Hora** | Hora programada | ❌ |
| **Broker** | Empresa intermediaria | ❌ |
| **Proveedor** | Empresa ejecutora | ❌ |
| **Precio base** | Coste sin IVA | ❌ |
| **Notas** | Instrucciones adicionales | ❌ |

4. Haz clic en **Guardar**

### Importar transfers masivamente

:::admin
Solo Owners y Admins pueden importar transfers desde archivos Excel.
:::

1. Haz clic en **"Importar"** en la parte superior
2. Descarga la plantilla Excel si la necesitas
3. Sube tu archivo .xlsx con los datos
4. Revisa la previsualización y confirma

:::tip
Al cargar transfers con nombre de broker, el sistema **auto-resuelve** el ID del broker desde su nombre, asegurando que aparezcan correctamente en el portal de brokers.
:::
        `,
        relatedTopics: ['transfers-overview', 'transfers-brokers']
      },
      {
        id: 'transfers-brokers',
        title: 'Gestión de Brokers',
        icon: 'Building2',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['brokers', 'intermediarios', 'portal', 'registro'],
        content: `
## Gestión de Brokers

Los **Brokers** son empresas intermediarias que solicitan o gestionan transfers.

### Portal de Brokers

Los brokers tienen acceso a un **portal dedicado** donde pueden:

- Ver los transfers asignados a ellos
- Ver presupuestos cuando el estado es **"Presupuesto enviado"**
- **Aceptar** o **Rechazar** presupuestos
- Ver el historial de transfers completados

:::info
Los precios están **ocultos** para el broker hasta que el transfer alcanza el estado "Presupuesto enviado".
:::

### Registro de Brokers

Los brokers pueden registrarse a través de un formulario público:

1. El broker accede al enlace de registro proporcionado
2. Completa sus datos (nombre, empresa, email, teléfono)
3. La solicitud queda **pendiente de aprobación**
4. Un administrador revisa y aprueba/rechaza la solicitud

:::admin
Para gestionar solicitudes de registro de brokers, ve a **Ajustes > Brokers**. Puedes aprobar, rechazar o ver detalles de cada solicitud.
:::

### Notificaciones de Transfers

Cuando se crea un nuevo transfer, se notifica automáticamente a los usuarios con permiso **transfers.manage**.
        `,
        relatedTopics: ['transfers-overview', 'transfers-budgets', 'transfers-create']
      },
      {
        id: 'transfers-budgets',
        title: 'Presupuestos y precios',
        icon: 'Receipt',
        difficulty: 'advanced',
        readTime: 4,
        tags: ['presupuestos', 'precios', 'IVA', 'facturación'],
        content: `
## Presupuestos y precios

### Gestión de precios

Cada transfer tiene un precio que se muestra **con IVA incluido (21%)**:

| Campo | Descripción |
|-------|-------------|
| **Precio base** | Coste sin IVA |
| **IVA (21%)** | Calculado automáticamente |
| **Precio total** | Precio base × 1.21 |

### Flujo de presupuesto

1. **Crear transfer** con precio base
2. **Enviar presupuesto** al broker → Estado cambia a "Presupuesto enviado"
3. El broker ve el precio en su portal y puede:
   - **Aceptar**: El transfer pasa a "Aceptado"
   - **Rechazar**: El transfer pasa a "Rechazado" con motivo

### Generar documentos

Puedes generar documentos PDF de presupuestos:

1. Abre el transfer
2. Haz clic en **"Generar presupuesto PDF"**
3. El documento incluye: datos del broker, origen, destino, precio con IVA desglosado

:::warning
Una vez enviado el presupuesto al broker, el precio **no se puede modificar** sin rechazar y crear un nuevo presupuesto.
:::

:::tip
Revisa los precios antes de enviar el presupuesto. Los errores de precio requieren rechazar y recrear el presupuesto.
:::
        `,
        relatedTopics: ['transfers-overview', 'transfers-brokers']
      },
      {
        id: 'transfers-forms',
        title: 'Formularios públicos de Transfers',
        icon: 'FileText',
        difficulty: 'advanced',
        readTime: 3,
        tags: ['formularios', 'público', 'solicitud', 'transfer'],
        content: `
## Formularios públicos de Transfers

Puedes crear formularios públicos para que personas externas soliciten transfers:

### Crear formulario de solicitud

:::admin
Solo Owners y Admins pueden crear y gestionar formularios públicos.
:::

1. Ve a **Formularios** en el sidebar
2. Haz clic en **"+ Nuevo formulario"**
3. Selecciona tipo **"Transfer"** como entidad
4. Configura los campos necesarios (origen, destino, fecha, etc.)
5. Activa la opción **"Público"**
6. Copia el enlace generado y compártelo

### Cuando alguien envía el formulario

1. La respuesta aparece en **Formularios > Respuestas**
2. Según la configuración, puede crear automáticamente un transfer o una solicitud pendiente de revisión
3. Se notifica a los usuarios con permiso **transfers.manage**

:::info
Los formularios públicos no requieren autenticación. Cualquier persona con el enlace puede enviar una solicitud.
:::
        `,
        relatedTopics: ['transfers-create', 'forms-overview']
      }
    ]
  },

  // =====================================================================
  // 13. GARATECH
  // =====================================================================
  {
    id: 'garatech',
    title: 'Garatech',
    icon: 'Wrench',
    moduleKey: 'garatech',
    description: 'Gestión de talleres, reparaciones, accidentes e informes de daños',
    subsections: [
      {
        id: 'garatech-dashboard',
        title: 'Dashboard de Garatech',
        icon: 'LayoutDashboard',
        difficulty: 'basic',
        readTime: 3,
        tags: ['garatech', 'dashboard', 'taller', 'resumen'],
        content: `
## Dashboard de Garatech

El Dashboard de Garatech ofrece una vista general del estado del taller y la flota:

### Métricas principales

| Métrica | Descripción |
|---------|-------------|
| **Reparaciones activas** | Vehículos actualmente en taller |
| **Accidentes abiertos** | Accidentes pendientes de resolución |
| **Coste total mensual** | Gasto acumulado del mes |
| **Tiempo medio reparación** | Promedio de días en taller |

### Accesos rápidos

Desde el Dashboard puedes acceder directamente a:
- Crear nueva reparación
- Registrar accidente
- Ver informes de daños pendientes
- Consultar catálogo de daños

:::info
Necesitas el permiso **garatech.view** para acceder a esta sección. Para crear/editar registros necesitas **garatech.manage** o los permisos específicos de cada módulo.
:::
        `,
        relatedTopics: ['garatech-repairs', 'garatech-accidents', 'garatech-damage-reports']
      },
      {
        id: 'garatech-repairs',
        title: 'Reparaciones',
        icon: 'Hammer',
        difficulty: 'intermediate',
        readTime: 6,
        tags: ['reparaciones', 'taller', 'vehículo', 'presupuesto', 'factura'],
        content: `
## Reparaciones

Las reparaciones gestionan el ciclo completo de un vehículo en taller.

### Crear una reparación

1. Ve a **Garatech > Reparaciones**
2. Haz clic en **"+ Nueva reparación"**
3. Se abre una página dedicada con los campos:

| Campo | Descripción | Obligatorio |
|-------|-------------|:-----------:|
| **Vehículo** | Selecciona el vehículo | ✅ |
| **Taller** | Dónde se realizará | ✅ |
| **Tipo** | Mecánica, carrocería, eléctrica, etc. | ✅ |
| **Descripción** | Detalle del problema | ✅ |
| **Fecha entrada** | Cuándo entra al taller | ✅ |
| **Presupuesto** | Coste estimado | ❌ |
| **Notas** | Información adicional | ❌ |

4. Haz clic en **"Guardar"**

### Flujo de 6 estados

| # | Estado | Descripción |
|---|--------|-------------|
| 1 | **Registrada** | Reparación creada, pendiente de taller |
| 2 | **En espera** | En cola del taller |
| 3 | **En progreso** | Taller trabajando en el vehículo |
| 4 | **Presupuesto** | Taller ha enviado presupuesto, pendiente de aprobación |
| 5 | **Facturada** | Reparación completada, factura emitida |
| 6 | **Cerrada** | Proceso finalizado, vehículo devuelto |

### Cambiar el estado

1. Abre la reparación
2. Haz clic en el botón de estado en la parte superior
3. Selecciona el nuevo estado
4. Añade notas si es necesario

:::warning
Cuando una reparación está en estados 2 a 4 (activa), el vehículo se marca automáticamente como **"En servicio"**, bloqueándolo para asignaciones de reservas.
:::

### Gestión de documentos

Puedes adjuntar documentos a cada reparación:
- **Fotos**: Antes y después del daño
- **Presupuestos**: PDF del taller
- **Facturas**: Documentos de cobro
- **Otros**: Cualquier documento relevante

1. Abre la reparación
2. Ve a la sección **"Documentos"**
3. Arrastra archivos o haz clic en **"Subir"**

:::admin
Para gestionar reparaciones necesitas el permiso **garatech.manage** o **garatech.manage_repairs**.
:::
        `,
        relatedTopics: ['garatech-dashboard', 'garatech-workshops', 'garatech-accidents']
      },
      {
        id: 'garatech-accidents',
        title: 'Accidentes',
        icon: 'AlertTriangle',
        difficulty: 'intermediate',
        readTime: 5,
        tags: ['accidentes', 'siniestro', 'seguro', 'terceros', 'partes'],
        content: `
## Accidentes

El módulo de accidentes gestiona el registro completo de siniestros, incluyendo datos de terceros y seguros.

### Registrar un accidente

1. Ve a **Garatech > Accidentes**
2. Haz clic en **"+ Nuevo accidente"**
3. Se abre una página dedicada con los campos:

| Campo | Descripción | Obligatorio |
|-------|-------------|:-----------:|
| **Vehículo** | Vehículo involucrado | ✅ |
| **Fecha del accidente** | Cuándo ocurrió | ✅ |
| **Ubicación** | Dónde ocurrió | ❌ |
| **Descripción** | Relato de los hechos | ✅ |
| **Severidad** | Leve, moderado, grave | ✅ |
| **¿Hay heridos?** | Si hubo lesiones personales | ✅ |
| **Informe policial** | Número de parte policial | ❌ |

### Datos de terceros

Si hubo otro vehículo involucrado:

| Campo | Descripción |
|-------|-------------|
| **Nombre tercero** | Nombre del conductor/propietario |
| **Teléfono** | Contacto del tercero |
| **Matrícula** | Placa del otro vehículo |
| **Vehículo** | Marca y modelo |
| **Seguro** | Compañía de seguros |
| **Nº Póliza** | Número de póliza |

### Datos del seguro propio

| Campo | Descripción |
|-------|-------------|
| **Nº Reclamación** | Número del siniestro/reclamación |
| **Cobertura** | Monto cubierto por el seguro |
| **Valoración de culpa** | Nuestra, del tercero, compartida |
| **Coste estimado** | Coste total de los daños |

### Vincular con reparación

Si el accidente requiere reparación:

1. En la ficha del accidente, busca la sección **"Reparación vinculada"**
2. Haz clic en **"Vincular reparación"**
3. Selecciona una reparación existente o crea una nueva

### Documentos y fotos

Adjunta evidencias del accidente:
- Fotos del vehículo propio
- Fotos del vehículo tercero
- Parte amistoso
- Informe policial
- Documentación del seguro

:::admin
Para gestionar accidentes necesitas el permiso **garatech.manage_accidents**.
:::

:::tip
Registra el accidente lo antes posible con todos los datos disponibles. Puedes actualizar la información más tarde si es necesario.
:::
        `,
        relatedTopics: ['garatech-repairs', 'garatech-damage-reports', 'garatech-dashboard']
      },
      {
        id: 'garatech-workshops',
        title: 'Gestión de Talleres',
        icon: 'Factory',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['talleres', 'proveedores', 'mecánico', 'carrocería'],
        content: `
## Gestión de Talleres

Mantén un directorio de talleres con los que trabaja tu organización.

### Añadir un taller

1. Ve a **Garatech > Talleres**
2. Haz clic en **"+ Nuevo taller"**
3. Completa:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre del taller |
| **Dirección** | Ubicación física |
| **Teléfono** | Número de contacto |
| **Email** | Correo electrónico |
| **Especialidad** | Mecánica, carrocería, eléctrica, etc. |
| **Notas** | Observaciones (horarios, contacto, etc.) |

### Asignar taller a reparaciones

Al crear o editar una reparación, selecciona el taller del directorio. Esto permite:
- Llevar un historial de reparaciones por taller
- Comparar costes entre talleres
- Evaluar tiempos de reparación

:::admin
Solo usuarios con permiso **garatech.manage_workshops** pueden añadir o editar talleres.
:::
        `,
        relatedTopics: ['garatech-repairs', 'garatech-dashboard']
      },
      {
        id: 'garatech-damage-reports',
        title: 'Informes de Daños',
        icon: 'FileWarning',
        difficulty: 'advanced',
        readTime: 5,
        tags: ['daños', 'informe', 'peritaje', 'catálogo', 'zonas'],
        content: `
## Informes de Daños

Los informes de daños documentan los desperfectos de un vehículo de forma detallada, con valoración económica.

### Crear un informe de daños

1. Ve a **Garatech > Informes de Daños**
2. Haz clic en **"+ Nuevo informe"**
3. Completa los datos generales:

| Campo | Descripción |
|-------|-------------|
| **Vehículo** | Vehículo dañado |
| **Fecha del daño** | Cuándo se detectó |
| **Cliente** | Nombre del responsable (si aplica) |
| **Documento cliente** | DNI/Pasaporte del cliente |
| **Reserva** | Reserva vinculada (si aplica) |

### Añadir ítems de daño

Cada informe tiene una lista de daños encontrados:

1. Haz clic en **"+ Añadir daño"**
2. Selecciona el daño del **Catálogo de daños** o escribe una descripción personalizada
3. Define:
   - **Ubicación en el vehículo**: Zona del impacto (7 zonas × ~35 piezas)
   - **Nivel de severidad**: 1 a 5 (determina el precio)
   - **Cantidad**: Número de unidades dañadas
   - **Fotos**: Evidencia fotográfica

### Zonas del vehículo

Los daños se clasifican en 7 zonas principales:

| Zona | Piezas ejemplo |
|------|----------------|
| **Frontal** | Parachoques, capó, faros, parrilla |
| **Trasera** | Parachoques, maletero, pilotos |
| **Lateral izquierdo** | Puertas, espejo, molduras |
| **Lateral derecho** | Puertas, espejo, molduras |
| **Techo** | Techo, antena, barras |
| **Interior** | Asientos, tablero, volante |
| **Mecánica** | Motor, transmisión, frenos |

### Cobro de daños

Una vez completado el informe:

1. Revisa el **total calculado** (basado en el catálogo de precios)
2. Cambia el estado a **"Cobrar"**
3. Registra el monto cobrado y notas de cobro
4. Genera el **PDF del informe** para entregarlo al cliente

:::admin
Para gestionar informes de daños necesitas el permiso **garatech.manage_damage_reports**. Para gestionar el catálogo de precios: **garatech.manage_catalog**.
:::
        `,
        relatedTopics: ['garatech-damage-catalog', 'garatech-repairs', 'garatech-accidents']
      },
      {
        id: 'garatech-damage-catalog',
        title: 'Catálogo de daños',
        icon: 'BookOpen',
        difficulty: 'advanced',
        readTime: 3,
        tags: ['catálogo', 'precios', 'niveles', 'peritaje'],
        content: `
## Catálogo de daños

El catálogo define los tipos de daños posibles y sus precios según el nivel de severidad.

### Estructura del catálogo

Cada entrada tiene:

| Campo | Descripción |
|-------|-------------|
| **Nombre (ES)** | Descripción del daño en español |
| **Nombre (EN)** | Descripción en inglés (opcional) |
| **Categoría** | Tipo de daño (rayaduras, abolladuras, etc.) |
| **Precio Nivel 1** | Daño leve |
| **Precio Nivel 2** | Daño menor |
| **Precio Nivel 3** | Daño moderado |
| **Precio Nivel 4** | Daño importante |
| **Precio Nivel 5** | Daño severo |

### Gestionar el catálogo

:::admin
Solo usuarios con permiso **garatech.manage_catalog** pueden modificar el catálogo.
:::

1. Ve a **Garatech > Catálogo**
2. Para añadir: haz clic en **"+ Nuevo ítem"**
3. Para editar: haz clic en el ítem y modifica los campos
4. Para desactivar: desactiva el toggle de "Activo"

:::tip
Mantén el catálogo actualizado con precios de mercado. Los cambios en los precios solo afectan a **nuevos** informes de daños, no a los ya creados.
:::

:::warning
Desactivar un ítem del catálogo no lo elimina de los informes existentes que ya lo usan. Solo evita que se seleccione en nuevos informes.
:::
        `,
        relatedTopics: ['garatech-damage-reports', 'garatech-dashboard']
      }
    ]
  },

  // =====================================================================
  // 14. AUTOMATIZACIONES
  // =====================================================================
  {
    id: 'automations',
    title: 'Automatizaciones',
    icon: 'Zap',
    moduleKey: 'automations',
    description: 'Configura reglas automáticas para reducir trabajo manual',
    subsections: [
      {
        id: 'automations-overview',
        title: 'Crear reglas de automatización',
        icon: 'Workflow',
        difficulty: 'advanced',
        readTime: 6,
        tags: ['automatización', 'regla', 'trigger', 'acción', 'condición'],
        content: `
## Crear reglas de automatización

Las automatizaciones ejecutan acciones cuando se cumplen ciertas condiciones, ahorrándote trabajo repetitivo.

### Crear una regla

:::admin
Solo Owners, Admins y usuarios con permiso **automations.manage** pueden crear reglas.
:::

1. Ve a **Automatizaciones** en el sidebar
2. Haz clic en **"+ Nueva regla"**
3. Configura los tres componentes:

### 1. Trigger (Disparador)

Define **cuándo** se activa la regla:

| Trigger | Descripción |
|---------|-------------|
| **Tarea creada** | Cuando se crea una nueva tarea |
| **Tarea actualizada** | Cuando cambia algún campo de una tarea |
| **Estado cambiado** | Cuando una tarea cambia de estado |
| **Tarea vencida** | Cuando una tarea pasa su fecha límite |
| **Reserva importada** | Cuando se importan nuevas reservas |

### 2. Condiciones (Opcional)

Filtra **en qué casos** se ejecuta:

| Condición | Ejemplo |
|-----------|---------|
| **Área** | Solo si la tarea es del área "Operaciones" |
| **Prioridad** | Solo si la prioridad es "Alta" o "Urgente" |
| **Estado** | Solo si cambia a "Completada" |
| **Asignado** | Solo si está asignada a un usuario específico |

### 3. Acciones

Define **qué hace** la regla:

| Acción | Descripción |
|--------|-------------|
| **Notificar** | Enviar notificación a un usuario o rol |
| **Cambiar estado** | Cambiar el estado de la tarea |
| **Asignar** | Asignar a un usuario específico |
| **Crear tarea** | Crear una tarea hija o relacionada |
| **Enviar email** | Enviar email a una dirección |

### Throttle (Control de frecuencia)

Para evitar ejecuciones excesivas:

| Opción | Descripción |
|--------|-------------|
| **Sin límite** | Se ejecuta siempre que se cumple |
| **Cada X minutos** | Máximo una ejecución cada X minutos por entidad |

### Historial de ejecuciones

En cada regla puedes ver el historial de ejecuciones:
- Cuándo se ejecutó
- Qué entidad la disparó
- Si fue exitosa o falló
- Mensaje de error (si lo hay)

:::tip
Empieza con reglas simples y ve añadiendo complejidad. Activa/desactiva reglas con el toggle sin necesidad de eliminarlas.
:::

:::warning
Las automatizaciones se ejecutan en segundo plano. Si una regla tiene un error, puede pasar desapercibida. Revisa el historial periódicamente.
:::
        `,
        relatedTopics: ['create-task', 'task-status', 'admin-modules']
      }
    ]
  },

  // =====================================================================
  // 15. REPORTES
  // =====================================================================
  {
    id: 'reports',
    title: 'Reportes',
    icon: 'BarChart2',
    moduleKey: 'reports',
    description: 'Informes y estadísticas de rendimiento',
    subsections: [
      {
        id: 'reports-overview',
        title: 'Vista general de reportes',
        icon: 'PieChart',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['reportes', 'estadísticas', 'gráficos', 'informes'],
        content: `
## Vista general de reportes

Los reportes proporcionan estadísticas detalladas sobre el rendimiento de tu organización.

### Tipos de reportes

| Reporte | Qué muestra |
|---------|-------------|
| **General** | Resumen de toda la actividad |
| **Personal** | Tu rendimiento individual |
| **Por áreas** | Estadísticas por cada área |
| **Por equipo** | Rendimiento de cada equipo |
| **Vehículos** | Estado y métricas de la flota |

### Métricas comunes

| Métrica | Descripción |
|---------|-------------|
| **Tareas creadas** | Número de tareas creadas en el periodo |
| **Tareas completadas** | Tareas finalizadas satisfactoriamente |
| **Tasa de cumplimiento** | % de tareas completadas a tiempo |
| **Tiempo medio resolución** | Promedio de días para completar |
| **Distribución por prioridad** | Cuántas tareas por cada prioridad |

### Filtros de periodo

Selecciona el rango de fechas:
- Hoy
- Esta semana
- Este mes
- Último trimestre
- Personalizado (selecciona fechas)

### Exportar

Puedes exportar los reportes en formato:
- **PDF**: Para presentaciones e impresión
- **Excel (.xlsx)**: Para análisis adicional

:::info
Los reportes se generan con los datos visibles según tu rol. Un admin ve datos de toda la organización; un member solo ve sus propios datos.
:::

:::tip
Programa revisiones semanales de reportes para identificar tendencias y ajustar prioridades.
:::
        `,
        relatedTopics: ['dashboard-overview', 'teams-overview', 'time-tracking-overview']
      }
    ]
  },

  // =====================================================================
  // 16. PLANTILLAS
  // =====================================================================
  {
    id: 'templates',
    title: 'Plantillas',
    icon: 'FileStack',
    moduleKey: 'templates',
    description: 'Crea y reutiliza plantillas de tareas',
    subsections: [
      {
        id: 'templates-overview',
        title: 'Usar plantillas de tareas',
        icon: 'Copy',
        difficulty: 'intermediate',
        readTime: 4,
        tags: ['plantillas', 'templates', 'reutilizar', 'comunidad'],
        content: `
## Usar plantillas de tareas

Las plantillas permiten crear tareas predefinidas para procesos recurrentes.

### Crear una plantilla

1. Ve a **Plantillas** en el sidebar
2. Haz clic en **"+ Nueva plantilla"**
3. Define la estructura de la tarea:
   - Título, descripción, tipo
   - Subtareas predefinidas (para tipo Hitos)
   - Prioridad por defecto
   - Área sugerida

4. Guarda la plantilla

### Crear tarea desde plantilla

1. Al crear una nueva tarea, haz clic en **"Desde plantilla"**
2. Selecciona la plantilla deseada
3. Los campos se rellenan automáticamente
4. Ajusta los valores si es necesario
5. Guarda la tarea

### Plantillas de la comunidad

Accede a plantillas compartidas por otros usuarios de PlanMint:

1. Ve a **Plantillas > Comunidad**
2. Busca por categoría o palabra clave
3. Haz clic en **"Importar"** para añadirla a tu organización

### Compartir plantillas

Para compartir una plantilla con la comunidad:

1. Abre la plantilla
2. Haz clic en **"Compartir con la comunidad"**
3. Define una descripción y categoría
4. Envía para revisión

:::tip
Las plantillas son ideales para procesos de onboarding, checklists recurrentes, y flujos de trabajo estandarizados.
:::

:::admin
Los administradores pueden gestionar qué plantillas están disponibles para la organización y cuáles se comparten externamente.
:::
        `,
        relatedTopics: ['create-task', 'task-types']
      }
    ]
  },

  // =====================================================================
  // 17. FORMULARIOS
  // =====================================================================
  {
    id: 'forms',
    title: 'Formularios',
    icon: 'ClipboardEdit',
    moduleKey: 'forms',
    description: 'Crea formularios para recopilar datos internos y externos',
    subsections: [
      {
        id: 'forms-overview',
        title: 'Crear y gestionar formularios',
        icon: 'FormInput',
        difficulty: 'advanced',
        readTime: 6,
        tags: ['formularios', 'forms', 'público', 'campos', 'respuestas'],
        content: `
## Crear y gestionar formularios

Los formularios permiten recopilar datos de forma estructurada, tanto de miembros internos como de personas externas.

### Crear un formulario

:::admin
Solo Owners y Admins pueden crear formularios.
:::

1. Ve a **Formularios** en el sidebar
2. Haz clic en **"+ Nuevo formulario"**
3. Configura:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Título del formulario |
| **Descripción** | Instrucciones para quien lo complete |
| **Tipo de entidad** | Tarea o Transfer (qué se crea al enviar) |
| **Público** | Si es accesible sin autenticación |
| **Activo** | Si acepta respuestas |
| **Máximo respuestas** | Límite de envíos (opcional) |
| **Fecha expiración** | Hasta cuándo acepta respuestas |

### Tipos de campos disponibles

| Tipo | Descripción |
|------|-------------|
| **Texto** | Campo de texto simple |
| **Texto largo** | Área de texto multilínea |
| **Número** | Solo valores numéricos |
| **Email** | Validación de formato email |
| **Teléfono** | Campo de teléfono |
| **Fecha** | Selector de fecha |
| **Selección** | Menú desplegable con opciones |
| **Checkbox** | Casilla de verificación |
| **Archivo** | Subida de archivos |

### Mapeo de campos

Puedes mapear campos del formulario a campos de tareas o transfers:
- **maps_to_task_field**: El valor del campo se usará como título, descripción, etc. de la tarea creada
- **maps_to_transfer_field**: El valor se asigna al campo correspondiente del transfer

### Personalización visual

| Opción | Descripción |
|--------|-------------|
| **Color principal** | Color del botón de envío |
| **Logo personalizado** | Logo que se muestra en el formulario |
| **Mensaje de éxito** | Texto mostrado después de enviar |
| **URL de redirección** | A dónde redirigir tras el envío |

### Ver respuestas

1. Ve al formulario
2. Haz clic en la pestaña **"Respuestas"**
3. Revisa cada respuesta con sus datos
4. Aprueba o rechaza según sea necesario

:::tip
Comparte el enlace del formulario público por email, redes sociales o incrústalo en tu sitio web.
:::

:::warning
Los formularios públicos no requieren autenticación. Ten cuidado con los datos sensibles y configura un límite de respuestas si es necesario.
:::
        `,
        relatedTopics: ['transfers-forms', 'create-task']
      }
    ]
  },

  // =====================================================================
  // 18. NOTIFICACIONES
  // =====================================================================
  {
    id: 'notifications',
    title: 'Notificaciones',
    icon: 'BellRing',
    description: 'Centro de notificaciones y configuración de alertas',
    subsections: [
      {
        id: 'notifications-center',
        title: 'Centro de notificaciones',
        icon: 'Inbox',
        difficulty: 'basic',
        readTime: 3,
        tags: ['notificaciones', 'centro', 'alertas', 'campana'],
        content: `
## Centro de notificaciones

Las notificaciones te mantienen informado sobre la actividad relevante.

### Acceder a las notificaciones

1. Haz clic en el **icono de campana** (🔔) en la parte superior
2. Se abre el panel de notificaciones con las más recientes
3. Las no leídas tienen un **indicador azul**

### Tipos de notificaciones

| Tipo | Cuándo se genera |
|------|-----------------|
| **Asignación** | Te asignan una tarea |
| **Mención** | Te mencionan en un comentario |
| **Vencimiento** | Una tarea asignada está por vencer |
| **Estado** | Cambia el estado de una tarea tuya |
| **Recordatorio** | Se activa un recordatorio configurado |
| **Transfer** | Se crea o modifica un transfer (si tienes permiso) |
| **Automatización** | Una regla se ejecuta sobre una entidad tuya |

### Acciones sobre notificaciones

- **Marcar como leída**: Haz clic en la notificación
- **Marcar todas como leídas**: Botón en la parte superior
- **Ir a la entidad**: Haz clic para abrir la tarea/transfer/etc.

### Canales de notificación

Las notificaciones se envían por los canales que hayas configurado:

| Canal | Descripción |
|-------|-------------|
| **In-app** | Dentro de la aplicación (campana) |
| **Push** | Notificación del navegador/dispositivo |
| **Email** | Correo electrónico |
| **Slack** | Mensaje en Slack (si está configurado) |
| **WhatsApp** | Mensaje de WhatsApp (si está configurado) |

:::tip
Configura tus canales preferidos en **Ajustes > Notificaciones** para recibir solo lo que necesitas, por donde lo necesitas.
:::
        `,
        relatedTopics: ['notifications-preferences', 'faq-notifications', 'profile']
      },
      {
        id: 'notifications-preferences',
        title: 'Configurar preferencias',
        icon: 'SlidersHorizontal',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['preferencias', 'configurar', 'silencio', 'horario'],
        content: `
## Configurar preferencias de notificación

Personaliza qué notificaciones recibes y cómo:

1. Ve a **Ajustes > Notificaciones**
2. Configura:

### Canales activos

Activa/desactiva cada canal de notificación:
- ✅ In-app (siempre activo)
- Push (requiere permiso del navegador)
- Email
- Slack (requiere integración)
- WhatsApp (requiere integración)

### Eventos

Para cada tipo de evento, decide si quieres recibir notificación:
- Asignaciones de tareas
- Cambios de estado
- Vencimientos próximos
- Comentarios y menciones
- Nuevos transfers
- Ejecuciones de automatizaciones

### Horario silencioso

Define un rango horario en el que **no** recibirás notificaciones push ni email:

1. Activa **"Horario silencioso"**
2. Define hora de inicio (ej: 22:00)
3. Define hora de fin (ej: 08:00)
4. Selecciona tu zona horaria

:::info
Las notificaciones in-app se acumulan incluso durante el horario silencioso. Las verás cuando abras la aplicación.
:::

:::tip
Configura el horario silencioso para no recibir alertas fuera del horario laboral.
:::
        `,
        relatedTopics: ['notifications-center', 'profile']
      }
    ]
  },

  // =====================================================================
  // 19. ADMINISTRACIÓN
  // =====================================================================
  {
    id: 'administration',
    title: 'Administración',
    icon: 'Settings',
    description: 'Gestión de miembros, roles, permisos y configuración de la organización',
    subsections: [
      {
        id: 'admin-members',
        title: 'Gestionar miembros',
        icon: 'UserCog',
        difficulty: 'intermediate',
        readTime: 5,
        tags: ['miembros', 'usuarios', 'invitar', 'gestionar', 'equipo'],
        content: `
## Gestionar miembros

:::admin
Esta sección solo está disponible para Owners y Admins.
:::

### Ver miembros actuales

1. Ve a **Ajustes > Miembros**
2. Verás la lista con:

| Columna | Descripción |
|---------|-------------|
| **Nombre** | Nombre del miembro |
| **Email** | Correo electrónico |
| **Rol** | Rol asignado (Owner, Admin, Manager, Member) |
| **Estado** | Activo, pendiente de aceptación |
| **Fecha registro** | Cuándo se unió |

### Invitar un nuevo miembro

1. Haz clic en **"+ Invitar miembro"**
2. Introduce el **email** de la persona
3. Selecciona el **rol** que tendrá
4. Haz clic en **"Enviar invitación"**

El invitado recibirá un email con un enlace para crear su cuenta y unirse a la organización.

### Cambiar el rol de un miembro

1. En la lista de miembros, haz clic en el menú de opciones (⋯) del miembro
2. Selecciona **"Cambiar rol"**
3. Elige el nuevo rol
4. Confirma el cambio

:::warning
Cambiar el rol de un miembro afecta inmediatamente a sus permisos. El miembro verá los cambios en su próxima acción.
:::

### Desactivar un miembro

Para impedir el acceso sin eliminar el registro:

1. Haz clic en el menú de opciones (⋯)
2. Selecciona **"Desactivar"**
3. El miembro no podrá iniciar sesión hasta ser reactivado

:::tip
Desactivar es preferible a eliminar: mantiene el historial de actividad y permite reactivar en el futuro.
:::
        `,
        relatedTopics: ['admin-custom-roles', 'admin-permissions', 'roles-overview']
      },
      {
        id: 'admin-custom-roles',
        title: 'Roles personalizados',
        icon: 'ShieldCheck',
        difficulty: 'advanced',
        readTime: 5,
        tags: ['roles', 'personalizado', 'custom', 'permisos', 'granular'],
        content: `
## Roles personalizados

:::admin
Solo Owners y Admins pueden crear roles personalizados.
:::

Los roles personalizados te permiten definir combinaciones específicas de permisos que no se ajustan a los roles predefinidos.

### Crear un rol personalizado

1. Ve a **Ajustes > Roles personalizados**
2. Haz clic en **"+ Nuevo rol"**
3. Define:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre descriptivo (ej: "Supervisor de flota") |
| **Descripción** | Para qué se usa este rol |
| **Permisos** | Selecciona los permisos específicos |

### Categorías de permisos

Los permisos se agrupan por módulo:

| Módulo | Permisos disponibles |
|--------|---------------------|
| **Tareas** | Ver, crear, editar, eliminar, asignar, cambiar estado, gestionar columnas |
| **Áreas** | Ver, crear, editar, gestionar acceso |
| **Equipos** | Ver, crear, gestionar miembros |
| **Reservas** | Ver, crear, gestionar |
| **Vehículos** | Ver, gestionar estado, gestionar tareas diarias |
| **Transfers** | Ver, crear, editar, eliminar, gestionar brokers, gestionar proveedores, presupuestos |
| **Garatech** | Ver, gestionar reparaciones, accidentes, talleres, informes de daños, catálogo |
| **Automatizaciones** | Ver, gestionar reglas |
| **Formularios** | Ver, crear, gestionar |
| **Control de tiempo** | Ver, gestionar entradas |

### Asignar rol personalizado

1. Ve a **Ajustes > Miembros**
2. Edita el miembro
3. En el campo de rol, selecciona el rol personalizado

:::warning
Si eliminas un rol personalizado, los miembros que lo tenían pasarán al rol **Member** por defecto.
:::

:::tip
Crea roles personalizados para posiciones específicas: "Coordinador de limpieza", "Gestor de talleres", "Responsable de transfers", etc.
:::
        `,
        relatedTopics: ['admin-members', 'admin-permissions', 'roles-overview']
      },
      {
        id: 'admin-permissions',
        title: 'Permisos individuales (Overrides)',
        icon: 'KeyRound',
        difficulty: 'advanced',
        readTime: 5,
        tags: ['permisos', 'override', 'individual', 'excepción', 'granular'],
        content: `
## Permisos individuales (Overrides)

:::admin
Solo Owners y Admins pueden configurar permisos individuales.
:::

Los **overrides** permiten otorgar o revocar permisos específicos a un miembro, sin cambiar su rol.

### Ejemplo de uso

Jordan es **Member** (permisos limitados), pero necesita poder:
- Crear tareas → Override: **tasks.create = ✅**
- Asignar tareas → Override: **tasks.assign = ✅**
- Editar sus tareas → Override: **tasks.update = ✅**

Esto le da permisos adicionales **sin** cambiar su rol de Member.

### Configurar overrides

1. Ve a **Ajustes > Miembros**
2. Haz clic en el miembro
3. Ve a la pestaña **"Permisos individuales"**
4. Para cada permiso:
   - **Sin override** (—): Usa el permiso del rol
   - **Conceder** (✅): El miembro tiene este permiso
   - **Revocar** (❌): El miembro NO tiene este permiso, aunque su rol lo incluya

### Modelo de vínculo estricto

Para tareas, los overrides siguen un modelo de **vínculo estricto**:

:::info
Un Member con override de **tasks.update** solo puede editar tareas en las que es **participante** (creador, asignado directo, o multi-asignado). No puede editar TODAS las tareas de la organización.
:::

Esto significa:
- **tasks.update** → Editar tareas donde eres participante
- **tasks.delete** → Eliminar tareas donde eres participante
- **tasks.assign** → Gestionar asignaciones de tareas donde eres participante

### Prioridad de permisos

1. Override individual (máxima prioridad)
2. Rol personalizado
3. Rol predefinido (mínima prioridad)

:::warning
Los overrides individuales siempre tienen prioridad sobre el rol. Si revocas un permiso que el rol incluye, el miembro perderá ese acceso.
:::

:::tip
Usa overrides para casos excepcionales. Para permisos que aplican a un grupo, mejor crea un rol personalizado.
:::
        `,
        relatedTopics: ['admin-members', 'admin-custom-roles', 'roles-overview']
      },
      {
        id: 'admin-modules',
        title: 'Gestionar módulos',
        icon: 'Puzzle',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['módulos', 'habilitar', 'desactivar', 'funciones'],
        content: `
## Gestionar módulos

:::admin
Solo Owners y Admins pueden habilitar/deshabilitar módulos.
:::

Los módulos son funcionalidades opcionales que se activan según las necesidades de tu organización.

### Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| **Equipos** | Agrupar miembros en equipos |
| **Control de Tiempo** | Registro de horas trabajadas |
| **Reservas** | Gestión de entregas/devoluciones |
| **Estado de Coches** | Estado y limpieza de flota |
| **Transfers** | Trayectos y brokers |
| **Garatech** | Talleres, reparaciones, accidentes |
| **Automatizaciones** | Reglas automáticas |
| **Reportes** | Informes y estadísticas |
| **Plantillas** | Plantillas reutilizables |
| **Formularios** | Formularios internos y públicos |

### Activar/desactivar un módulo

1. Ve a **Ajustes > Módulos**
2. Busca el módulo que quieres gestionar
3. Haz clic en el **toggle** para activar o desactivar
4. El cambio es inmediato

:::warning
Desactivar un módulo **oculta** la sección del sidebar y bloquea el acceso a sus funciones, pero **no elimina los datos**. Si lo reactivas, todo estará como antes.
:::

:::info
Los módulos desactivados no generan secciones en el sidebar ni en la búsqueda global. Las notificaciones de módulos desactivados se pausan.
:::
        `,
        relatedTopics: ['admin-members', 'navigation']
      },
      {
        id: 'admin-invitations',
        title: 'Gestionar invitaciones',
        icon: 'MailPlus',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['invitaciones', 'email', 'pendiente', 'expiración'],
        content: `
## Gestionar invitaciones

:::admin
Solo Owners y Admins pueden enviar y gestionar invitaciones.
:::

### Enviar una invitación

1. Ve a **Ajustes > Miembros**
2. Haz clic en **"+ Invitar miembro"**
3. Introduce el email y selecciona el rol
4. Haz clic en **"Enviar"**

### Estados de invitación

| Estado | Descripción |
|--------|-------------|
| **Pendiente** | Invitación enviada, esperando aceptación |
| **Aceptada** | El usuario creó su cuenta y se unió |
| **Expirada** | Pasaron más de 7 días sin aceptar |
| **Cancelada** | El admin canceló la invitación |

### Gestionar invitaciones pendientes

En **Ajustes > Miembros**, verás las invitaciones pendientes con opciones para:
- **Reenviar**: Enviar el email de invitación nuevamente
- **Cancelar**: Revocar la invitación

:::tip
Si una invitación expiró, simplemente envía una nueva. El enlace anterior dejará de funcionar automáticamente.
:::
        `,
        relatedTopics: ['admin-members', 'login']
      },
      {
        id: 'admin-trash',
        title: 'Papelera',
        icon: 'Trash2',
        difficulty: 'intermediate',
        readTime: 2,
        tags: ['papelera', 'eliminar', 'restaurar', 'recuperar'],
        content: `
## Papelera

:::admin
Solo Owners y Admins pueden acceder a la papelera.
:::

La papelera contiene todas las tareas eliminadas que aún se pueden recuperar.

### Acceder a la papelera

1. Ve a **Ajustes > Papelera**
2. Verás la lista de tareas eliminadas con:
   - Título de la tarea
   - Quién la eliminó
   - Cuándo se eliminó
   - Días restantes antes de la eliminación permanente

### Restaurar una tarea

1. Encuentra la tarea en la papelera
2. Haz clic en **"Restaurar"**
3. La tarea vuelve a su estado anterior con todos sus datos

### Eliminación permanente

- Las tareas en la papelera se eliminan **permanentemente después de 30 días**
- También puedes eliminar permanentemente de forma manual haciendo clic en **"Eliminar permanentemente"**

:::warning
La eliminación permanente es irreversible. No se pueden recuperar los datos una vez eliminados permanentemente.
:::
        `,
        relatedTopics: ['task-archive-trash', 'admin-members']
      },
      {
        id: 'admin-audit-logs',
        title: 'Logs de auditoría',
        icon: 'ScrollText',
        difficulty: 'advanced',
        readTime: 4,
        tags: ['auditoría', 'logs', 'historial', 'seguridad', 'registro'],
        content: `
## Logs de auditoría

:::admin
Solo Owners y Admins pueden acceder a los logs de auditoría.
:::

Los logs de auditoría registran todas las acciones relevantes realizadas en la organización.

### Acceder a los logs

1. Ve a **Ajustes > Auditoría**
2. Verás una tabla cronológica de acciones

### Información registrada

| Campo | Descripción |
|-------|-------------|
| **Fecha/Hora** | Cuándo ocurrió la acción |
| **Usuario** | Quién la realizó |
| **Acción** | Qué hizo (crear, editar, eliminar, etc.) |
| **Entidad** | Sobre qué tipo de elemento (tarea, miembro, etc.) |
| **ID entidad** | Identificador del elemento |
| **Rol actor** | Rol del usuario al momento de la acción |
| **Detalles** | Información adicional sobre los cambios |

### Filtros

Filtra los logs por:
- **Usuario**: Ver acciones de una persona específica
- **Tipo de acción**: Solo creaciones, ediciones, eliminaciones, etc.
- **Tipo de entidad**: Solo tareas, miembros, etc.
- **Rango de fechas**: Periodo específico

:::info
Los logs de auditoría se mantienen según la política de retención configurada (por defecto: 90 días). Los logs más antiguos se eliminan automáticamente.
:::

:::tip
Revisa los logs periódicamente para detectar actividad inusual y asegurar el cumplimiento de las políticas de la organización.
:::
        `,
        relatedTopics: ['admin-members', 'admin-permissions', 'settings-security']
      }
    ]
  },

  // =====================================================================
  // 20. AJUSTES
  // =====================================================================
  {
    id: 'settings',
    title: 'Ajustes',
    icon: 'Cog',
    description: 'Configuración de perfil, seguridad, integraciones y organización',
    subsections: [
      {
        id: 'settings-profile',
        title: 'Perfil y preferencias',
        icon: 'UserCircle',
        difficulty: 'basic',
        readTime: 2,
        tags: ['perfil', 'nombre', 'avatar', 'tema', 'idioma'],
        content: `
## Perfil y preferencias

1. Ve a **Ajustes** en el sidebar
2. En la sección **Perfil**:

| Opción | Descripción |
|--------|-------------|
| **Nombre** | Tu nombre visible |
| **Avatar** | Foto de perfil |
| **Tema** | Claro / Oscuro / Sistema |

Todos los cambios se guardan automáticamente.

:::tip
Usa un avatar para que tu equipo te identifique fácilmente en las asignaciones y comentarios.
:::
        `,
        relatedTopics: ['profile', 'settings-security']
      },
      {
        id: 'settings-security',
        title: 'Seguridad',
        icon: 'Lock',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['seguridad', 'contraseña', 'sesión', 'MFA'],
        content: `
## Seguridad

### Cambiar contraseña

1. Ve a **Ajustes > Seguridad**
2. Haz clic en **"Cambiar contraseña"**
3. Introduce tu contraseña actual
4. Define la nueva contraseña (mínimo 8 caracteres)
5. Confirma

### Configuración de seguridad de la organización

:::admin
Solo Owners y Admins pueden configurar la seguridad organizacional.
:::

| Opción | Descripción |
|--------|-------------|
| **MFA obligatorio** | Requerir autenticación en dos pasos |
| **Tiempo de sesión** | Minutos antes de cerrar sesión automáticamente |
| **Dominios permitidos** | Solo permitir emails de ciertos dominios |
| **Lista de IPs** | Restringir acceso a IPs específicas |
| **Bloquear exportaciones** | Impedir la exportación de datos |
| **Bloquear API keys** | Desactivar el uso de API keys |
| **Bloquear compartir público** | Impedir compartir enlaces públicos |
| **Retención de auditoría** | Días que se guardan los logs |

:::warning
Cambiar la configuración de seguridad afecta a **todos** los miembros de la organización inmediatamente.
:::
        `,
        relatedTopics: ['faq-password', 'admin-audit-logs', 'settings-profile']
      },
      {
        id: 'settings-integrations',
        title: 'Integraciones',
        icon: 'Plug',
        difficulty: 'advanced',
        readTime: 4,
        tags: ['integraciones', 'API', 'Slack', 'WhatsApp', 'Rently', 'IA'],
        content: `
## Integraciones

:::admin
Solo Owners y Admins pueden configurar integraciones.
:::

Conecta PlanMint con herramientas externas:

### Integraciones disponibles

| Integración | Descripción | Uso |
|-------------|-------------|-----|
| **Slack** | Enviar notificaciones a canales de Slack | Notificaciones |
| **WhatsApp** | Enviar mensajes por WhatsApp Business | Notificaciones |
| **Rently** | Sincronización de reservas | Importar reservas automáticamente |
| **IA (OpenAI compatible)** | Funciones de inteligencia artificial | Análisis, extracción, sugerencias |
| **Email personalizado** | Configurar remitente de emails | Notificaciones por email |

### Configurar una integración

1. Ve a **Ajustes > Integraciones**
2. Busca la integración deseada
3. Haz clic en **"Configurar"**
4. Introduce los datos requeridos (API keys, URLs, etc.)
5. Guarda y prueba la conexión

:::warning
Las API keys y credenciales se almacenan de forma segura y encriptada. Nunca se muestran después de guardarlas.
:::

:::tip
Usa la integración de Slack para recibir notificaciones del equipo en un canal compartido sin necesidad de revisar la app constantemente.
:::
        `,
        relatedTopics: ['notifications-preferences', 'reservations-overview', 'admin-modules']
      },
      {
        id: 'settings-billing',
        title: 'Facturación y suscripción',
        icon: 'CreditCard',
        difficulty: 'intermediate',
        readTime: 3,
        tags: ['facturación', 'suscripción', 'plan', 'pago', 'cupón'],
        content: `
## Facturación y suscripción

:::admin
Solo el Owner puede gestionar la facturación.
:::

### Ver plan actual

1. Ve a **Ajustes > Facturación**
2. Verás:
   - Plan actual y sus características
   - Fecha de renovación
   - Método de pago registrado
   - Historial de facturas

### Cambiar de plan

1. Haz clic en **"Cambiar plan"**
2. Compara las opciones disponibles
3. Selecciona el plan deseado
4. Confirma el cambio

### Aplicar cupón

1. En la sección de facturación, haz clic en **"Aplicar cupón"**
2. Introduce el código del cupón
3. El descuento se aplicará en la próxima factura

:::info
Los cambios de plan se aplican inmediatamente. Si subes de plan, se cobra la diferencia prorrateada. Si bajas, el cambio se aplica al final del periodo actual.
:::

:::tip
Revisa las facturas periódicamente desde el historial para mantener tus registros contables al día.
:::
        `,
        relatedTopics: ['admin-members', 'admin-modules']
      },
      {
        id: 'settings-dropdowns',
        title: 'Opciones personalizables (Dropdowns)',
        icon: 'ListCollapse',
        difficulty: 'advanced',
        readTime: 3,
        tags: ['dropdowns', 'opciones', 'personalizar', 'estados', 'prioridades'],
        content: `
## Opciones personalizables (Dropdowns)

:::admin
Solo Owners y Admins pueden personalizar las opciones de los dropdowns.
:::

PlanMint permite personalizar las opciones de varios campos desplegables para adaptarlos a tu terminología:

### Campos personalizables

| Campo | Ejemplo de opciones |
|-------|--------------------|
| **Prioridades de tarea** | Baja, Media, Alta, Urgente, Crítica |
| **Tipos de reparación** | Mecánica, Carrocería, Eléctrica, Neumáticos |
| **Severidad de accidentes** | Leve, Moderada, Grave, Muy grave |
| **Estados de vehículo** | Disponible, En uso, En limpieza |

### Personalizar opciones

1. Ve a **Ajustes > Personalización**
2. Selecciona el campo a modificar
3. Para cada opción puedes:
   - Cambiar el **nombre** (label)
   - Cambiar el **color**
   - Cambiar el **icono**
   - **Reordenar** arrastrando
   - **Marcar como predeterminada**
   - **Eliminar** (si no está en uso)

:::warning
Eliminar una opción que está en uso puede causar inconsistencias. Mejor desactívala o renómbrala.
:::
        `,
        relatedTopics: ['kanban-config', 'create-task']
      }
    ]
  },

  // =====================================================================
  // 21. FAQ
  // =====================================================================
  {
    id: 'faq',
    title: 'Preguntas Frecuentes',
    icon: 'HelpCircle',
    description: 'Respuestas a las dudas más comunes',
    subsections: [
      {
        id: 'faq-password',
        title: '¿Cómo cambio mi contraseña?',
        icon: 'Key',
        difficulty: 'basic',
        readTime: 1,
        tags: ['contraseña', 'seguridad', 'cambiar'],
        content: `
## ¿Cómo cambio mi contraseña?

1. Ve a **Ajustes > Seguridad**
2. Haz clic en **"Cambiar contraseña"**
3. Introduce tu contraseña actual y la nueva (mínimo 8 caracteres)
4. Confirma el cambio

:::tip
También puedes usar la opción "Olvidé mi contraseña" en la pantalla de login si no recuerdas tu contraseña actual.
:::

:::warning
Usa una contraseña segura con al menos 8 caracteres, incluyendo mayúsculas, minúsculas y números.
:::
        `,
        relatedTopics: ['login', 'settings-security']
      },
      {
        id: 'faq-notifications',
        title: '¿Por qué no recibo notificaciones?',
        icon: 'BellOff',
        difficulty: 'basic',
        readTime: 2,
        tags: ['notificaciones', 'alertas', 'problema', 'push'],
        content: `
## ¿Por qué no recibo notificaciones?

Verifica lo siguiente en orden:

### 1. Preferencias de notificación
En **Ajustes > Notificaciones**, asegúrate de que:
- Los canales deseados están **activados**
- Los eventos que te interesan están **marcados**
- No tienes un **horario silencioso** activo

### 2. Permisos del navegador
Tu navegador debe permitir las notificaciones del sitio:
- **Chrome**: Icono de candado > Configuración del sitio > Notificaciones > Permitir
- **Firefox**: Icono de candado > Permisos > Notificaciones > Permitir
- **Safari**: Preferencias > Sitios web > Notificaciones

### 3. Suscripción push
En **Ajustes > Notificaciones**, verifica que la suscripción push esté activa. Si no, haz clic en **"Activar notificaciones push"**.

### 4. Horario silencioso
Revisa si tienes configurado un horario sin notificaciones. Las notificaciones in-app se acumulan, pero push y email se pausan.

### 5. Versión instalada (PWA)
Si usas la versión instalada, ciérrala y ábrela de nuevo para refrescar la suscripción push.

:::info
Si el problema persiste después de verificar todos los puntos, contacta con el administrador de tu organización.
:::
        `,
        relatedTopics: ['notifications-preferences', 'notifications-center', 'faq-pwa']
      },
      {
        id: 'faq-pwa',
        title: '¿Cómo instalo PlanMint en mi dispositivo?',
        icon: 'Smartphone',
        difficulty: 'basic',
        readTime: 2,
        tags: ['PWA', 'instalar', 'aplicación', 'móvil', 'escritorio', 'offline'],
        content: `
## ¿Cómo instalo PlanMint en mi dispositivo?

PlanMint es una **Progressive Web App (PWA)** que se puede instalar en cualquier dispositivo:

### En ordenador (Chrome/Edge)

1. Abre PlanMint en tu navegador
2. Busca el icono de **instalación** en la barra de direcciones (📥)
3. Haz clic en **"Instalar"**
4. PlanMint se abrirá como una aplicación independiente

### En Android

1. Abre PlanMint en Chrome
2. Toca el menú (⋮) > **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**
3. Confirma la instalación

### En iPhone/iPad (Safari)

1. Abre PlanMint en Safari
2. Toca el botón de **Compartir** (📤)
3. Selecciona **"Añadir a pantalla de inicio"**
4. Haz clic en **"Añadir"**

### Ventajas de la instalación

| Ventaja | Descripción |
|---------|-------------|
| **Acceso rápido** | Icono directo en el escritorio/home |
| **Pantalla completa** | Sin barra de navegación del navegador |
| **Notificaciones push** | Recibe alertas incluso con el navegador cerrado |
| **Carga rápida** | Cacheo de recursos para inicio instantáneo |

:::tip
La versión instalada se actualiza automáticamente cuando hay una nueva versión disponible.
:::
        `,
        relatedTopics: ['login', 'faq-notifications']
      },
      {
        id: 'faq-support',
        title: '¿Cómo contacto con soporte?',
        icon: 'MessageCircle',
        difficulty: 'basic',
        readTime: 1,
        tags: ['soporte', 'ayuda', 'contacto', 'feedback', 'error'],
        content: `
## ¿Cómo contacto con soporte?

### Feedback desde la aplicación

1. En el sidebar, haz clic en **"Enviar feedback"**
2. Describe tu problema o sugerencia con detalle
3. Incluye capturas de pantalla si es posible
4. Nuestro equipo revisará tu mensaje

### Para problemas urgentes

1. Contacta directamente al **administrador de tu organización**
2. El admin puede escalar el problema al equipo de soporte

### Tips para un buen reporte de error

| Incluye | Ejemplo |
|---------|---------|
| **Qué intentabas hacer** | "Intentaba crear una tarea con subtareas" |
| **Qué ocurrió** | "Al guardar, apareció un error rojo" |
| **Qué esperabas** | "La tarea debería haberse guardado" |
| **Capturas** | Imagen del error o la pantalla |
| **Navegador** | Chrome 120 en Windows 11 |

:::tip
Cuanto más detallado sea tu reporte, más rápido podremos resolver tu problema.
:::
        `,
        relatedTopics: ['login', 'faq-notifications']
      },
      {
        id: 'faq-data-export',
        title: '¿Cómo exporto mis datos?',
        icon: 'Download',
        difficulty: 'intermediate',
        readTime: 2,
        tags: ['exportar', 'datos', 'Excel', 'PDF', 'descargar'],
        content: `
## ¿Cómo exporto mis datos?

PlanMint permite exportar datos en varios formatos:

### Exportar tareas

1. Ve a la **lista de tareas**
2. Aplica los filtros deseados
3. Haz clic en **"Exportar"** (icono de descarga)
4. Selecciona el formato: **Excel (.xlsx)** o **PDF**

### Exportar reportes

1. Ve a **Reportes**
2. Selecciona el reporte y periodo
3. Haz clic en **"Exportar"**

### Exportar desde el Centro de Ayuda

Puedes exportar cualquier sección de ayuda como PDF:
1. Abre la sección deseada
2. Haz clic en **"Exportar PDF"** en la esquina superior

:::admin
La exportación de datos puede estar restringida por la configuración de seguridad de la organización. Si no ves el botón de exportar, contacta con tu administrador.
:::

:::info
Las exportaciones incluyen solo los datos a los que tienes acceso según tu rol y permisos.
:::
        `,
        relatedTopics: ['reports-overview', 'settings-security']
      }
    ]
  }
];
