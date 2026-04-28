# Informe de Auditoría Completa — PlanMint

**Fecha:** 28 de abril de 2026
**Alcance:** Base de datos Supabase (122 tablas), código servidor (23 archivos), código frontend (906 queries, 80+ hooks, 60+ páginas), triggers, funciones, RLS, índices, datos inconsistentes.

---

## Resumen Ejecutivo

La auditoría ha revelado un sistema generalmente bien construido con buena cobertura de RLS (121/122 tablas), migración completa de RPCs a endpoints Express (0 llamadas .rpc() en producción) y un patrón de autenticación consistente en los 52 endpoints del servidor. Sin embargo, se han identificado **8 inconsistencias de datos**, **2 bugs en triggers**, **9 funciones legacy eliminables**, **6 archivos de código muerto** y **3 índices faltantes** que, en conjunto, afectan la fiabilidad del sistema y su mantenibilidad a largo plazo.

Los hallazgos se clasifican en tres niveles de severidad: **Alta** (afecta funcionalidad en producción), **Media** (puede causar errores bajo ciertas condiciones) y **Baja** (deuda técnica sin impacto inmediato).

---

## 1. Base de Datos: Datos Inconsistentes

Se ejecutaron 15 consultas de verificación cruzada sobre las 122 tablas. A continuación se detallan los hallazgos ordenados por severidad.

### 1.1 Hallazgos de Severidad Alta

**DB-03: Discrepancia de roles entre `profiles` y `organization_members`** — Se detectaron 2 usuarios (David Dev. y David) donde `profiles.role = 'admin'` pero `organization_members.role = 'owner'`. Tras analizar el trigger `sync_profile_role_on_member_change`, se confirmó que esto es **comportamiento intencional**: el enum `app_role` de la tabla `profiles` no incluye el valor `'owner'`, por lo que el trigger mapea `owner → admin`. La fuente de verdad para determinar si un usuario es propietario es `organization_members.role`, no `profiles.role`. El código de permisos en `permissionHelper.ts` ya utiliza la tabla correcta. **No requiere corrección.**

### 1.2 Hallazgos de Severidad Media

**DB-01: 2 perfiles sin organización.** Los usuarios "Laura Seguí Test" y "Gloria" tienen `profiles.organization_id = NULL`. Esto significa que no pueden acceder a ninguna organización ni ver datos. Probablemente son cuentas de prueba o usuarios que abandonaron el flujo de onboarding antes de completarlo.

**DB-02: 1 perfil sin membership.** La usuaria "Christa" tiene `profiles.organization_id` asignado a la organización Azul Cars, pero **no tiene fila correspondiente en `organization_members`**. Esto causa que las verificaciones de permisos basadas en `organization_members` fallen silenciosamente, impidiendo el acceso a funcionalidades protegidas. La causa raíz es el trigger `handle_new_user`, que crea el perfil con `organization_id` pero no inserta en `organization_members` (ver sección 4.1).

**DB-07: 32 movimientos de vehículos huérfanos.** Existen 32 filas en `vehicle_movements` cuyo `vehicle_id` apunta a vehículos que ya no existen en la tabla `vehicles`. Esto ocurre cuando un vehículo se elimina (probablemente tras ser archivado) pero sus movimientos históricos no se limpian. No causa errores visibles porque las queries filtran por `vehicle_id` con JOIN, pero genera datos fantasma en reportes que usan LEFT JOIN o conteos directos.

### 1.3 Hallazgos de Severidad Baja

**DB-04: 4 invitaciones pendientes expiradas.** Invitaciones enviadas a david@azulcars.com, mikapiur@gmail.com, camila@azulcars.com y nushy1986@gmail.com que expiraron entre diciembre 2025 y febrero 2026 sin ser aceptadas. No causan problemas funcionales pero ensucian la lista de invitaciones del panel de administración.

**DB-05: 59 asignaciones de tareas borradas.** Tareas con `deleted_at != NULL` aún conservan sus filas en `task_assignees`. No causa bugs porque las queries de tareas filtran por `deleted_at IS NULL`, pero representa datos innecesarios.

**DB-06: 34 notificaciones no leídas con más de 30 días.** Notificaciones antiguas que nunca fueron marcadas como leídas. Inflan el contador de notificaciones no leídas del usuario.

**DB-08: 1 reserva activa sin vehículo asignado.** La reserva de "Oliver" (V Class, estado "Confirmada", marzo 2026) tiene `auto = NULL`. Es una reserva antigua que debería haberse archivado o completado.

---

## 2. Base de Datos: Triggers y Funciones

### 2.1 Trigger `handle_new_user` — Bug de Membership Faltante

Este trigger se ejecuta en `INSERT` sobre `auth.users` y crea una fila en `profiles` con el `organization_id` extraído de `raw_user_meta_data`. Sin embargo, **no crea la fila correspondiente en `organization_members`**. Esto deja al usuario en un estado inconsistente: tiene organización asignada en su perfil pero no tiene membership, lo que causa fallos en las verificaciones de permisos.

