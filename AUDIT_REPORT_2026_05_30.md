# Auditoría de Estado — PlanMint Preview (30 mayo 2026)

**Fecha:** 30 de mayo de 2026  
**Alcance:** Estado del servidor, errores de runtime, tests, items pendientes, deuda técnica  
**Estado general:** La aplicación está operativa. 1317 tests pasando, 0 errores TypeScript.

---

## 1. Estado del Servidor

| Indicador | Estado |
|-----------|--------|
| Dev server | Corriendo correctamente en puerto 3000 |
| TypeScript | 0 errores de compilación |
| Tests | 1317/1317 pasando |
| Errores 500 activos | 0 (los detectados fueron transitorios) |

---

## 2. Errores Detectados en Logs

### 2.1 `en-camino-tracking/status` — HeadersOverflowError (27/05)

**Severidad:** Baja (ocurrió 1 vez)

**Causa:** Se enviaron ~80 UUIDs en el body POST. La respuesta de Supabase generó headers demasiado grandes (`UND_ERR_HEADERS_OVERFLOW`).

**Estado actual:** No se reproduce. Error transitorio de red.

**Acción recomendada:** Si se repite, paginar las peticiones (máximo 30-40 IDs por llamada) o aumentar `--max-http-header-size`.

---

### 2.2 Timeline público — `buildInServiceMap is not defined` (28/05)

**Severidad:** Media (causó 500 en `/api/public/operations/azul-ops/timeline`)

**Causa:** Error transitorio durante hot-reload (HMR). El código actual usa `buildServicePeriodsMap` que sí existe y está correctamente definido. El servidor se reinició automáticamente y el error desapareció.

**Estado actual:** Código correcto. No reproducible tras restart limpio.

---

### 2.3 `DAY_WIDTH is not defined` en VehicleTimeline (28/05)

**Severidad:** Media (causó crash del componente timeline en PublicOperations)

**Causa:** Error transitorio durante HMR. La constante `DAY_WIDTH` fue renombrada a `dayWidth` (useMemo dinámico) en el commit de zoom stretch. Vite sirvió código parcialmente actualizado durante la transición.

**Estado actual:** Código correcto. Todas las referencias usan `dayWidth` (variable computada). No reproducible tras restart.

---

## 3. Items Pendientes (todo.md)

Se identifican **~14 items pendientes**. Clasificados por prioridad:

### Alta prioridad (afectan experiencia de usuario)

| Item | Descripción |
|------|-------------|
| Traducir textos inglés LiveMap | Textos en inglés visibles para usuarios españoles |
| Número de reserva en tarjetas sidebar/popups mapa | Información útil que falta en la UI |
| Rediseño página Mapa En Camino | Aspecto visual pendiente de mejora |

### Media prioridad (features planificadas)

| Item | Descripción |
|------|-------------|
| GPS en tiempo real (4 items) | Columnas BD existen, endpoint backend implementado, falta integración frontend |
| Vista replay trayecto en mapa | Backend tiene `handleEnCaminoLocationHistory`, falta UI |
| Migrar useTasks a useQuery | Marcado como alto riesgo de regresión, pospuesto |

### Baja prioridad (mejoras menores)

| Item | Descripción |
|------|-------------|
| Transfer wizard: ajustar resumen precios | Parcialmente implementado |
| Verificar flujo RENTLY sin conflictos sync | Verificación pendiente |

---

## 4. Deuda Técnica

### 4.1 Hooks con Supabase directo (~10 hooks sin migrar al proxy)

Los siguientes hooks aún usan `supabase` directamente en vez del proxy `supabaseQuery`:

- `useAccidentFiles.ts`
- `useBillingActions.ts`
- `useBrokerNotifications.ts`
- `useBrokerRegistrations.ts`
- `useFleetInspections.ts`
- `useIntegrationSettings.ts`
- `useRepairInvoices.ts`
- `useRepairPhotos.ts`
- `useTemplates.ts`
- `useTimeline.ts`

**Impacto:** Si el token de sesión Supabase caduca, estas queries pueden fallar silenciosamente.

**Recomendación:** Migrar gradualmente al proxy los hooks que hacen queries de datos (no realtime/storage).

### 4.2 Módulo debugRently eliminado

El log del 27/05 muestra `Cannot find module 'server/debugRently'`. El import ya fue eliminado del código actual. No es un problema activo.

---

## 5. Conclusión

La aplicación está en buen estado operativo. No hay errores activos que afecten la operación diaria. Los errores detectados en logs fueron todos transitorios (causados por hot-reload durante desarrollo) y no se reproducen con el código actual.

Los items pendientes principales son:
1. **Traducciones** — textos en inglés en LiveMap
2. **GPS en tiempo real** — backend listo, falta frontend
3. **Rediseño LiveMap** — mejora visual pendiente

Ninguno de estos bloquea el uso diario de la aplicación.
