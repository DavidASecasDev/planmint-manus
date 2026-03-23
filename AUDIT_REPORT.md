# Informe de Auditoría Completa - PlanMint

**Fecha:** 23 de marzo de 2026  
**Alcance:** Base de datos (Supabase), código frontend y backend, flujos de negocio  
**Proyecto:** PlanMint (plan-mint.com) - Organización: Azul Cars

---

## Resumen Ejecutivo

Se ha realizado una auditoría exhaustiva de la base de datos, el código fuente (665 archivos, ~45.000 líneas) y los flujos de negocio. Se han identificado **problemas críticos** que afectan directamente a la funcionalidad de la aplicación, junto con problemas de coherencia y código muerto que generan deuda técnica.

---

## 1. PROBLEMAS CRÍTICOS (Bloquean funcionalidad)

### 1.1 RPCs de Supabase inexistentes referenciadas desde el código

El código frontend llama a **21 funciones RPC que NO existen** en la base de datos de Supabase. Esto significa que esas funcionalidades **fallan silenciosamente o muestran errores** cuando el usuario intenta usarlas.

| RPC Inexistente | Archivos que la usan | Impacto |
|---|---|---|
| `accept_invitation` | Invitation.tsx, Login.tsx | **Usuarios existentes NO pueden aceptar invitaciones** |
| `accept_my_pending_invitation` | CreateOrganization.tsx | **Usuarios nuevos NO pueden aceptar invitaciones desde onboarding** |
| `get_invitation_public` | Invitation.tsx | **No se puede validar un enlace de invitación** |
| `revoke_invitation` | PendingInvitationsList.tsx | **Admin NO puede revocar invitaciones** |
| `create_organization_with_owner` | CreateOrganization.tsx | **Superadmin NO puede crear organizaciones** |
| `create_area_secure` | useAreas.ts | **No se pueden crear áreas nuevas** |
| `create_task_secure` | useTasks.ts | **No se pueden crear tareas nuevas** |
| `get_my_permissions` | usePermissions.ts, PermissionsDiagnostics.tsx | **Sistema de permisos no funciona** |
| `get_inactive_vehicles` | useVehicles.ts | **No se pueden ver vehículos inactivos** |
| `get_reservations_operational` | useReservations.ts | **No se pueden cargar reservas operativas** |
| `get_org_integration_flags` | useIntegrationFlags.ts | **Flags de integración no cargan** |
| `get_next_transfer_document_number` | useTransferQuotePdf.ts | **Numeración de documentos de transferencia rota** |
| `update_vehicle_location` | useVehicleLocations.ts | **No se puede actualizar ubicación de vehículos** |
| `approve_broker_registration` | useBrokerRegistrations.ts | Módulo broker no funciona |
| `reject_broker_registration` | useBrokerRegistrations.ts | Módulo broker no funciona |
| `get_broker_profile` | BrokerAuthContext.tsx, BrokerLogin.tsx | Módulo broker no funciona |
| `get_broker_registration_status` | BrokerAuthContext.tsx | Módulo broker no funciona |
| `setup_broker_access` | useTransferBrokers.ts | Módulo broker no funciona |
| `track_referral_click` | useReferrals.ts, ReferralRedirect.tsx | Referidos no funciona |
| `track_referral_signup` | Register.tsx | Referidos no funciona |
| `redeem_coupon_for_plan` | useCoupons.ts | Cupones no funciona |
| `upsert_lead` | useLeads.ts | Leads no funciona |

**RPCs que SÍ existen y funcionan (7):**

| RPC | Estado |
|---|---|
| `generate_referral_code` | OK |
| `get_my_enabled_modules` | OK |
| `get_my_pending_invitations` | OK |
| `get_organization_entitlements` | OK |
| `get_organization_invitations` | OK |
| `is_super_admin` | OK |
| `sync_vehicles_from_reservations` | OK |

### 1.2 Tabla `profiles` NO tiene columna `email`

La tabla `profiles` tiene 7 columnas: `id, name, organization_id, role, created_at, theme_pref, avatar_url`. **No tiene columna `email`**.

Sin embargo, el código la referencia en dos lugares críticos:

- **`server/createInvitation.ts`** (línea ~60): Intenta verificar si un usuario ya es miembro buscando `profiles.email = X`. Esta query **siempre falla** con "column profiles.email does not exist", lo que significa que la verificación de duplicados no funciona.
- **`server/signupWithInvitation.ts`** (líneas 98, 112): Intenta hacer UPDATE/INSERT con `email` en profiles. El UPDATE **falla silenciosamente** (Supabase devuelve error pero el código lo captura y continúa con INSERT, que también falla).

### 1.3 Flujo de invitación completamente roto

El flujo de invitación tiene **múltiples puntos de fallo encadenados**:

**Crear invitación (Admin):**
1. El diálogo `InviteMemberDialog` llama al endpoint Express `/api/create-invitation` - CORRECTO, ya migrado
2. El endpoint intenta verificar duplicados con `profiles.email` que no existe - FALLA SILENCIOSAMENTE
3. El INSERT en `organization_invitations` ahora funciona (triggers eliminados)