El endpoint `signupWithInvitation.ts` compensa este problema insertando explícitamente en `organization_members` después de crear el usuario, pero el trigger también se ejecuta, generando una race condition documentada en los comentarios del código. Si un usuario se registra por cualquier otro camino (signup directo con metadata), queda sin membership.

> **Corrección recomendada:** Actualizar `handle_new_user` para que haga `INSERT INTO organization_members` cuando `organization_id` está presente en los metadatos del usuario.

### 2.2 Trigger `update_vehicle_on_reservation_change` — Estado "Cancelada" No Manejado

Este trigger gestiona la transición de estados de vehículos cuando cambia el estado de una reserva. Actualmente maneja dos transiciones: "Entregado" (vehículo pasa a `alquilado`) y "Terminada" (vehículo pasa a `sucio` y se resetean las tareas de limpieza). Sin embargo, **no maneja el estado "Cancelada"**. Si una reserva se cancela después de haber sido entregada, el vehículo permanece en estado `alquilado` con `current_reservation_id` apuntando a una reserva cancelada.

La sincronización periódica con Rently (`syncRently.ts`) sí maneja este caso liberando el vehículo cuando detecta una reserva con `status_code = 4` (Cancelada), pero esto solo ocurre durante el ciclo de sync, no en tiempo real.

> **Corrección recomendada:** Añadir un bloque para el estado "Cancelada" en el trigger que libere el vehículo (status → `sucio`, `current_reservation_id → NULL`).

### 2.3 Trigger `sync_fleet_vehicle_to_vehicles` — Correcto

Este trigger sincroniza la tabla `fleet_vehicles` con `vehicles` en las tres operaciones (INSERT, UPDATE, DELETE). Busca por matrícula normalizada (`UPPER(TRIM())`), vincula mediante `fleet_vehicle_id`, y archiva el vehículo cuando se elimina de la flota. Está bien implementado.

### 2.4 Funciones Legacy (9 RPCs Eliminables)

Las siguientes funciones RPC en la base de datos han sido completamente reemplazadas por endpoints Express y ya no se invocan desde el frontend (verificado: 0 llamadas `.rpc()` en código de producción):

| Función RPC | Endpoint Express Equivalente |
|---|---|
| `accept_invitation(p_token)` | `POST /api/accept-invitation` |
| `accept_my_pending_invitation(p_invitation_id)` | `POST /api/accept-my-pending-invitation` |
| `create_invitation_secure(p_email, p_role, p_expires)` | `POST /api/create-invitation` |
| `get_invitation_public(p_token)` | `POST /api/get-invitation-public` |
| `get_my_pending_invitations()` | `POST /api/get-my-pending-invitations` |
| `get_organization_invitations()` | `POST /api/get-organization-invitations` |
| `revoke_invitation(p_invitation_id)` | `POST /api/revoke-invitation` |
| `create_task_secure(...)` | `POST /api/create-task-secure` |
| `create_area_secure(...)` | `POST /api/create-area-secure` |

> **Corrección recomendada:** Eliminar estas 9 funciones de la base de datos para reducir superficie de ataque y evitar confusión.

---

## 3. Base de Datos: Índices y Rendimiento

La base de datos tiene un tamaño total modesto (las tablas más grandes son `reservations` con 8.8 MB y 2,254 filas, y `notifications` con 5 MB y 5,267 filas). La mayoría de tablas tienen índices adecuados, pero se detectaron tres carencias:

| Tabla | Índice Faltante | Justificación |
|---|---|---|
| `profiles` | `idx_profiles_organization_id` | Solo tiene el índice PK. Todas las queries de miembros filtran por `organization_id`. Con 22 filas actuales el impacto es mínimo, pero crecerá linealmente con los usuarios. |
| `reservations` | `idx_reservations_estado` | El dashboard operacional filtra frecuentemente por estado ('En curso', 'Confirmada', 'Pendiente'). |
| `reservations` | `idx_reservations_auto` | El trigger `update_vehicle_on_reservation_change` y varias queries buscan por matrícula (`auto`). |

La cobertura de RLS es excelente: 121 de 122 tablas tienen políticas activas. La única tabla sin políticas es `broker_rate_limits`, que es una tabla de rate limiting público y no contiene datos sensibles.

---

## 4. Código: Hallazgos

### 4.1 Código Muerto

Se identificaron 6 archivos que no están referenciados en ninguna parte del proyecto:

| Archivo | Tipo | Motivo de Obsolescencia |
|---|---|---|
| `client/src/hooks/useBillingProducts.ts` | Hook | Billing no está implementado (app interna, sin pagos). |
| `client/src/hooks/useDashboardStats.ts` | Hook | Reemplazado por `useOperationalDashboard`. |
| `client/src/hooks/useFeatureFlags.ts` | Hook | Feature flags se leen directamente desde la configuración. |
| `client/src/hooks/useSubtasks.ts` | Hook | Subtasks se manejan inline en los componentes. |
| `client/src/pages/Billing.tsx` | Página | Sin ruta en `App.tsx`. Billing no aplica. |
| `client/src/pages/EnterpriseSettings.tsx` | Página | Sin ruta en `App.tsx`. Funcionalidad no implementada. |

