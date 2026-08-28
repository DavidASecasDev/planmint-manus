# Plan de recuperación compatible de SES.HOSPEDAJES

**Estado:** propuesta preparada y probada; **no aplicada en producción y no desplegada**.  
**Autor:** Manus AI  
**Fecha:** 28 de agosto de 2026

> Esta intervención se detiene antes de ejecutar SQL real. No se prepararon reservas, no se generó XML y no se modificó ningún dato de producción.

## Resumen ejecutivo

La causa raíz verificada es una **desalineación entre código y esquema**. El código endurecido consulta columnas y tablas nuevas, pero la base Supabase real conserva el esquema anterior. La consulta publicada falla antes de aplicar filtros porque `ses_contract_drafts.is_complete` no existe; las consultas de lotes, configuración e inventario fallan igualmente al solicitar columnas y tablas nuevas. El frontend convierte esas respuestas fallidas en arreglos o valores vacíos, por lo que muestra ceros aunque los registros históricos siguen presentes.

No hay evidencia de una base equivocada ni de pérdida de datos. Servidor y frontend apuntan al mismo proyecto Supabase, y las tablas históricas conservan borradores, lote, item, configuración, perfiles, lugares y auditoría.

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
| Lotes / items de lote / configuraciones | 1 / 1 / 1 |
| Perfiles / lugares reutilizables | 477 / 202 |
| Eventos de auditoría histórica | 165 |
| Tablas nuevas de inventario, snapshots y auditoría por campo | No existen todavía |

## Causa raíz y descarte de hipótesis

| Hipótesis | Resultado verificable |
|---|---|
| Entorno o base equivocada | Descartada: servidor y frontend usan el mismo host y la organización histórica está presente. |
| Pérdida o recreación de tablas | Descartada: tablas, IDs y conteos históricos siguen intactos. |
| Filtros vacíos | Descartada como causa primaria: la consulta falla antes del filtrado. |
| RLS | No causa los ceros del backend; el servicio alcanza la tabla y recibe error de columna/esquema. |
| Estados nuevos | Contribuyen a incompatibilidad, pero no borraron estados antiguos. |
| Backfill ausente | Confirmado: faltan cuatro puertas y metadatos oficiales/XSD. |
| Migración no aplicada | **Causa principal confirmada.** |
| Fallback frontend | Amplifica el fallo al presentar errores como valores vacíos. |

## Estado único de revisión

La denominación canónica propuesta es **`needs_revision`** en base, servidor, tipos, filtros, UI, manual y pruebas. Se conserva esta denominación porque ya pertenece a la restricción histórica vigente. Cambiarla a otra exigiría sustituir esa restricción; la solicitud prohíbe expresamente operaciones `DROP`. No coexiste un segundo estado de revisión en la propuesta final.

## Archivos propuestos

| Archivo | Función |
|---|---|
| `supabase/migrations/20260828143000_ses_hospedajes_compatibility_restore.sql` | Migración forward-only, transaccional, idempotente y orientada a datos. |
| `server/sesHospedajes/schemaCompatibility.ts` | Detecta esquema legado y devuelve lecturas seguras sin habilitar escrituras. |
| `server/sesHospedajes/sesEndpoints.ts` | Fallbacks de lectura y bloqueo de mutaciones mientras falte la migración. |
| `server/sesHospedajes/eligibility.ts` | Elegibilidad por estado Rently, entrega efectiva, sucursal, transferencia e identidad contractual. |
| `server/sesHospedajes/officialInventory.ts` | No reenvío y revisión mediante inventario oficial estructurado. |
| `server/sesHospedajes/fixtures/*` | Fixture anonimizada exacta y aserciones generales. |
| `server/sesHospedajes/referenceMutation.test.ts` | Prueba que cambia referencias manteniendo hechos y exige resultados idénticos. |
| `scripts/test-ses-compatibility-migration.sh` | Ejecuta migración dos veces y comprueba conteos, idempotencia, RLS y multi-organización. |

## SQL propuesto y garantías