**Aceptar invitación (Usuario existente):**
1. `Invitation.tsx` llama a `get_invitation_public` para validar el token - **RPC NO EXISTE, falla**
2. Si el usuario está logueado, llama a `accept_invitation` - **RPC NO EXISTE, falla**
3. `Login.tsx` también llama a `accept_invitation` después del login - **RPC NO EXISTE, falla**

**Aceptar invitación (Usuario nuevo - registro):**
1. `Invitation.tsx` llama a `get_invitation_public` - **RPC NO EXISTE, falla antes de mostrar formulario**
2. Si llegara al formulario, llama al endpoint Express `/api/signup-with-invitation` - CORRECTO
3. El endpoint intenta actualizar `profiles.email` - **FALLA** (columna no existe)
4. Pero continúa y crea el miembro en `organization_members` - CORRECTO

**Onboarding (CreateOrganization.tsx):**
1. Llama a `get_my_pending_invitations` - **FUNCIONA** (RPC existe)
2. Si hay invitaciones, llama a `accept_my_pending_invitation` - **RPC NO EXISTE, falla**
3. Si es superadmin, llama a `create_organization_with_owner` - **RPC NO EXISTE, falla**

### 1.4 Edge Functions de Supabase aún referenciadas

El código aún llama a 7 Edge Functions de Supabase directamente (no migradas a Express):

| Edge Function | Archivos | Funcionalidad |
|---|---|---|
| `create-checkout` | useBillingActions.ts, UpgradeModal.tsx, Pricing.tsx | Crear sesión de pago Stripe |
| `customer-portal` | useBillingActions.ts, PlanBillingSection.tsx | Portal de facturación |
| `update-subscription` | useBillingActions.ts | Actualizar suscripción |
| `cancel-subscription` | useBillingActions.ts | Cancelar suscripción |
| `superadmin-outbound` | Operations.tsx | Operaciones superadmin |
| `superadmin-customer-portal` | Subscriptions.tsx | Portal superadmin |
| `superadmin-sync-subscription` | Subscriptions.tsx | Sincronizar suscripciones |

> **Nota:** Estas Edge Functions podrían seguir funcionando si están desplegadas en Supabase. No se ha podido verificar su estado.

---

## 2. PROBLEMAS DE COHERENCIA DE DATOS

### 2.1 Doble sistema de membresía

Existen **dos fuentes de verdad** para la membresía de un usuario en una organización:

1. **`profiles.organization_id`** - Campo directo en el perfil del usuario
2. **`organization_members`** - Tabla relacional con `user_id`, `organization_id`, `role`, `status`

Esto genera inconsistencias:
- Un usuario puede tener `profiles.organization_id = X` pero no tener entrada en `organization_members`
- O viceversa: tener entrada en `organization_members` pero `profiles.organization_id = NULL`
- El frontend usa `profiles.organization_id` para routing (ProtectedRoute), pero `organization_members` para permisos

**Datos observados:** 14 profiles, 11 members. Al menos 3 perfiles sin entrada en `organization_members`.

### 2.2 Doble sistema de roles

Similar al problema anterior, los roles se almacenan en dos lugares:

1. **`profiles.role`** - Valores observados: `admin`, `member`
2. **`organization_members.role`** - Valores observados: `owner`, `admin`, `manager`, `member`

El código usa `profiles.role` en algunos lugares y `organization_members.role` en otros, lo que puede generar discrepancias.

### 2.3 Tabla `custom_roles` con permisos JSON

Existe una tabla `custom_roles` con 4 roles definidos (admin, manager, member, read_only) que almacena permisos como JSON. Sin embargo, el RPC `get_my_permissions` que lee estos permisos **no existe**, lo que significa que el sistema de permisos granulares no funciona.

---

## 3. ESTRUCTURA DE LA BASE DE DATOS

### 3.1 Tablas principales (115 tablas en total)

| Tabla | Columnas | Registros | Estado |
|---|---|---|---|
| `organizations` | id, name, vertical_preset, created_at, ... | 2 | OK |
| `profiles` | id, name, organization_id, role, created_at, theme_pref, avatar_url | 14 | Falta `email` |
| `organization_members` | id, organization_id, user_id, role, status, created_at, updated_at | 11 | OK |
| `organization_invitations` | id, organization_id, email, role, created_at, accepted, token_hash, status, expires_at, accepted_at | 20 | OK (triggers eliminados) |
| `vehicles` | 19 columnas | 164 | OK |
| `reservations` | multiples columnas | ~1.816 | OK |
| `tasks` | multiples columnas | - | OK |
| `areas` | multiples columnas | - | OK |
| `custom_roles` | id, organization_id, name, permissions, ... | 4 | OK pero RPC roto |
| `super_admins` | user_id, created_at | - | OK |

### 3.2 Triggers eliminados durante esta auditoría

