# Recuperación compatible de SES.HOSPEDAJES

**Estado:** propuesta preparada y probada; **no aplicada en producción y no desplegada**.  
**Autor:** Manus AI  
**Fecha:** 28 de agosto de 2026

> Esta intervención se detiene antes de ejecutar SQL real. No se prepararon reservas, no se generó XML y no se modificó ningún dato de producción.

## Resumen ejecutivo

La causa raíz verificada es una **desalineación entre código y esquema**. El código endurecido consulta columnas y tablas nuevas, pero la base Supabase real conserva el esquema anterior. La consulta publicada falla antes de aplicar filtros porque `ses_contract_drafts.is_complete` no existe; las consultas de lotes, configuración e inventario fallan igualmente al solicitar `official_lot_code`, campos XSD y tablas nuevas. El frontend convierte esas respuestas fallidas en arreglos o valores vacíos, por lo que muestra ceros aunque los registros históricos siguen presentes.

No hay evidencia de una base equivocada: servidor y frontend apuntan al mismo proyecto Supabase. Tampoco hay evidencia de pérdida de datos. La tabla histórica conserva todos los borradores, el lote aceptado, su item, configuración, perfiles, lugares y auditoría.

| Evidencia de solo lectura en la base real | Resultado |
|---|---:|
| Borradores totales de la organización | 508 |
| Listos totales | 27 |
| Incompletos totales | 480 |
| Aceptados totales | 1 |
| Rango persistido 21/08/2026–27/09/2026 | **224** |
| Listos en ese rango | **19** |
| Incompletos en ese rango | **204** |
| Aceptados en ese rango | **1** |
| Lotes | 1 |
| Items de lote | 1 |
| Configuraciones | 1 |
| Perfiles SES reutilizables | 477 |
| Lugares SES reutilizables | 202 |
| Eventos de auditoría histórica | 165 |
| `ses_official_communications` | No existe todavía |
| `ses_historical_snapshots` | No existe todavía |
| `ses_field_audit_events` | No existe todavía |

La referencia **4942** permanece `accepted`; **5164** permanece `ready` en el esquema legado y debe pasar de forma explicada a `needs_revision`; **5343** permanece `incomplete` y será marcada como futura/no exportable. El lote `3d0ccc9e-a184-11f1-80b7-005056957a69` sigue almacenado en el lote histórico.

## Causa raíz y descarte de hipótesis

| Hipótesis | Resultado verificable |
|---|---|
| Entorno o base equivocada | Descartada: configuración de servidor y frontend usa el mismo host Supabase y la organización histórica está presente. |
| Pérdida o recreación de tablas | Descartada: las tablas históricas y sus conteos siguen intactos. |
| Filtros vacíos | Descartada como causa primaria: la consulta falla antes del filtrado por columnas no existentes. |
| RLS | No es la causa de los ceros del backend; el servicio llega a la tabla y recibe error de columna/esquema. |
| Estados nuevos | Contribuyen a la incompatibilidad, pero no borraron estados antiguos. |
| Backfill ausente | Confirmado: no existen las cuatro puertas ni los metadatos oficiales/XSD nuevos. |
| Migración no aplicada | **Confirmada como causa principal.** |
| Fallback frontend | Confirmado como amplificador visual: errores de consulta terminan presentados como `[]` o `0`. |

## Archivos propuestos

| Archivo | Función |
|---|---|
| `supabase/migrations/20260828143000_ses_hospedajes_compatibility_restore.sql` | Migración única forward-only, transaccional e idempotente. |
| `docs/migrations/20260828110000_ses_hospedajes_hardening.NOT_APPLIED.sql` | Referencia auditada de la migración anterior; retirada de la secuencia ejecutable para evitar saltos. |
| `server/sesHospedajes/schemaCompatibility.ts` | Detecta esquema legado y clasifica errores sin ocultar datos. |
| `server/sesHospedajes/sesEndpoints.ts` | Lecturas compatibles con esquema legado y bloqueo de todas las escrituras mientras falte migración. |
| `client/src/pages/ses/SesHospedajes.tsx` | Modo visible de solo lectura; conserva borradores/lote y desactiva preparar, editar, configurar y XML. |
| `server/sesHospedajes/eligibility.ts` | Protección explícita y acotada de 4942, 5164 y 5343. |
| `server/sesHospedajes/fixtures/*` | Fixture PostgreSQL anonimizada exacta y aserciones. |
| `scripts/test-ses-compatibility-migration.sh` | Ejecuta migración dos veces, comprueba conteos, idempotencia, RLS y multi-organización. |
| `server/sesHospedajes/migrationSafety.test.ts` | Impide SQL destructivo y exige transacción/precondiciones/postcondiciones. |

## SQL propuesto y garantías

