# SES.HOSPEDAJES — Entrega para revisión independiente

**Autor:** Manus AI  
**Fecha:** 28 de agosto de 2026  
**Estado:** código y migración propuestos; **sin aplicar SQL ni migraciones en producción, sin importar inventario, sin cargar XSD, sin preparar reservas, sin generar XML y sin publicar ni desplegar**.

> Todo el trabajo de esta iteración se limitó al repositorio, pruebas sintéticas, una base PostgreSQL local desechable y una vista visual temporal con datos ficticios. No se usaron credenciales ni datos personales reales.

## Decisiones de diseño

| Área | Decisión implementada | Garantía |
|---|---|---|
| Validación XML sin XSD | Se valida contra un contrato estructural local derivado de la plantilla oficial aportada y de las Instrucciones v1.2.0. | El modo se identifica como `official_contract`; nunca se denomina XSD oficial. |
| XSD auténtico futuro | Una configuración completa con clave, versión y SHA-256 activa `official_xsd` y tiene precedencia estricta. | Una configuración parcial, descarga fallida o hash distinto bloquea la exportación; no hay fallback silencioso. |
| Estructura XML | Una raíz `peticion` contiene una única `solicitud` y una o más `comunicacion`. | Se corrige el empaquetado anterior que creaba una `solicitud` por comunicación. |
| Conciliación oficial | La comprobación se realiza bajo demanda para la identidad exacta `referencia + tipo + fecha + matrícula normalizada`. | Activa/aceptada bloquea; anulada/error/fecha o matrícula distinta exige `needs_revision`; no encontrada queda clara solo para esa identidad. |
| Persistencia oficial | La evidencia encontrada se añade mediante `upsert` por código oficial y nunca se reemplaza con una lista vacía. | Un código oficial existente no puede reasignarse a otra identidad contractual. |
| Selección Rently | Se leen todas las páginas del listado filtrado con `CurrentStatus=2`, `IsTransfer=false` y `DeliveryBranchOffice=1`. | El contador del widget no limita candidatos; la selección real sale de la respuesta paginada. |
| Intersección PlanMint | Se cruza por identificador de reserva y matrícula normalizada, y después se confirma el detalle contractual. | Matrícula distinta, transferencia, otra sucursal, entrega futura/ausente o detalle incoherente quedan excluidos o en revisión. |
| Terminadas | No se incorporan automáticamente. | Solo una excepción temporal para `rently_status_code=3`, con protocolo, motivo, actor y caducidad máxima de 7 días, permite continuar evaluando las demás puertas. |
| No reenvío histórico | `batched`, `uploaded_pending_result` y `accepted` son estados bloqueados por una función general. | No depende de referencias o códigos de arrendador concretos. |
| Paginación | La interfaz usa 50 filas por página, controles arriba y abajo, página actual, rango visible y total filtrado. | El servidor mantiene conteo exacto y resumen sobre todo el conjunto filtrado, no solo sobre la página. |
| Compatibilidad | Las lecturas heredadas siguen disponibles y las mutaciones endurecidas continúan bloqueadas si falta el esquema requerido. | La nueva excepción devuelve un error explícito si no se ha revisado/aplicado su migración propuesta. |

## Diff significativo

### Servidor y dominio

| Archivo | Cambio |
|---|---|
| `server/sesHospedajes/officialStructuralContract.ts` | Nuevo validador estructural de namespace, orden, cardinalidades, personas, ubicaciones, formatos y enumeraciones. |
| `server/sesHospedajes/xmlValidationMode.ts` | Selección pura y comprobable de `official_contract` o `official_xsd`. |
| `server/sesHospedajes/xml.ts` | Corrige `peticion > solicitud única > comunicacion (1..n)`. |
| `server/sesHospedajes/officialInventory.ts` | Sustituye cobertura global por comprobación exacta, normalización de matrícula y hash SHA-256 de identidad. |
| `server/sesHospedajes/candidateIntersection.ts` | Implementa la intersección determinista Rently–PlanMint con exclusiones explicables. |
| `server/sesHospedajes/rentlyEnrichment.ts` | Añade lectura paginada del listado Rently con los tres filtros SES y reutilización segura de credenciales ya configuradas. |
| `server/sesHospedajes/eligibility.ts` | Exige evidencia explícita de intersección y modela la excepción temporal sin relajar las demás reglas. |
| `server/sesHospedajes/readiness.ts` | Centraliza estados históricos no reenviables. |
| `server/sesHospedajes/sesEndpoints.ts` | Reestructura preparación, revalidación, comprobación oficial, exportación, inventario aditivo y excepciones manuales. |
| `server/sesHospedajes/schemaCompatibility.ts` | Añade diagnóstico claro para el esquema de excepciones propuesto. |
| `server/_core/index.ts` | Registra las nuevas rutas autenticadas de comprobación oficial y excepciones. |

### Interfaz

| Archivo | Cambio |
|---|---|
| `client/src/components/ses/SesComplianceDialog.tsx` | Explica que el inventario masivo es opcional/aditivo y que el XSD auténtico tiene precedencia futura. |
| `client/src/components/ses/SesOfficialCheckDialog.tsx` | Nuevo flujo por contrato para registrar “no encontrada” o evidencia oficial encontrada. |
| `client/src/components/ses/SesEligibilityExceptionDialog.tsx` | Nuevo flujo confirmado para crear o revocar una excepción temporal auditable. |
| `client/src/components/ses/SesPagination.tsx` | Controles visibles y accesibles de página, rango y total. |
| `client/src/pages/ses/SesHospedajes.tsx` | Integra comprobación exacta, revalidación Rently, excepciones y paginación superior/inferior. |
| `client/src/hooks/useSesHospedajes.ts` | Actualiza contratos API y mutaciones; elimina semántica de cobertura global. |
| `client/src/lib/sesManual.ts` | Actualiza el manual operativo a la arquitectura propuesta. |

