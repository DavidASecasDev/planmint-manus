# Auditoría de Coherencia — PlanMint (Junio 2026)

**Fecha:** 7 de junio de 2026  
**Alcance:** Conexiones entre módulos, coherencia de flujos de datos, patrones de acceso  
**Enfoque:** Verificar que todo está conectado correctamente y tiene sentido lógico

---

## Resumen Ejecutivo

El proyecto ha evolucionado significativamente desde la auditoría de marzo 2026. Los endpoints Express del servidor están bien conectados con el frontend, los flujos de las TVs públicas son coherentes, y el ciclo de vida del vehículo (alquilado → sucio → incompleto → limpio) funciona correctamente de extremo a extremo. Se identifican **6 problemas de coherencia**, ninguno crítico para la operativa diaria.

---

## Arquitectura Actual Verificada

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Frontend | React 18 + react-router-dom v6 + TanStack Query | Correcto |
| Backend | Express 4 + endpoints custom (24.000 líneas) | Correcto |
| Base de datos | Supabase (PostgreSQL) | Correcto |
| Proxy de datos | `/api/supabase-query` (org_id auto-inject) | Correcto |
| Auth frontend | Supabase Auth | Correcto |
| Auth backend | JWT custom (verificación de Supabase JWT) | Correcto |
| TVs públicas | Endpoints sin auth + service_role key | Correcto |
| Sync externa | Rently API (scheduled poll) | Correcto |

---

## Flujos Verificados como Coherentes

### 1. Ciclo de vida del vehículo

```
Reserva activa → alquilado (syncRently)
    ↓
Reserva termina → sucio + reset tareas (syncRently)
    ↓
Empleado limpia tareas → incompleto (trigger SQL)
    ↓
Todas las tareas completadas → limpio (trigger SQL)
    ↓
Nueva reserva → alquilado (syncRently)
```

**Módulos involucrados:**
- `server/syncRently.ts` — Gestiona transiciones alquilado ↔ sucio
- `server/publicPreparationEndpoint.ts` — Muestra pendientes, filtra los ya limpios
- `server/publicOperationsEndpoint.ts` — Calcula estado real basado en tareas
- `client/src/hooks/useVehicles.ts` — Toggle de tareas de limpieza
- Trigger SQL `auto_transition_vehicle_to_clean` — Transición automática a limpio

**Veredicto: COHERENTE**

---

### 2. TV de Operaciones (`/ops/operaciones`)

```
Frontend: PublicOperationsTV.tsx
    → fetch("/api/public/operations/azul-ops?date=YYYY-MM-DD")
        → publicOperationsEndpoint.ts
            → Supabase (service_role): reservations + vehicles + vehicle_cleaning_tasks + fleet_vehicles
                → Calcula vehicleStatus basado en tareas reales
                    → Responde JSON con operaciones del día
```

**Veredicto: COHERENTE** — El icono de estado se calcula correctamente basándose en tareas completadas.

---

### 3. TV de Preparación (`/ops/preparacion`)

```
Frontend: PublicPreparation.tsx
    → fetch("/api/public/preparacion")
        → publicPreparationEndpoint.ts
            → Supabase (service_role): preparation_list (status=pending) + vehicles + vehicle_cleaning_tasks
                → Filtra vehículos con TODAS las tareas completadas (no los muestra)
                    → Responde JSON con pendientes reales
```

**Veredicto: COHERENTE** — Los vehículos ya limpios no aparecen como pendientes.

---

### 4. Proxy de Supabase (acceso autenticado)

```
Frontend hook (ej: useTasks)
    → supabaseQuery.from("tasks").select("*")
        → POST /api/supabase-query
            → authenticateSupabaseRequest (verifica JWT)
            → detecta si tabla tiene org_id (introspección + fallback)
            → auto-inyecta .eq("organization_id", userOrgId)
            → ejecuta query con service_role key
                → Responde datos filtrados por organización
```

**Veredicto: COHERENTE** — El proxy protege correctamente el multi-tenancy.

---

## Problemas de Coherencia Detectados

### 1. `is_archived = null` excluye vehículos — RIESGO MEDIO

**Problema:** La tabla `vehicles` tiene `is_archived: boolean | null`. Los filtros `.eq("is_archived", false)` excluyen vehículos con `is_archived = null` porque en PostgreSQL `null ≠ false`.

**Archivos afectados:**
- `server/publicOperationsEndpoint.ts` (líneas 141, 331)
- `server/preparationEndpoints.ts` (línea 69)
- `server/dashboardEndpoint.ts` (líneas 59, 121, 130, 138)
- `server/timelineEndpoint.ts` (líneas 332, 594)
- `client/src/hooks/useVehicles.ts` (línea 36)

**Nota:** `server/preparationProgressEndpoints.ts` ya fue corregido (busca sin filtro `is_archived`).

**Solución recomendada:**
```sql
UPDATE vehicles SET is_archived = false WHERE is_archived IS NULL;
ALTER TABLE vehicles ALTER COLUMN is_archived SET DEFAULT false;
ALTER TABLE vehicles ALTER COLUMN is_archived SET NOT NULL;
```

---

### 2. Org ID hardcodeado en lugar de usar constante centralizada — RIESGO BAJO

