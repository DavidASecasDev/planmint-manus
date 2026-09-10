# Auditoría Supabase de solo lectura — SES Daily Review

## Alcance

Comprobación administrativa y de compatibilidad realizada el 10/09/2026 sin ejecutar DDL, DML, migraciones, reservas, publicación ni Heartbeats.

## Resultado ejecutivo

La instalación real de PlanMint es **compatible con las dependencias históricas de la migración**. Se verificaron las nueve tablas base, las columnas críticas, las claves primarias/foráneas, `gen_random_uuid()` y `public.ses_set_updated_at()`. No apareció ninguna dependencia obligatoria ausente ni un tipo incompatible que impida compilar el SQL.

La migración diaria **no está aplicada ni parcialmente aplicada**: las seis tablas nuevas, las diecisiete columnas aditivas, los índices, triggers y siete funciones nuevas consultados están ausentes. Esto coincide con el historial administrativo, donde `20260910100000_ses_daily_review_batches` no figura como aplicada.

> **Decisión:** compatibilidad de esquema aprobada para una futura aplicación controlada. La aplicación sigue detenida porque en esta sesión no se pudo verificar un respaldo recuperable actual.

## Evidencia administrativa verificada

| Comprobación | Resultado |
|---|---|
| Conector administrativo Supabase | Habilitado en la sesión; no se inspeccionaron ni mostraron secretos |
| Proyecto | `exayzwdudssyegxjiyrk`, nombre `planmint` |
| Estado | `ACTIVE_HEALTHY` |
| PostgreSQL | 17.6.1, canal GA |
| Región | `eu-west-1` |
| Organización | Plan Pro |
| Método DDL disponible | Operación administrativa `apply_migration`; no invocada |

El acceso existente permite listar proyectos y migraciones y ejecutar consultas SQL de metadatos. No se solicitaron ni mostraron contraseñas, tokens, claves publicables o claves de servicio.

## Compatibilidad de esquema

| Área | Resultado de solo lectura |
|---|---|
| Tablas históricas requeridas | 9/9 presentes: `organizations`, `profiles`, `reservations`, `rently_sync_status`, `ses_contract_drafts`, `ses_person_profiles`, `ses_locations`, `ses_field_audit_events`, `ses_audit_events` |
| Columnas críticas | Todas las columnas críticas consultadas están presentes con los tipos PostgreSQL esperados |
| Campos dinámicos de propuestas | 58 comprobados; 48 coincidencias nominales y 10 diferencias de familia compatibles |
| Diferencias nominales | Códigos SES son `varchar(1|3|5|10)` en lugar de `text`; latitud/longitud son `float8` en lugar de `numeric`. La migración no altera estos campos y `jsonb_populate_record` escribe sobre sus tipos reales |
| Restricción de fuente de auditoría | Existe `ses_field_audit_source` con `rently`, `respond`, `manual`; la migración elimina exactamente esa restricción y la recrea ampliada con `hubspot` y `document` |
| Claves referenciadas | Las PK/FK necesarias sobre organizaciones, perfiles, reservas, borradores, personas y lugares están presentes |
| Función de timestamps | `public.ses_set_updated_at()` existe y devuelve `trigger` |
| UUID | `gen_random_uuid()` existe y devuelve `uuid` |
| PostgreSQL | 17.6.1 GA; sin incompatibilidad detectada con el SQL propuesto |

Las diez diferencias nominales no son bloqueos: preservan las restricciones más estrictas del esquema SES real. Los valores propuestos deberán seguir cumpliendo esas longitudes y claves foráneas, como ya exige el flujo aplicativo.

## Objetos nuevos y aplicación parcial

Todos los objetos consultados están ausentes: `rently_booking_events`, `ses_review_batches`, `ses_review_items`, `ses_review_item_sources`, `ses_review_evidence_proposals`, `ses_review_automation_settings`; las siete funciones de lote/lease/propuesta/resolución/CAS; los índices y triggers nuevos; y las columnas aditivas en `rently_sync_status`, `reservations` y `ses_contract_drafts`.

Por tanto, no hay que reconciliar una instalación parcial. El orden obligatorio es **migración primero y código después**. Los errores locales de esquema cacheado observados al ejecutar código nuevo contra esta base sin migrar (`coverage_scope` ausente y `rently_booking_events` inexistente) confirman esa precondición; no demuestran corrupción ni modificaron el esquema.

## Respaldo

El respaldo queda **NO VERIFICADO**. El conector Supabase disponible no expone el listado de backups y el navegador de esta sesión no estaba autenticado; no se añadió otro conector por indicación del usuario. El plan Pro incluye copias diarias y retención de siete días como capacidad general, pero esa política no prueba que exista un punto concreto recuperable para este proyecto.[1]

No se dispone, por tanto, de identificador ni fecha de un respaldo actual comprobado. Antes de autorizar la aplicación, una persona con acceso al Dashboard debe confirmar un punto concreto en **Database → Backups → Scheduled**. Esta comprobación es independiente del acceso SQL y del resultado favorable de compatibilidad.

## Hash final y método exacto disponible

| Elemento | Valor |
|---|---|
| Archivo | `supabase/migrations/20260910100000_ses_daily_review_batches.sql` |
| SHA-256 | `fbc5e49c7b8d927f349acafc3bbc5ddfcac1a6ac2345057e68b3e65796b46d61` |
| Proyecto objetivo | `exayzwdudssyegxjiyrk` |
| Operación disponible | Supabase Management/MCP `apply_migration` |
| Nombre propuesto | `ses_daily_review_batches_20260910` |
| Estado | **No invocada** |

El método exacto disponible consiste en invocar `apply_migration` para el proyecto anterior, usando como `query` el contenido literal del archivo cuyo hash se indica y como `name` el nombre propuesto. Esa operación es DDL y debe ejecutarse una sola vez únicamente después de verificar un respaldo concreto. Tras el resultado exitoso, se deben repetir en solo lectura las consultas de objetos/columnas y `list_migrations`; solo después correspondería desplegar el código y, en una autorización separada, activar Heartbeat.

## Fuentes de la comprobación

Los resultados administrativos se conservaron localmente en:

- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-14-29.751775121_supabase_list_projects_e66d9757.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-14-49.874594756_supabase_get_project_29fb4ed7.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-15-06.842997330_supabase_get_organization_98715c4b.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-16-29.654478910_supabase_execute_sql_b02c9e73.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-19-55.542913480_supabase_execute_sql_4eddbc52.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-20-43.004799816_supabase_execute_sql_5f1f3276.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-21-18.162351027_supabase_execute_sql_fa3ad5a7.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-21-41.158701339_supabase_list_migrations_251b3e7d.json`
- `/home/ubuntu/.mcp/tool-results/2026-09-10_17-22-09.548358096_supabase_execute_sql_c9169f0c.json`

## Estado final

La compatibilidad y la ausencia de aplicación parcial quedan verificadas. La única comprobación pendiente antes de aplicar es la existencia de un **respaldo recuperable actual y concreto**. No se ejecutó SQL de escritura, no se aplicó la migración, no se publicó, no se activó Heartbeat y no se realizaron operaciones Rently.

## Referencias

[1]: https://supabase.com/docs/guides/platform/backups "Supabase — Database Backups"