### Documentación, migración y pruebas

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20260828190000_ses_exact_reconciliation_and_exceptions.sql` | Nueva migración forward-only para `ses_eligibility_exceptions`; no ejecutada. |
| `scripts/test-ses-exact-reconciliation-migration.sh` | Fixture local desechable que aplica la migración dos veces y valida preservación, RLS e idempotencia. |
| `docs/SES_HOSPEDAJES_IMPLEMENTATION.md` | Documenta validadores, intersección, conciliación exacta, excepciones y paginación. |
| `docs/SES_HOSPEDAJES_RECOVERY_PLAN.md` | Sustituye el bloqueo por ausencia de XSD por el contrato estructural documentado, manteniendo precedencia futura. |
| Pruebas nuevas/actualizadas | Cubren lista 65 vs widget 64, más de 200 filas, matrícula, entrega futura, transferencia, sucursal, terminadas, duplicados, anuladas/versiones, XSD presente/ausente y protección histórica. |

## Migración propuesta y no ejecutada

**Archivo:** `supabase/migrations/20260828190000_ses_exact_reconciliation_and_exceptions.sql`  
**SHA-256:** `abeedd87c3f5b44978bf6844f6f6b74af274b17973a432f35380c34b5f7a94c0`

La migración crea únicamente `public.ses_eligibility_exceptions`, sus restricciones, índices, trigger de `updated_at`, RLS forzado y acceso para `service_role`. Exige protocolo de 3–120 caracteres, motivo de 10–1000, aprobación por perfil, expiración posterior a la aprobación y revocación coherente. Incluye una única excepción no revocada por organización y borrador.

La transacción captura los conteos de todas las tablas SES históricas relevantes y aborta antes de `COMMIT` si cambia alguno. No contiene sentencias `DROP`, `TRUNCATE` ni `DELETE`; las apariciones de `ON DELETE` son únicamente reglas referenciales de claves foráneas. Tampoco contiene las referencias 4942/5164/5343 ni el código de arrendador señalado.

## Resultados de pruebas

| Verificación | Resultado |
|---|---|
| Regresión completa SES | **92/92 pruebas aprobadas** en 28 archivos. |
| Matriz focal de aceptación | **37/37 pruebas aprobadas** en 11 archivos. |
| TypeScript | `pnpm check`: **aprobado, 0 errores**. |
| Build local | `pnpm build`: **aprobado**. Vite solo emitió avisos preexistentes de chunks mayores de 500 kB. |
| Suite global PlanMint | **1.455/1.456 pruebas aprobadas**; único fallo externo y no relacionado: `server/xexunPoll.test.ts`, el servicio Xexun respondió código 401 en lugar de 200. |
| Migración sintética local | **Aprobada dos veces** sobre PostgreSQL desechable: 224/19/204/1 preservados, idempotencia, campos de auditoría, `authenticated` denegado y `service_role` permitido. |
| Diff | `git diff --check`: **aprobado**. |
| Referencias productivas especiales | Búsqueda en servidor, cliente, documentación y nueva migración: **0 coincidencias productivas**; los números históricos solo permanecen en pruebas/fixtures o artefactos históricos excluidos. |
| Verificación visual sintética | Escritorio 1440×1000 y móvil 390×844: paginación legible y diálogo de excepción usable; no se cargaron datos reales. |

## Matriz de aceptación

| Caso solicitado | Cobertura | Resultado |
|---|---|---|
| 65 candidatos frente a contador visual 64 | `rentlyCandidates.test.ts` | Se procesan las 65 filas devueltas; el contador no gobierna. |
| Más de 200 borradores | `sesPagination.test.ts` | 367 registros producen 8 páginas y rangos exactos. |
| Matrícula coincidente/distinta | `candidateIntersection.test.ts`, `eligibility.test.ts` | Coincidente entra; distinta se excluye/revisa. |
| Entrega futura | `eligibility.test.ts`, `referenceMutation.test.ts` | Nunca queda elegible. |
| Transferencia y otra sucursal | `eligibility.test.ts` | Se excluyen. |
| Terminada no comunicada | `eligibility.test.ts` | Revisión obligatoria; solo continúa con protocolo temporal vigente. |
| Duplicado activo/aceptado | `officialInventory.test.ts` | Bloqueado y no reenviable. |
| Anulada/error/versión distinta | `officialInventory.test.ts` | `needs_revision`. |
| XSD ausente | `xmlValidationMode.test.ts`, `officialStructuralContract.test.ts` | Usa contrato estructural 1.2.0. |
| XSD auténtico completo futuro | `xmlValidationMode.test.ts`, `xsdValidation.test.ts` | Precedencia estricta de `official_xsd`. |
| Configuración XSD parcial | `xmlValidationMode.test.ts` | Rechazada. |
| Lote/borrador histórico aceptado | `readiness.test.ts`, `referenceMutation.test.ts` | Bloqueado por hechos y estado, no por referencia. |

## Límites y punto de parada

El código todavía **no está publicado ni desplegado**. La nueva migración **no se ha aplicado** a Supabase. No se importó inventario oficial, no se cargó ningún XSD, no se prepararon reservas y no se generó XML. Cualquier operación real debe esperar revisión independiente y una autorización nueva y específica.

La suite global mantiene un único fallo externo de autenticación Xexun que ya existía y no está relacionado con SES.HOSPEDAJES. No se modificó ese módulo dentro de este alcance.