**Problema:** `shared/const.ts` exporta `AZUL_CARS_ORG_ID`, pero tres archivos definen su propia copia local:

| Archivo | Patrón |
|---------|--------|
| `server/publicPreparationEndpoint.ts` | `const AZUL_CARS_ORG_ID = "a23a0d42..."` (local) |
| `server/publicOperationsEndpoint.ts` | `ORG_SLUG_MAP` con el ID inline |
| `server/timelineEndpoint.ts` | `ORG_SLUG_MAP` con el ID inline |

**Solución:** Importar de `shared/const.ts` en todos los archivos.

---

### 3. Doble patrón de acceso a datos en frontend — RIESGO BAJO

**Problema:** El frontend usa dos patrones:
- **`supabaseQuery` (proxy):** ~560 usos — pasa por el servidor, auto-inyecta org_id
- **`supabase` directo (anon key):** ~166 usos — accede directamente, depende de RLS

**Hooks que usan acceso directo:**
- `useVehicles.ts` — Todo el CRUD de vehículos y tareas de limpieza
- `useAccidentFiles.ts`, `useAreas.ts`, `useBillingActions.ts`
- `useReservations.ts`, `useLostFound.ts`, `useTasks.ts` (parcial)
- `useLocationTrail.ts`, `useRealtimeEnCamino.ts` (realtime channels — legítimo)

**Impacto real:** Bajo. Los accesos directos filtran explícitamente por `organization_id` y las tablas tienen RLS. Pero es inconsistente como patrón.

---

### 4. `EXCLUDED_PLATES` solo en timeline, no en operaciones — RIESGO BAJO

**Problema:** `timelineEndpoint.ts` excluye la matrícula `6513MFG` (vehículo dummy), pero `publicOperationsEndpoint.ts` no aplica esta exclusión.

**Impacto:** Si este vehículo tiene reservas activas, aparecería en la TV de operaciones. Probablemente no es un problema si está archivado.

---

### 5. tRPC configurado pero no utilizado — RIESGO NULO

**Problema:** El template de Manus incluye tRPC (`server/routers.ts`), pero el proyecto usa exclusivamente endpoints Express custom. El `main.tsx` no incluye tRPC providers. Solo existe `auth.me`, `auth.logout` y `ocr.recognizePlate` como procedimientos.

**Impacto:** Ninguno funcional. Es código muerto del template.

---

### 6. `vehicle_cleaning_tasks` sin `organization_id` — RIESGO NULO

**Problema:** La tabla no tiene columna `organization_id`. Se accede siempre via `vehicle_id` (FK a `vehicles` que sí tiene org_id).

**Impacto:** Ninguno. El filtrado por `vehicle_id` ya garantiza el scope organizacional.

---

## Tabla Resumen de Riesgos

| # | Problema | Severidad | Impacto Operativo | Acción Recomendada |
|---|----------|-----------|-------------------|-------------------|
| 1 | `is_archived = null` | Media | Vehículos podrían no aparecer | Migrar NULLs a false |
| 2 | Org ID hardcodeado x3 | Baja | Solo mantenibilidad | Centralizar imports |
| 3 | Doble patrón de acceso | Baja | Funciona pero inconsistente | Migrar gradualmente |
| 4 | EXCLUDED_PLATES parcial | Baja | Vehículo dummy podría aparecer | Añadir filtro o verificar |
| 5 | tRPC sin usar | Nula | Código muerto | Ignorar |
| 6 | cleaning_tasks sin org_id | Nula | Funciona via FK | No requiere acción |

---

## Conexiones Verificadas Correctas

| Origen | Destino | Conexión | Estado |
|--------|---------|----------|--------|
| `PublicOperationsTV.tsx` | `/api/public/operations/:slug` | fetch directo | OK |
| `PublicPreparation.tsx` | `/api/public/preparacion` | fetch directo | OK |
| `useVehicles.ts` | Supabase directo | anon key + RLS | OK |
| `useTasks.ts` | `/api/supabase-query` (proxy) | supabaseQuery | OK |
| `syncRently.ts` | Supabase service_role | getServiceClient() | OK |
| `publicOperationsEndpoint.ts` | Supabase service_role | getServiceClient() | OK |
| `publicPreparationEndpoint.ts` | Supabase service_role | getServiceClient() | OK |
| `scheduledRentlyPoll.ts` | `syncRently.ts` | import directo | OK |
| `App.tsx` → Routes | Pages | react-router-dom v6 | OK |
| `AuthContext.tsx` | Supabase Auth | supabase.auth | OK |
| `main.tsx` → SW | `client/public/sw.js` | Service Worker | OK |

---

## Conclusión

El proyecto está **bien conectado y es coherente en sus flujos operativos principales**. Las TVs públicas, el ciclo de limpieza, la sincronización con Rently y el proxy de datos funcionan correctamente. El problema más relevante para la operativa diaria es el filtro `is_archived = null` que podría ocultar vehículos en algunas vistas. Los demás problemas son de mantenibilidad y consistencia de patrones, no de funcionalidad rota.

**Recomendación inmediata:** Ejecutar el SQL de migración de `is_archived` para eliminar los NULLs.
