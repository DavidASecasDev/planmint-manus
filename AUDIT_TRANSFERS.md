# Auditoría Completa del Módulo de Transfers

## Resumen Ejecutivo

Tras una revisión exhaustiva del módulo de Transfers (base de datos, servidor Express, hooks del cliente y componentes UI), se han identificado **problemas críticos** que impiden el funcionamiento correcto del flujo completo. Los problemas se agrupan en tres categorías principales: **arquitectura dual incoherente** (Supabase directo vs. tRPC), **flujo de registro/invitación de brokers roto**, y **modelo de datos inconsistente entre tablas**.

---

## 1. Problema Crítico: Registro de Brokers Completamente Roto

### Descripción

La página `BrokerRegister.tsx` envía la solicitud de registro a una **Supabase Edge Function** que **no existe** en el servidor Express actual:

```
fetch(`${SUPABASE_URL}/functions/v1/request-broker-access`, ...)
```

El servidor Express solo tiene endpoints para **aprobar** y **rechazar** registros (`/api/approve-broker-registration`, `/api/reject-broker-registration`), pero **no tiene endpoint para crear la solicitud** de registro. Esto significa que un broker que recibe un enlace de invitación y completa el formulario de registro **nunca puede enviar su solicitud**.

### Flujo esperado vs. flujo real

| Paso | Esperado | Realidad |
|------|----------|----------|
| 1. Admin genera enlace de invitación | Funciona (local, sin persistencia) | Funciona |
| 2. Broker abre enlace y rellena formulario | Funciona (UI) | Funciona |
| 3. Broker envía solicitud de registro | Crea registro en `broker_registration_requests` + usuario en Supabase Auth | **FALLA**: llama a Edge Function inexistente |
| 4. Admin ve solicitud pendiente | Lee de `broker_registration_requests` | No hay datos que mostrar |
| 5. Admin aprueba solicitud | Crea `transfer_brokers` + `broker_profiles` | Nunca se alcanza |
| 6. Broker inicia sesión | Lee `broker_profiles` por `user_id` | Nunca se alcanza |

### Acción requerida

Crear un endpoint Express `/api/request-broker-access` que:
1. Reciba `{ organization_id, name, company, email, phone, password }`.
2. Cree un usuario en Supabase Auth con `email` y `password`.
3. Inserte un registro en `broker_registration_requests` con `status: 'pending'` y `user_id` del nuevo usuario.
4. Actualizar `BrokerRegister.tsx` para llamar a `/api/request-broker-access` en lugar de la Edge Function.

---

## 2. Problema Crítico: Modelo de Datos Dual e Inconsistente para Brokers

### Descripción

Existen **dos tablas** que representan conceptos de broker de forma solapada e inconsistente:

| Tabla | Propósito declarado | Campos clave | Usado por |
|-------|---------------------|--------------|-----------|
| `transfer_brokers` | Catálogo de brokers de la organización | `id`, `name`, `email`, `phone`, `company`, `user_id`, `is_active` | Admin panel (hooks `useTransferBrokers`, `BrokerTable`, `BrokerManagement`) |
| `broker_profiles` | Perfil de acceso al portal broker | `id`, `user_id`, `broker_id`, `organization_id`, `name`, `email`, `is_active` | Portal broker (`BrokerAuthContext`, `BrokerLogin`) |

### Inconsistencias detectadas

**a) Campo `user_id` duplicado y desconectado:**
- `transfer_brokers.user_id` se usa en `BrokerTable.tsx` para determinar si el portal está "Configurado" (línea 152: `broker.user_id ? "Configurado" : "Configurar"`).
- `broker_profiles.user_id` se usa en `BrokerAuthContext` para autenticar al broker.
- El endpoint de aprobación (`handleApproveBrokerRegistration`) crea `broker_profiles` pero **nunca actualiza** `transfer_brokers.user_id`, por lo que la UI de admin siempre mostrará "Configurar" incluso para brokers aprobados.

**b) Campo `portal_email` / `portal_access` fantasma:**
- `setupPortalAccess` en `useTransferBrokers.ts` intenta actualizar `transfer_brokers.portal_email` y `transfer_brokers.portal_access`, pero estos campos **probablemente no existen** en la tabla (no aparecen en el tipo `TransferBroker` ni en ningún schema visible). La operación falla silenciosamente o genera error.

**c) El `broker.id` del contexto broker no es el `transfer_brokers.id`:**
- `BrokerAuthContext` carga el perfil desde `broker_profiles` y expone `broker.id` que es el **id de `broker_profiles`**, no el de `transfer_brokers`.
- Sin embargo, `useBrokerRequests` usa `broker.id` como `broker_id` al crear solicitudes, donde `transfer_requests.broker_id` debería referenciar a `transfer_brokers.id`.
- Esto genera una **ruptura de integridad referencial**: las solicitudes creadas desde el portal broker tienen un `broker_id` que apunta a `broker_profiles.id` en lugar de `transfer_brokers.id`.

### Acción requerida

Unificar el modelo para que:
1. Al aprobar un broker, se actualice `transfer_brokers.user_id` con el `user_id` del usuario Supabase.
2. `broker_profiles.id` se reemplace por `broker_profiles.broker_id` (que apunta a `transfer_brokers.id`) como identificador de broker en el contexto.
3. `BrokerAuthContext` exponga `broker.id` = `transfer_brokers.id` (vía `broker_profiles.broker_id`).
4. Eliminar los campos fantasma `portal_email` y `portal_access` de la lógica de `setupPortalAccess`.

---

## 3. Problema Grave: Toda la Capa de Datos Usa Supabase Directo en Lugar de tRPC