La migración usa `BEGIN`/`COMMIT`; cualquier precondición o postcondición fallida revierte toda la transacción. No contiene `DROP`, `TRUNCATE`, `DELETE FROM`, recreación de tablas ni reseteos. Antes del DDL captura en tablas temporales IDs, estados, versiones, hashes, timestamps y representaciones JSON completas. Después exige igualdad de conteos, identidades y columnas históricas, incluyendo `payload_snapshot`, configuración y auditoría.

| Objeto | Comportamiento general |
|---|---|
| Cuatro puertas | Se añaden conservadoramente; ningún legado queda `ready_for_xml` sin revalidación actual. |
| Comunicación aceptada | Un item histórico aceptado mantiene su borrador no reenviable y se copia aditivamente al inventario oficial. |
| Comunicación distinta, activa o anulada | La coincidencia estructurada en inventario produce `needs_revision`; nunca depende del número de reserva. |
| Entrega futura o inexistente | Se excluye en preparación/revalidación mediante `actual_delivery_at` y estado Rently. |
| Lote aceptado | El código ya almacenado en notas se copia a la columna estructurada sin modificar las notas. |
| `payload_snapshot` | Se conserva y recibe un SHA-256 adicional sin reescribir el JSON. |
| Configuración | Se preserva íntegra; los campos XSD nuevos permanecen `NULL`. |
| Inventario oficial | Es aditivo e idempotente; una importación vacía se rechaza. |
| RLS | Nuevas tablas deniegan `anon`/`authenticated` y permiten solo `service_role`. |

## Resultado de la fixture anonimizada

La fixture crea dos organizaciones sintéticas. La principal contiene exactamente **224 borradores: 19 ready, 204 incomplete y 1 accepted**, un lote aceptado y un item con snapshot sintético. Las referencias son datos mutables de fixture; ninguna rama SQL o TypeScript reconoce valores concretos.

| Comprobación | Resultado exigido |
|---|---|
| Conteo previo y posterior | 224/19/204/1, sin reclasificación ni pérdida |
| Identidades y columnas históricas | Iguales |
| `payload_snapshot`, configuración y auditoría | Iguales |
| Legado `ready_for_xml` | 0 hasta revalidación actual |
| Historial aceptado | No reenviable por batch/item e inventario estructurado |
| Referencias mutadas | Resultado idéntico al conservar los mismos hechos |
| Segunda ejecución | Mismo fingerprint; idempotente |
| RLS `authenticated` / `service_role` | Denegado / permitido |
| Segunda organización | Conservada y aislada |

## XSD oficial

No se inventó ni cargó ningún XSD. La generación continúa bloqueada hasta disponer del esquema oficial. La página pública del Ministerio remite al procedimiento electrónico, pero no ofrece públicamente el XSD de alquiler; el portal sin autenticación tampoco expone el recurso.[1] [2]

Debe obtenerse del portal oficial o del soporte técnico de SES el **XSD raíz cuyo `targetNamespace` sea `http://www.neg.hospedajes.mir.es/altaAlquilerVehiculo`**, junto con todos los ficheros referidos por `xs:import` o `xs:include`. Antes de activarlo se registrarán nombre exacto, versión oficial y SHA-256 del raíz y dependencias. `xmllint-wasm` valida los documentos suministrados, pero no sustituye ni reconstruye un XSD oficial ausente.[3]

## Plan de aplicación y restauración

No debe ejecutarse nada real hasta autorización expresa. El orden es: mantener el modo compatible de solo lectura, tomar un restore point administrado, ejecutar la migración en una transacción, exigir todas las postcondiciones, confirmar 224/19/204/1 en el rango persistido y verificar por relaciones estructuradas que todo item aceptado sigue no reenviable. Solo después se habilita el código endurecido.

Si falla cualquier precondición o postcondición, PostgreSQL revierte automáticamente. Si la transacción finaliza pero aparece una incompatibilidad no detectada, el rollback operativo seguro es volver al código anterior; las estructuras añadidas son aditivas y el código legado las ignora. **No se propone rollback destructivo.**

## Referencias

[1]: https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/hospedajes-y-alquiler-de-vehiculos/ "Ministerio del Interior — Hospedajes y alquiler de vehículos"
[2]: https://hospedajes.ses.mir.es/hospedajes-sede/ "Portal oficial SES.HOSPEDAJES"
[3]: https://www.npmjs.com/package/xmllint-wasm "xmllint-wasm"