- `on_invitation_sent_notify` (BEFORE INSERT en organization_invitations) - Referenciaba `public.notifications` y `public.roles` inexistentes
- `on_invitation_accepted_notify` (BEFORE UPDATE en organization_invitations) - Referenciaba `public.members` inexistente

### 3.3 Estados de vehículos

Los estados de vehículos en la base de datos coinciden con los definidos en el frontend:

| Estado | Cantidad | Definido en frontend |
|---|---|---|
| `sucio` | 129 | Si |
| `limpio` | 10 | Si |
| `alquilado` | 9 | Si |
| `en_servicio` | 9 | Si |
| `incompleto` | 7 | Si |

### 3.4 Estados de reservas

| Estado | Cantidad |
|---|---|
| `Completada` | 1.659 |
| `Pendiente` | 67 |
| `Confirmada` | 58 |
| `Cancelada` | 26 |
| `En curso` | 6 |

---

## 4. CÓDIGO MUERTO Y DEUDA TÉCNICA

### 4.1 Módulos con RPCs completamente rotas

Los siguientes módulos del frontend tienen **todas sus RPCs rotas** y por tanto no funcionan:

- **Módulo Broker** (BrokerAuthContext, BrokerLogin, useBrokerRegistrations, useTransferBrokers)
- **Módulo Referidos** (useReferrals, ReferralRedirect, Register.tsx)
- **Módulo Cupones** (useCoupons)
- **Módulo Leads** (useLeads)

### 4.2 Endpoints Express funcionales

| Endpoint | Función |
|---|---|
| `POST /api/create-invitation` | Crear invitación (reemplaza RPC rota) |
| `POST /api/signup-with-invitation` | Registro con invitación |
| `POST /api/ocr-plate` | OCR de matrículas |
| `POST /api/sync-rently` | Sincronización Rently |
| `POST /api/ai-assistant` | Asistente IA |
| `POST /api/rently-hub` | Hub Rently |
| `POST /api/parse-transfer-document` | Parsear documentos de transferencia |
| `POST /api/get-vapid-key` | Clave VAPID para push notifications |
| `POST /api/apply-template` | Aplicar plantilla |

---

## 5. PLAN DE CORRECCIÓN RECOMENDADO

### Prioridad 1 - CRÍTICO (Flujo de invitaciones completo)

Estas correcciones son necesarias para que el flujo de invitaciones funcione de extremo a extremo:

1. **Migrar RPCs de invitaciones a endpoints Express:**
   - `get_invitation_public` - Endpoint que valida token y devuelve datos de la invitación
   - `accept_invitation` - Endpoint que acepta invitación para usuario existente
   - `accept_my_pending_invitation` - Endpoint que acepta invitación desde onboarding
   - `revoke_invitation` - Endpoint que revoca invitación

2. **Corregir `createInvitation.ts`**: Eliminar la verificación de `profiles.email` (columna inexistente). Usar `organization_members` o `auth.admin.listUsers` para verificar duplicados.

3. **Corregir `signupWithInvitation.ts`**: Eliminar las referencias a `profiles.email` en UPDATE/INSERT. Solo actualizar `name`, `organization_id`, `role`.

### Prioridad 2 - CRÍTICO (Funcionalidades core)

4. **Migrar RPCs core a endpoints Express:**
   - `create_organization_with_owner` - Para que el superadmin pueda crear organizaciones
   - `create_area_secure` - Para crear áreas
   - `create_task_secure` - Para crear tareas
   - `get_my_permissions` - Para el sistema de permisos
   - `get_reservations_operational` - Para cargar reservas
   - `get_inactive_vehicles` - Para ver vehículos inactivos
   - `update_vehicle_location` - Para actualizar ubicaciones
   - `get_next_transfer_document_number` - Para numeración de documentos
   - `get_org_integration_flags` - Para flags de integración

### Prioridad 3 - COHERENCIA

5. **Unificar el sistema de membresía**: Decidir si `profiles.organization_id` o `organization_members` es la fuente de verdad, y sincronizar ambos.

6. **Unificar el sistema de roles**: Decidir si `profiles.role` o `organization_members.role` es la fuente de verdad.

### Prioridad 4 - LIMPIEZA

7. **Eliminar o desactivar módulos con RPCs completamente rotas** (Broker, Referidos, Cupones, Leads) si no se van a usar.

8. **Verificar Edge Functions de Supabase**: Confirmar si las 7 Edge Functions de billing siguen desplegadas y funcionando.

---

## 6. RESUMEN DE HALLAZGOS

| Categoría | Cantidad |
|---|---|
| RPCs inexistentes referenciadas | 21 |
| RPCs funcionales | 7 |
| Endpoints Express funcionales | 9 |
| Edge Functions referenciadas | 7 |
| Triggers eliminados (rotos) | 2 |
| Columnas inexistentes referenciadas | 1 (`profiles.email`) |
| Tablas en la base de datos | 115 |
| Archivos de código | 665 |
| Líneas de código | ~45.000 |

---

*Este informe ha sido generado tras una auditoría exhaustiva de la base de datos de Supabase y el código fuente completo del proyecto PlanMint.*
