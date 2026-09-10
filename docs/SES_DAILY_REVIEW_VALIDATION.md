# SES.HOSPEDAJES — Evidencia de validación de revisión diaria v1

## Resultado resumido

La implementación se validó exclusivamente con fixtures sintéticas y PostgreSQL local efímero. No se ejecutó SQL contra Supabase, no se consultaron reservas adicionales, no se enviaron comunicaciones, no se generó XML y no se publicó ni desplegó.

| Validación | Resultado |
|---|---|
| Pruebas focales de cierre | 52/52 aprobadas, 7 archivos |
| Suite SES ampliada | 170/170 aprobadas, 38 archivos |
| TypeScript `pnpm check` | Aprobado |
| Build `pnpm build` | Aprobado |
| Suite global | 1.594/1.595 aprobadas; único fallo externo Xexun por respuesta 401 |
| Migración en PostgreSQL local | Aplicada dos veces desde cero, sin error |
| Carrera de lease del mismo lote | Un único ejecutor efectivo |
| Lotes solapados de una organización | Segundo ejecutor bloqueado; otra organización no bloqueada |
| Carrera de dos propuestas | Ambas aceptadas y todas las contradicciones previas/concurrentes preservadas |
| CAS de borrador | CAS obsoleto rechazado; edición manual conservada; CAS vigente aplicado y auditado |
| RLS | Forzada en tablas nuevas; `authenticated` sin acceso y `service_role` con acceso |
| Resolución de contradicción | Corrección manual validada, historial conservado, auditoría creada y `ready_for_xml` recalculado |
| Reanudación tras resolución | La misma evidencia no resucita ni vuelve a bloquear la contradicción resuelta |
| Fixture visual | Ruta aislada `GET /__fixtures/ses-daily-review`, sin llamadas a Supabase/Rently/HubSpot/respond.io |

## Casos temporales

Las pruebas conservan los literales originales y normalizan explícitamente a Madrid. El caso sintético 5582 mantiene `2026-09-09T23:05:19.643` después de persistir y releer; la fecha prevista del 10/09 no lo mueve de lote. El caso 5578 conserva la entrega `2026-09-09T17:56:39.05` y acepta que la pantalla del justificante redondee su generación a segundos.

| Caso | Aserción |
|---|---|
| 5578 | Entrega real y generación visible difieren 50 ms; evidencia coherente |
| 5582 | Prevista el 10/09, entrega real el 09/09; pertenece al lote del 09/09 |
| Candidata fuera de periodo | `outside_period`; no bloquea ni crea fuentes externas pendientes |
| Medianoche Madrid | El día se deriva de semántica Madrid, no de un `Z` añadido |
| Inicio DST | Hora inexistente rechazada |
| Fin DST | Hora ambigua rechazada |
| Devolución heredada +2 h | Solo se corrige con procedencia automática; manual/desconocida queda en conflicto |

## PostgreSQL efímero

La fixture crea dos organizaciones, una reserva, un perfil, dos lugares y un borrador sintéticos. Después ejecuta la migración dos veces, crea/reanuda lotes, prueba expiración/reclamación/renovación de leases, persiste los eventos 5578/5582 del listado, decide propuestas tipadas, bloquea un lugar desvinculado con comparación `NULL`-safe, resuelve una contradicción tras una corrección manual y comprueba auditoría y no resurrección.

| Archivo | Propósito |
|---|---|
| `server/sesHospedajes/fixtures/dailyReviewPostgresBase.sql` | Esquema mínimo y datos sintéticos |
| `dailyReviewPostgresAssertions.sql` | Idempotencia, RLS, fechas, CAS, vínculos y auditoría |
| `dailyReviewLeaseSession1.sql` / `dailyReviewLeaseSession2.sql` | Carrera real por el mismo lote |
| `dailyReviewProposalSession1.sql` / `dailyReviewProposalSession2.sql` | Dos decisiones solapadas sobre el mismo ítem |
| `dailyReviewProposalConcurrencyAssertions.sql` | Preservación final de ambas contradicciones |

## Interpretación

Las pruebas estáticas de `dailyReviewMigration.test.ts` se usan solo como contrato de texto. La evidencia principal de migración es su ejecución real y repetida en PostgreSQL local. La suite global deja un único fallo ajeno al cambio: `server/xexunPoll.test.ts` recibió `401` del servicio externo; las 1.594 pruebas restantes aprobaron. Esta validación **no autoriza** aplicar la migración en producción ni publicar el código; ambas acciones requieren revisión y autorización separadas.
