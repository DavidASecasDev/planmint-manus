# SES.HOSPEDAJES — Flujo operativo simplificado

**Fecha:** 31 de agosto de 2026  
**Estado:** código propuesto y probado; **sin migraciones nuevas, sin SQL en producción, sin sincronización real, sin preparar reservas, sin generar XML real, sin publicar y sin desplegar**.

## Diseño final

> **Sincronizar Rently → Completar faltantes → Validar campos → Seleccionar reservas listas → Descargar XML**

La implementación reutiliza la integración Rently, los perfiles, ubicaciones, borradores, validación y generador XML existentes. El inventario oficial, la conciliación, la elegibilidad, las excepciones y la configuración XSD permanecen como historia y compatibilidad interna, pero ya no forman parte de la ruta diaria ni bloquean la selección o la descarga.

| Decisión | Implementación verificable |
|---|---|
| Sincronización total | La UI llama primero a `/api/rently/sync` con `include_all=true` hasta consumir todas las páginas y después recorre `/api/ses/sync-drafts` por lotes. |
| Identidad estable | Rently se deduplica por `booking.Id`; `reservations` conserva `organization_id + external_reservation_id` y cada borrador se actualiza por `organization_id + reservation_id`. |
| Precedencia | Un campo marcado manual nunca se reemplaza; un valor Rently vacío tampoco borra uno existente. Toda discrepancia queda en `syncConflicts`. |
| Conductores | El titular se usa como conductor principal cuando comparten identidad. El primer conductor adicional fiable de Rently se enlaza como segundo conductor; los datos que Rently no entrega quedan pendientes, no se inventan. |
| Estados | Solo se muestran **Incompleta**, **Listo** y **XML generado**. Los estados históricos continúan almacenados, pero se proyectan a esos tres estados. |
| Disponibilidad | `readyForXml=true` únicamente cuando `missingFields` e `invalidFields` están vacíos. |
| Duplicados SES | `Comprobar SES` actualiza `sesDuplicateWarning`. El aviso es visible, pero nunca cambia estado, disponibilidad ni selección. |
| XML | Solo usa los IDs seleccionados, rechaza IDs o referencias repetidas, revalida cada contrato y ejecuta el contrato estructural local 1.2.0 antes de descargar. |
| Privacidad visual | La ruta `/__fixtures/ses-hospedajes` solo existe en desarrollo, usa datos marcados `SYNTHETIC-*`, no invoca autenticación, Supabase ni endpoints, y no entra en `dist`. |

## Contrato operativo expuesto

| Campo | Contenido |
|---|---|
| `missingFields` | Campos obligatorios ausentes. Si TI y CP son el mismo perfil, el mismo dato personal se cuenta una sola vez. |
| `invalidFields` | Formatos o incoherencias detectados. |
| `sourceByField` | `rently`, `manual` o `derived`. |
| `syncConflicts` | Valor entrante distinto de una corrección manual preservada. |
| `readyForXml` | Disponibilidad derivada solo de validación. |
| `sesDuplicateWarning` | Aviso informativo de posible comunicación previa. |

## Obligatorios y opcionales

Son obligatorios el contrato, referencia, fechas, recogida y devolución, vehículo, titular, conductor principal, tipo de pago, kilómetros iniciales, domicilio estructurado, contacto y los tres datos del permiso de CP/CS: tipo, validez y número. El segundo conductor es opcional; si se incluye, sus tres datos de permiso pasan a ser obligatorios.

No aumentan **Faltan** cuando están ausentes: nacimiento, nacionalidad, sexo, segundo apellido salvo reglas específicas del documento, país expedidor, soporte del permiso, kilómetros finales, GPS, fecha/medio/titular/caducidad del pago y segundo conductor.

## Diff significativo

| Área | Archivos principales | Cambio |
|---|---|---|
| Modelo operativo | `operationalDraft.ts`, `readiness.ts`, tipos frontend | Tres estados, división de ausentes/inválidos, procedencia, conflictos y aviso. |
| Sincronización | `syncRently.ts`, `sesEndpoints.ts`, `additionalDrivers.ts` | Inclusión de todos los estados, paginación completa, deduplicación estable, upsert idempotente y segundo conductor. |
| Validación | `validation.ts`, `officialStructuralContract.ts` | Obligatorios funcionales, opcionales correctos y rechazo de marcadores de plantilla. |
| XML | `sesEndpoints.ts`, `xml.ts` y pruebas | Selección exacta, validación previa, una solicitud con 1..n comunicaciones y sin XSD como puerta. |
| Interfaz | `SesHospedajes.tsx`, `SesDraftEditor.tsx`, filtros, acciones y manual | Flujo mínimo, nombres exactos de pendientes, procedencia/conflictos, selección y descarga. |
| Pruebas visuales | `SesHospedajesFixture.tsx`, `SesVisualFixtureIsolation.test.ts` | Fixture exclusivamente sintética, aislada de producción y excluida del build. |

El diff final contiene cambios funcionales en servidor, cliente, pruebas y documentación. **No modifica ningún archivo bajo `supabase/migrations/`** y no propone migración nueva.

## Resultados

| Verificación | Resultado |
|---|---|
| Regresión completa SES | **129/129 pruebas aprobadas**, 37 archivos. |
| Matriz focal | **49/49 pruebas aprobadas**, 11 archivos. |
| Conductores y precedencia | **22/22 pruebas aprobadas**, incluidas identidad mínima, omisión segura y segundo conductor manual. |
| TypeScript | `pnpm check`: aprobado, 0 errores. |
| Build local | `pnpm build`: aprobado. Solo avisos preexistentes de chunks grandes. |
| Fixture en producción | Búsqueda en `dist`: 0 coincidencias para `SYNTHETIC-65001`. |
| Diff | `git diff --check`: aprobado. |
| UI crítica antigua | 0 coincidencias en la ruta operativa para preparar, revalidar, inventario JSON o control oficial. |
| Migraciones | 0 archivos de migración modificados. |

## Limitaciones explícitas

Rently solo aporta para algunos conductores adicionales nombre, documento y número de permiso. Cuando no aporta apellido, domicilio, tipo o validez del permiso, PlanMint no inventa información: deja esos campos visibles como pendientes para edición humana.

La comprobación SES sigue siendo manual contra el portal y genera un aviso; no realiza envío ni consulta automatizada al Gobierno. La validación de descarga usa la plantilla y las Instrucciones v1.2.0 aportadas, no un XSD auténtico. Si en el futuro se incorpora un XSD oficial, deberá revisarse por separado y no se cargó en esta iteración.

## Punto de parada

No se consultaron ni modificaron datos reales para estas pruebas. Las capturas se realizaron únicamente en la fixture sintética de desarrollo. Los logs locales de desarrollo se vacían antes de la entrega. La implementación queda detenida para revisión independiente antes de cualquier operación real, publicación o despliegue.
