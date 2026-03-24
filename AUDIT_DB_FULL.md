# Auditoría Completa: Base de Datos vs Código

## Resumen Ejecutivo

Se han analizado **109 tablas** referenciadas en el código fuente. De estas, **105 existen** en Supabase y **4 están completamente ausentes**. Además, se han identificado **columnas faltantes** en tablas existentes que rompen flujos críticos del módulo de Transfers.

---

## 1. Tablas Completamente Ausentes (4)

Estas tablas son referenciadas en el código pero **no existen en la base de datos**:

| Tabla | Hooks/Archivos que la usan | Impacto |
|-------|---------------------------|---------|
| `transfer_status_history` | `useTransferStatusHistory.ts`, `useBrokerRequests.ts` | **CRÍTICO**: No se puede registrar historial de cambios de estado en solicitudes de transfer |
| `transfer_request_notes` | `useTransferNotes.ts` | **CRÍTICO**: No se pueden añadir notas internas a solicitudes de transfer |
| `vehicle_audits` | `FleetAudits.tsx` | **MEDIO**: La página de auditorías de flota no puede cargar datos |
| `task_comments` | `server/aiAssistant.ts` | **BAJO**: El asistente AI no puede leer comentarios de tareas (funcionalidad secundaria) |

### 1.1 Esquema esperado para `transfer_status_history`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK, default gen_random_uuid() |
| `request_id` | uuid | NO | FK → transfer_requests.id |
| `organization_id` | uuid | NO | FK → organizations.id |
| `previous_status` | text | SÍ | Estado anterior |
| `new_status` | text | NO | Nuevo estado |
| `changed_by_type` | text | NO | 'admin', 'broker', 'system' |
| `changed_by_id` | uuid | SÍ | ID del usuario que cambió |
| `changed_by_name` | text | SÍ | Nombre del usuario |
| `note` | text | SÍ | Nota opcional |
| `created_at` | timestamptz | NO | default now() |

### 1.2 Esquema esperado para `transfer_request_notes`

El código en `useTransferNotes.ts` inserta con columnas `broker_id` y `text`, pero el archivo de tipos (`types.ts`) define `author_type`, `author_id` y `content`. Esto indica que el código fue modificado después de generar los tipos. El esquema debe coincidir con lo que el código realmente inserta:

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK, default gen_random_uuid() |
| `request_id` | uuid | NO | FK → transfer_requests.id |
| `organization_id` | uuid | NO | FK → organizations.id |
| `broker_id` | uuid | SÍ | FK → transfer_brokers.id (null si es admin) |
| `author_name` | text | NO | Nombre del autor |
| `text` | text | NO | Contenido de la nota |
| `created_at` | timestamptz | NO | default now() |

### 1.3 Esquema esperado para `vehicle_audits`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `organization_id` | uuid | NO | FK → organizations.id |
| `vehicle_id` | uuid | NO | FK → vehicles.id |
| `auditor_id` | uuid | NO | FK → profiles.id |
| `status` | text | NO | Estado de la auditoría |
| `notes` | text | SÍ | Notas |
| `created_at` | timestamptz | NO | default now() |

### 1.4 Esquema esperado para `task_comments`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `task_id` | uuid | NO | FK → tasks.id |
| `content` | text | NO | Contenido del comentario |
| `created_at` | timestamptz | NO | default now() |

---

## 2. Columnas Faltantes en Tablas Existentes

### 2.1 `transfer_brokers` — Faltan 4 columnas

La tabla solo tiene **5 columnas** (`id`, `name`, `organization_id`, `is_active`, `created_at`), pero el código espera **9 columnas**:

| Columna faltante | Tipo esperado | Usado en |
|-----------------|---------------|----------|
| `email` | text, nullable | `useTransferBrokers.ts` (insert, update, setupPortal), `brokerRegistrationEndpoints.ts` |
| `phone` | text, nullable | `useTransferBrokers.ts` (insert, update) |
| `company` | text, nullable | `useTransferBrokers.ts` (insert, update) |
| `user_id` | uuid, nullable | `useTransferNotes.ts` (notification dispatch), `brokerRegistrationEndpoints.ts` (approval flow) |

**Impacto**: CRÍTICO. Sin estas columnas:
- Crear un broker con email/phone/company falla silenciosamente (Supabase ignora columnas desconocidas en inserts)
- El flujo de aprobación de brokers no puede vincular `user_id`
- Las notificaciones de notas no pueden encontrar a qué usuarios notificar

---

## 3. Plan de Remediación

### Acción 1: Crear tabla `transfer_status_history`
SQL para crear la tabla con las columnas que el código espera.

### Acción 2: Crear tabla `transfer_request_notes`
SQL con las columnas que el código realmente inserta (`broker_id`, `text`), NO las del archivo de tipos obsoleto.

### Acción 3: Crear tabla `vehicle_audits`
SQL básico para que la página FleetAudits no falle.

### Acción 4: Crear tabla `task_comments`
SQL básico para que el AI assistant pueda leer comentarios.

### Acción 5: Añadir columnas a `transfer_brokers`
ALTER TABLE para añadir `email`, `phone`, `company`, `user_id`.

### Acción 6: Habilitar RLS en todas las tablas nuevas
Políticas básicas de seguridad por `organization_id`.

---

## 4. Tablas NO afectadas (confirmadas OK)

Las siguientes tablas existen y son usadas correctamente por el código:
`profiles`, `organizations`, `organization_members`, `transfer_requests`, `transfer_items`, `transfer_documents`, `transfer_providers`, `transfer_invoice_settings`, `transfer_item_vehicles`, `broker_profiles`, `broker_registration_requests`, `vehicles`, `reservations`, `notifications`, `notification_preferences`, `audit_logs`, `role_permissions`, y 88 tablas más.