### Descripción

El template actual del proyecto está basado en **tRPC + Express**, pero el módulo de Transfers **ignora completamente tRPC** y hace todas las operaciones directamente contra Supabase desde el cliente:

| Componente | Método de acceso a datos |
|------------|-------------------------|
| Hooks de Transfer (`useTransferRequests`, `useTransferItems`, etc.) | `supabase.from('tabla')` directo |
| Hooks de Broker (`useBrokerRequests`, `useTransferBrokers`, etc.) | `supabase.from('tabla')` directo |
| Contexto de Auth Broker (`BrokerAuthContext`) | `supabase.from('broker_profiles')` directo |
| Endpoints de registro broker | Express + Supabase service client |
| Endpoint de parse documento | Express + Supabase service client |

Esto significa que:
- **No hay validación server-side** para la mayoría de operaciones CRUD de transfers.
- La seguridad depende enteramente de **Supabase RLS** (Row Level Security), que puede no estar configurada correctamente para todas las tablas.
- No se aprovecha el sistema de autenticación tRPC (`protectedProcedure`, `ctx.user`).

### Acción requerida (a largo plazo)

Migrar gradualmente los hooks a tRPC procedures. Sin embargo, **esto NO es prioritario** para resolver los problemas funcionales inmediatos. El sistema puede funcionar con Supabase directo si las RLS están bien configuradas.

---

## 4. Problema Grave: `BrokerRequestDetail` Carga Cualquier Solicitud Sin Verificación

### Descripción

El hook `useBrokerRequestDetail(id)` carga una solicitud por `id` sin filtrar por `organization_id`:

```ts
const { data, error } = await supabase
  .from('transfer_requests')
  .select('*, items:transfer_items(*), documents:transfer_documents(*)')
  .eq('id', id)
  .single();
```

Esto permite que un broker autenticado pueda ver solicitudes de **cualquier organización** si conoce el UUID. La protección `isOwnRequest` en la UI es solo cosmética.

### Acción requerida

Agregar filtro `.eq('organization_id', broker.organization_id)` en `useBrokerRequestDetail`.

---

## 5. Problema Medio: Dependencias de Router Mixtas

### Descripción

El proyecto tiene **ambos** `react-router-dom` y `wouter` instalados:
- 119 archivos usan `react-router-dom` (todo el proyecto original).
- 0 archivos usan `wouter` (viene del template nuevo).
- El template de Manus espera `wouter`, pero el proyecto funciona con `react-router-dom`.

### Acción requerida

Mantener `react-router-dom` como router principal (ya que 119 archivos lo usan) y no migrar a `wouter`. Esto no causa problemas funcionales inmediatos.

---

## 6. Problema Medio: `useTransferNotes` Envía Notificaciones Desde el Cliente

### Descripción

La función `dispatchNoteNotifications` en `useTransferNotes.ts` ejecuta lógica compleja de notificaciones **desde el cliente**, incluyendo:
- Consultar `transfer_brokers` para obtener `user_id` de todos los brokers.
- Consultar `profiles` para obtener admins/owners.
- Insertar notificaciones masivas.

Esto debería ser lógica server-side por seguridad y fiabilidad.

### Acción requerida (prioridad media)

Mover la lógica de notificaciones a un endpoint Express o tRPC procedure.

---

## Plan de Remediación Propuesto

### Fase 1: Correcciones Críticas (Inmediatas)

| # | Acción | Archivos afectados |
|---|--------|-------------------|
| 1 | Crear endpoint `/api/request-broker-access` en Express | Nuevo: `server/brokerRequestAccess.ts`, Modificar: `server/_core/index.ts` |
| 2 | Actualizar `BrokerRegister.tsx` para usar el nuevo endpoint | `client/src/pages/broker/BrokerRegister.tsx` |
| 3 | En `handleApproveBrokerRegistration`, actualizar `transfer_brokers.user_id` al aprobar | `server/brokerRegistrationEndpoints.ts` |
| 4 | Hacer que `BrokerAuthContext` exponga `broker_profiles.broker_id` como `broker.id` | `client/src/contexts/BrokerAuthContext.tsx` |
| 5 | Agregar filtro `organization_id` en `useBrokerRequestDetail` | `client/src/hooks/useBrokerRequests.ts` |
| 6 | Arreglar `setupPortalAccess` para que actualice `transfer_brokers.user_id` en lugar de campos inexistentes | `client/src/hooks/useTransferBrokers.ts` |

### Fase 2: Limpieza de Datos (Inmediata)

| # | Acción |
|---|--------|
| 1 | Verificar que la tabla `broker_profiles` tiene columna `broker_id` que referencia `transfer_brokers.id` |
| 2 | Verificar/crear columnas necesarias en `broker_registration_requests` |
| 3 | Limpiar datos huérfanos si existen |

### Fase 3: Mejoras de Seguridad (Corto plazo)

| # | Acción |
|---|--------|
| 1 | Mover lógica de notificaciones de notas al servidor |
| 2 | Agregar validación de `organization_id` en todos los hooks del portal broker |
| 3 | Revisar RLS de Supabase para todas las tablas de transfers |

---

## Resumen de Impacto

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| **Crítico** | 2 | Registro de brokers roto + modelo de datos inconsistente |
| **Grave** | 2 | Sin validación server-side + acceso cross-org en detalle |
| **Medio** | 2 | Router mixto + notificaciones client-side |

Las correcciones de Fase 1 son **imprescindibles** para que el flujo de invitación, registro, aprobación y acceso al portal broker funcione de extremo a extremo.
