# Auditoría PlanMint - Hallazgos

## Fase 1: Base de Datos

### Datos Inconsistentes

| ID | Hallazgo | Severidad | Detalle |
|---|---|---|---|
| DB-01 | 2 profiles sin organization_id | Media | Laura Seguí Test y Gloria: profiles.organization_id = NULL. No pueden acceder a ninguna organización. |
| DB-02 | 1 profile sin membership | Media | Christa tiene profiles.organization_id pero NO tiene fila en organization_members. Puede causar errores de permisos. |
| DB-03 | 2 role mismatches profiles↔org_members | Alta | David Dev. y David: profiles.role='admin' pero org_members.role='owner'. El trigger sync_profile_role_on_member_change mapea owner→admin, lo cual es intencional. **NO es un bug.** |
| DB-04 | 4 invitaciones pendientes expiradas | Baja | david@azulcars.com, mikapiur@gmail.com, camila@azulcars.com, nushy1986@gmail.com. Invitaciones que expiraron sin ser aceptadas. Basura acumulada. |
| DB-05 | 59 task_assignees de tareas borradas | Baja | Tareas con deleted_at != NULL aún tienen filas en task_assignees. No causa bugs pero ocupa espacio. |
| DB-06 | 34 notificaciones no leídas >30 días | Baja | Notificaciones antiguas que nunca se leyeron. Ruido en contadores. |
| DB-07 | 32 vehicle_movements sin vehículo | Media | Movimientos cuyo vehicle_id apunta a vehículos que ya no existen (probablemente archivados y luego eliminados). |
| DB-08 | 1 reserva activa sin auto | Baja | Oliver, V Class, Confirmada, marzo 2026. Reserva antigua que debería estar archivada. |

### Triggers Críticos

| Trigger | Tabla | Hallazgo |
|---|---|---|
| handle_new_user | auth.users | Crea profile con org_id y role de user_metadata. NO crea fila en organization_members → causa DB-02. |
| sync_profile_role_on_member_change | organization_members | Mapea owner→admin en profiles.role. Intencional pero confuso. |
| update_vehicle_on_reservation_change | reservations | Solo actúa en estados 'Entregado' y 'Terminada'. No maneja 'Cancelada' → vehículo queda 'alquilado' si se cancela post-entrega. |
| sync_fleet_vehicle_to_vehicles | fleet_vehicles | Bien implementado: INSERT/UPDATE/DELETE sincroniza fleet↔vehicles por matrícula. |

### Funciones Legacy (9 RPCs reemplazadas por endpoints)

accept_invitation, accept_my_pending_invitation, create_invitation_secure, get_invitation_public, get_my_pending_invitations, get_organization_invitations, revoke_invitation, create_task_secure, create_area_secure.

Ya no se llaman desde el frontend (verificado: 0 .rpc() calls en producción). Se pueden eliminar de la BD.

### Índices Faltantes

| Tabla | Índice Faltante | Impacto |
|---|---|---|
| profiles | idx_profiles_organization_id | Solo tiene PK. Cada query por org_id hace seq scan en 22 filas (bajo ahora, crecerá). |
| reservations | idx_reservations_estado | Filtros por estado son frecuentes en dashboard operacional. |
| reservations | idx_reservations_auto | Búsqueda por matrícula para vincular vehículos. |

### RLS

- 121/122 tablas tienen políticas RLS. Solo `broker_rate_limits` no tiene políticas (aceptable: es tabla de rate limiting pública).
- RLS está habilitado en todas las tablas.

## Fase 2: Código

### Código Muerto / No Usado

| Archivo | Tipo | Detalle |
|---|---|---|
| client/src/hooks/useBillingProducts.ts | Hook | No importado en ningún archivo. |
| client/src/hooks/useDashboardStats.ts | Hook | No importado. Reemplazado por useOperationalDashboard. |
| client/src/hooks/useFeatureFlags.ts | Hook | No importado. Feature flags se leen directamente. |
| client/src/hooks/useSubtasks.ts | Hook | No importado. Subtasks se manejan inline. |
| client/src/pages/Billing.tsx | Página | No tiene ruta en App.tsx. |
| client/src/pages/EnterpriseSettings.tsx | Página | No tiene ruta en App.tsx. |

### Arquitectura

| Hallazgo | Severidad | Detalle |
|---|---|---|
| 906 queries directas a Supabase desde frontend | Info | La app usa Supabase client directamente desde hooks, no tRPC. Esto es el patrón actual y funciona, pero dificulta centralizar auth/cache. |
| 12 páginas con queries Supabase directas (sin hook) | Baja | Páginas que hacen .from() directamente en vez de usar hooks reutilizables. |
| coreEndpoints.ts (626 líneas) + coreEndpoints2.ts (304 líneas) | Baja | Split arbitrario. Podrían reorganizarse por dominio. |
| drizzle/schema.ts solo tiene tabla 'users' | Info | El schema Drizzle no refleja las 122 tablas reales. La app usa Supabase client, no Drizzle ORM. El schema es vestigial del template. |
| 52 endpoints usan authenticateSupabaseRequest | Info | Patrón consistente de auth. Bien centralizado. |
| 0 .rpc() calls en producción | Bueno | Migración a endpoints Express completada. |

### Error Handling

- Solo 2 endpoints sin try/catch: handleOcrPlate y handleGetVapidKey. Ambos son endpoints simples pero deberían tener error handling.

## Fase 3: Flujos Críticos

### Flujo de Invitaciones

**Problema principal:** `handle_new_user` trigger crea profile con organization_id pero NO crea fila en organization_members. Los endpoints de invitación (handleAcceptInvitation, handleAcceptMyPendingInvitation) SÍ crean la fila en organization_members, pero si el usuario se registra por otro camino (signup directo con metadata), queda sin membership.

**signupWithInvitation.ts** compensa esto correctamente: crea el auth user, luego explícitamente inserta en profiles Y upsert en organization_members. Pero el trigger handle_new_user también se ejecuta, causando una race condition (el código lo documenta en comentarios).

**Recomendación:** Actualizar handle_new_user para que también haga upsert en organization_members cuando organization_id está presente en metadata.

### Flujo de Estados de Vehículos

**Trigger update_vehicle_on_reservation_change:**
- Entregado → vehículo a 'alquilado' + current_reservation_id = reserva
- Terminada → vehículo a 'sucio' + current_reservation_id = NULL + reset cleaning tasks
- **Falta: Cancelada** → si una reserva se cancela después de estar 'Entregado', el vehículo queda 'alquilado' indefinidamente.

**syncRently.ts** tiene su propia lógica de release que SÍ maneja Cancelada (status_code 4), pero solo se ejecuta durante la sincronización periódica, no en tiempo real.

### Flujo de Roles

El trigger sync_profile_role_on_member_change mapea:
- owner → admin (en profiles)
- admin → admin
- manager → manager
- member → member

Esto es intencional: profiles.role usa enum app_role que no tiene 'owner'. La fuente de verdad para "es owner" es organization_members.role = 'owner'. El código de permisos (permissionHelper.ts) usa organization_members, no profiles.role, para verificar ownership.