> **Corrección recomendada:** Eliminar estos 6 archivos para reducir el tamaño del bundle y evitar confusión.

### 4.2 Error Handling Incompleto

Dos endpoints del servidor carecen de bloques try/catch:

- `handleOcrPlate` en `server/ocrPlate.ts` (línea 12)
- `handleGetVapidKey` en `server/vapidKey.ts` (línea 8)

Si estos endpoints lanzan una excepción no capturada, Express devuelve un error 500 genérico sin logging, dificultando el diagnóstico.

### 4.3 Observaciones Arquitectónicas

La aplicación utiliza un patrón híbrido donde el frontend consulta Supabase directamente a través de 906 queries `.from()` distribuidas en hooks, mientras que las operaciones sensibles (invitaciones, permisos, sincronización) pasan por 52 endpoints Express autenticados. Este patrón es funcional y consistente, aunque dificulta la centralización de caché y logging. No se recomienda migrar a tRPC en este momento dado el volumen de código existente.

Los archivos `coreEndpoints.ts` (626 líneas) y `coreEndpoints2.ts` (304 líneas) representan un split arbitrario que podría reorganizarse por dominio funcional en el futuro, pero no es prioritario.

---

## 5. Plan de Corrección Propuesto

Las correcciones se organizan en tres bloques por prioridad de ejecución.

### Bloque A — Correcciones Críticas (Bugs en Producción)

| ID | Acción | Tipo | Riesgo |
|---|---|---|---|
| FIX-01 | Actualizar trigger `handle_new_user` para insertar en `organization_members` | SQL | Bajo — es un INSERT adicional, no modifica lógica existente |
| FIX-02 | Actualizar trigger `update_vehicle_on_reservation_change` para manejar "Cancelada" | SQL | Bajo — añade un bloque IF nuevo sin modificar los existentes |
| FIX-03 | Crear membership faltante para Christa en `organization_members` | SQL (datos) | Bajo — INSERT directo |

### Bloque B — Limpieza de Datos

| ID | Acción | Tipo | Riesgo |
|---|---|---|---|
| FIX-04 | Marcar invitaciones expiradas como `status = 'expired'` | SQL (datos) | Bajo |
| FIX-05 | Eliminar `task_assignees` de tareas borradas (deleted_at IS NOT NULL) | SQL (datos) | Bajo |
| FIX-06 | Marcar como leídas las notificaciones no leídas >30 días | SQL (datos) | Bajo |
| FIX-07 | Marcar movimientos huérfanos (sin vehículo) como `status = 'archived'` | SQL (datos) | Bajo |
| FIX-08 | Archivar la reserva de Oliver (marzo 2026, sin auto) | SQL (datos) | Bajo |

### Bloque C — Mejoras Técnicas

| ID | Acción | Tipo | Riesgo |
|---|---|---|---|
| FIX-09 | Crear 3 índices faltantes (profiles.org_id, reservations.estado, reservations.auto) | SQL | Bajo |
| FIX-10 | Eliminar 9 funciones RPC legacy de la BD | SQL | Bajo — ya no se usan |
| FIX-11 | Eliminar 6 archivos de código muerto del frontend | Código | Bajo |
| FIX-12 | Añadir try/catch a handleOcrPlate y handleGetVapidKey | Código | Bajo |

---

## 6. Estadísticas de la Base de Datos

| Tabla | Tamaño Total | Filas Estimadas |
|---|---|---|
| reservations | 8,832 kB | 2,254 |
| notifications | 5,072 kB | 5,267 |
| usage_events | 1,232 kB | 3,433 |
| vehicle_cleaning_history | 472 kB | 1,054 |
| vehicle_cleaning_tasks | 344 kB | 1,148 |
| fleet_inspection_photos | 328 kB | 647 |
| user_sessions | 312 kB | 285 |
| tasks | 232 kB | 146 |
| outbound_notifications | 224 kB | 263 |
| task_assignees | 224 kB | 204 |
| role_permissions | 176 kB | 441 |
| vehicles | 176 kB | 164 |
| vehicle_movements | 168 kB | 59 |

---

## 7. Conclusión

El sistema PlanMint se encuentra en un estado de madurez razonable para una aplicación en producción activa. Los dos bugs más relevantes (trigger `handle_new_user` sin membership y trigger de reservas sin manejar "Cancelada") tienen correcciones directas y de bajo riesgo. La limpieza de datos y la eliminación de código muerto mejorarán la mantenibilidad sin afectar la funcionalidad.

Se recomienda ejecutar primero el **Bloque A** (correcciones críticas), seguido del **Bloque B** (limpieza de datos) y finalmente el **Bloque C** (mejoras técnicas). Todas las correcciones SQL deben ejecutarse en una transacción y verificarse antes de confirmar.