La migración propuesta usa `BEGIN`/`COMMIT`; cualquier precondición o postcondición fallida aborta toda la transacción automáticamente. No contiene `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, recreación de tablas ni reseteos. Las tablas antiguas permanecen como fuente de verdad.

Antes del DDL se capturan en tablas temporales los IDs, estados, versiones, hashes, timestamps y representaciones JSON completas de borradores, lotes, items y configuración. Después del backfill se exige igualdad de conteos e identidades, igualdad de todas las columnas históricas y preservación de `payload_snapshot`. La única reclasificación permitida es **5164: `ready` → `needs_revision`** dentro de la organización cuyo `lessor_code` es `0000065825`.

| Objeto | Comportamiento propuesto |
|---|---|
| Cuatro puertas | Se añaden con valores conservadores. Ningún legado queda listo para XML sin revalidación posterior. |
| 4942 | Conserva estado `accepted`, item, lote, payload, versión y queda no reenviable. |
| 5164 | Pasa a `needs_revision`, `official_check_status=review` y `ready_for_xml=false`. |
| 5343 | Conserva el estado histórico, recibe motivo `future_delivery` y `ready_for_xml=false`. |
| Lote aceptado | Se extrae el UUID ya contenido en `notes` hacia `official_lot_code`; `notes` permanece intacto. |
| Comunicación aceptada | Se copia aditivamente desde el item histórico al inventario oficial; no se reasigna ni elimina. |
| `payload_snapshot` | Se conserva y se calcula un SHA-256 adicional sin reescribir el JSON. |
| Configuración | Se preserva íntegra; los campos XSD nuevos quedan `NULL`. |
| Inventario oficial | Inserciones con identidad única y `ON CONFLICT DO NOTHING`; una importación vacía es rechazada. |
| RLS | Las tablas nuevas revocan acceso a `anon`/`authenticated` y conceden acceso solo a `service_role`. |

## Resultado de la fixture anonimizada

La prueba crea dos organizaciones sintéticas. La principal contiene exactamente **224 borradores: 19 ready, 204 incomplete y 1 accepted**, un lote aceptado con el identificador histórico y un item con snapshot sintético. La segunda organización verifica aislamiento.

| Comprobación | Resultado |
|---|---|
| Conteo previo | 224/19/204/1 |
| Conteo posterior | 224, sin pérdida |
| Reclasificación explicada | 18 ready, 204 incomplete, 1 accepted, 1 needs_revision |
| Identidades de borradores/lotes/items/configuración | Iguales |
| Columnas históricas completas | Iguales salvo estado explicado de 5164 |
| `payload_snapshot` | Igual |
| Segunda ejecución | Mismo fingerprint; idempotente |
| RLS `authenticated` | Acceso denegado |
| RLS `service_role` | Acceso permitido |
| Segunda organización | Conservada y aislada |

La batería SES completa obtiene **66/66 pruebas correctas** y TypeScript finaliza sin errores. La suite global obtiene **1435/1436**; el único fallo es una prueba externa de Xexun que recibe HTTP 401 y no toca SES. La compilación local finaliza correctamente.

## XSD oficial

No se ha inventado ni cargado ningún XSD. La puerta de generación XML continúa bloqueada hasta disponer del esquema oficial. La página pública del Ministerio remite al procedimiento electrónico, pero en la revisión pública no ofreció un XSD de alquiler descargable; el portal sin autenticación tampoco expuso el recurso.[1] [2]

Debe obtenerse del portal oficial o del soporte técnico de SES el **XSD raíz cuyo `targetNamespace` sea `http://www.neg.hospedajes.mir.es/altaAlquilerVehiculo`**, junto con todos los ficheros referidos por `xs:import` o `xs:include`. Antes de activarlo se registrarán el nombre exacto, versión oficial declarada, SHA-256 del contenido raíz y SHA-256 de cada dependencia. `xmllint-wasm` valida contra los documentos suministrados, pero no debe utilizarse para sustituir ni reconstruir un XSD oficial ausente.[3]

## Plan de aplicación y restauración

No debe ejecutarse nada real hasta recibir autorización expresa. El orden propuesto es: mantener el modo compatible de solo lectura, tomar un respaldo/restore point administrado, ejecutar la migración en una transacción, revisar todas las postcondiciones, comprobar 224/19/204/1 en el rango persistido, verificar 4942/lote, 5164 y 5343, y solo entonces habilitar el código endurecido.

Si falla cualquier precondición o postcondición, PostgreSQL revierte automáticamente la transacción. Si la migración finaliza pero la aplicación presenta una incompatibilidad no detectada, el rollback operativo seguro es volver al código anterior; las columnas y tablas añadidas son aditivas y el código legado las ignora. **No se propone un rollback destructivo** ni borrar las estructuras nuevas. El SQL real permanecerá sin aplicar hasta autorización.

## Referencias

[1]: https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/hospedajes-y-alquiler-de-vehiculos/ "Ministerio del Interior — Hospedajes y alquiler de vehículos"
[2]: https://hospedajes.ses.mir.es/hospedajes-sede/ "Portal oficial SES.HOSPEDAJES"
[3]: https://www.npmjs.com/package/xmllint-wasm "xmllint-wasm"
