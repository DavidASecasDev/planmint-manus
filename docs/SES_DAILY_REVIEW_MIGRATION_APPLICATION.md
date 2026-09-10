# Aplicación de migración SES Daily Review

**Fecha:** 10 de septiembre de 2026  
**Proyecto Supabase:** `exayzwdudssyegxjiyrk` (`planmint`)  
**Migración:** `ses_daily_review_batches_20260910`  
**Estado del respaldo:** **no verificado**

## Resultado ejecutivo

La migración autorizada se aplicó mediante la conexión administrativa Supabase existente. La operación `apply_migration` devolvió `success: true` y el historial la registra una sola vez con versión `20260910173524`.

El contenido transmitido fue el archivo `supabase/migrations/20260910100000_ses_daily_review_batches.sql` sin modificaciones. El SHA-256 del archivo y el SHA-256 del campo `query` enviado coincidieron exactamente:

`fbc5e49c7b8d927f349acafc3bbc5ddfcac1a6ac2345057e68b3e65796b46d61`

No se publicó código, no se activó Heartbeat ni otro programador, no se enviaron comunicaciones y no se ejecutaron operaciones sobre reservas Rently.

## Preflight no destructivo

La revisión estática confirmó un único `BEGIN` y un único `COMMIT`. No encontró `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, `DROP COLUMN`, renombres de tablas/columnas, ni `INSERT`/`UPDATE` top-level sobre `reservations`, clientes, organizaciones o perfiles.

Los únicos `ALTER TABLE` del SQL afectan a `rently_sync_status`, `reservations`, `ses_contract_drafts`, `ses_field_audit_events` y las tablas nuevas del módulo. Las sentencias `INSERT`/`UPDATE` presentes pertenecen a cuerpos de funciones RPC; definir esas funciones durante la migración no ejecutó sus operaciones de negocio.

La restricción `ses_field_audit_source` se sustituyó por una versión aditiva que conserva `rently`, `respond` y `manual`, y añade `hubspot` y `document`. No se reemplazó ni recreó ninguna tabla histórica.

## Resultado real de `apply_migration`

| Comprobación | Resultado |
|---|---|
| Respuesta administrativa | `success: true` |
| Registro de migración | Presente una vez |
| Nombre | `ses_daily_review_batches_20260910` |
| Versión registrada | `20260910173524` |
| Segundo intento | No ejecutado |

Evidencia administrativa: `/home/ubuntu/.mcp/tool-results/2026-09-10_17-35-24.702101376_supabase_apply_migration_1f3bc2ee.json` y `/home/ubuntu/.mcp/tool-results/2026-09-10_17-36-08.653242052_supabase_list_migrations_5c7acd93.json`.

## Verificación postmigración

| Área | Resultado |
|---|---|
| Tablas nuevas | 6/6 presentes |
| RLS | 6/6 con RLS habilitada y forzada |
| Acceso de tablas | `service_role` con SELECT/INSERT/UPDATE/DELETE en 6/6 |
| Acceso `anon` | 0/6 con privilegios |
| Acceso `authenticated` | 0/6 con privilegios |
| Columnas de integración | 17/17 presentes con tipos compatibles |
| Funciones RPC | 7/7 firmas presentes |
| Seguridad RPC | 7/7 `SECURITY DEFINER` y `search_path=public, pg_temp` |
| Ejecución RPC | 7/7 concedidas únicamente a `service_role`; 0 a PUBLIC/anon/authenticated |
| Triggers `updated_at` | 5/5 presentes |
| Índices esperados | 15/15 presentes |
| Restricción de auditoría | Incluye `rently`, `hubspot`, `respond`, `document`, `manual` |

Las seis tablas nuevas permanecían vacías después de aplicar. Las nuevas columnas de cobertura, eventos Rently y fechas SES no contenían valores no nulos; tampoco aparecieron eventos de auditoría con las fuentes nuevas. Esto confirma que la migración instaló esquema y funciones sin preparar lotes ni modificar datos operativos.

## Aclaración de firmas RPC

La primera consulta postmigración falló porque el **verificador** supuso erróneamente `acquire_ses_review_batch_lease(uuid,uuid,integer)`. No hubo fallo de la función instalada.

La consulta directa a `pg_proc` confirmó las firmas reales declaradas por el SQL y usadas por el servicio. En particular, `acquire_ses_review_batch_lease` recibe `organization_id`, `batch_id`, `lease_token` y `lease_seconds`. También se corrigieron en el script local de reversión las firmas supuestas de `claim_ses_review_proposal`, `apply_ses_review_proposal_decision` y `resolve_ses_review_item_conflict`.

No se alteró ninguna función de producción para adaptarla al test. La verificación corregida confirmó 7/7 firmas y las llamadas de `dailyReviewService.ts`, `sesEndpoints.ts` y `dailyReviewHeartbeat.ts` usan los mismos nombres de parámetros.

## Reversión conservada y no ejecutada

El checkpoint previo `3ef85427` continúa disponible. Se añadió `supabase/rollbacks/20260910100000_ses_daily_review_batches.rollback.sql`, SHA-256:

`381f8d02430f4b377974b6b81b588d1e2064e000a9f0e88e6b2f1b15e0b2d2a0`

El rollback no se ejecutó. Antes de retirar objetos, aborta si detecta lotes, eventos, propuestas, configuración, valores nuevos en reservas/borradores o auditoría con fuentes nuevas. Debe tratarse como una migración administrativa separada y no como borrado del registro histórico.

## Estado para el siguiente paso

La migración y la compatibilidad del código quedan verificadas. El código sigue sin publicarse, por lo que las rutas nuevas no están activas en producción. El siguiente paso requiere una autorización separada para publicar el checkpoint de código; la activación de Heartbeat debe continuar siendo otra autorización independiente.

El respaldo sigue expresamente **no verificado**: esta aplicación se realizó con esa limitación conocida y aceptada, sin atribuirle un punto de restauración inexistente.
