# Entrega técnica — Revisión diaria SES.HOSPEDAJES v1

## Estado de la entrega

La implementación queda preparada para **revisión independiente**, pero no para publicación automática. No se ejecutó la migración contra Supabase, no se publicó ni desplegó código, no se creó o activó ningún Heartbeat, no se enviaron comunicaciones, no se prepararon reservas reales y no se generó XML. Las pruebas de datos y UI usaron exclusivamente fixtures sintéticas.

| Entregable | Estado |
|---|---|
| Dominio, backend y UI | Implementados |
| Migración propuesta | Validada localmente; no aplicada |
| Callback Heartbeat | Registrado; no activado |
| Documentación de rutas y operación | Incluida |
| Checkpoint revisable | Incluido en la entrega de Manus |

## Resumen del diff

El conjunto modifica 19 archivos existentes y añade 22 archivos de implementación, migración, fixtures y documentación. El núcleo está concentrado en los siguientes grupos.

| Área | Archivos principales | Cambio |
|---|---|---|
| Dominio | `server/sesHospedajes/dailyReview.ts` | Periodos Madrid, fechas literales/normalizadas, clasificación, cursores, cobertura, merges y conflictos abiertos/resueltos |
| Servicio | `server/sesHospedajes/dailyReviewService.ts` | Lotes persistentes, fuentes, reintentos, leases renovables, fencing, finalización y detalle UI |
| API | `server/sesHospedajes/sesEndpoints.ts`, `server/_core/index.ts` | Rutas autenticadas, propuestas tipadas, acreditación, Gmail y resolución auditada |
| Rently | `server/syncRently.ts` | Índice sin PII de eventos del listado, paginación completa y cobertura versionada |
| UI | `SesDailyReviewPanel.tsx`, `SesFoundDataDialog.tsx`, `SesHospedajes.tsx` | Revisión diaria/histórica, faltantes, contradicciones, propuestas y resolución tras corrección manual |
| Migración | `20260910100000_ses_daily_review_batches.sql` | Tablas, columnas, índices, RLS, funciones CAS/lease y transacciones de decisión/resolución |
| Pruebas | `dailyReview*.test.ts`, fixtures SQL y pruebas Rently | Fechas, cobertura, concurrencia, multi-organización, reanudación, CAS y UI |

## Decisiones verificables

La selección usa `DeliveryInfo.Date` del listado Rently como fecha real. `FromDate` y `ToDate` permanecen como fechas previstas. El listado paginado conserva `DeliveryInfo`, `DropoffInfo`, `UpdatedOn`, `CurrentStatus`, `Offset` y `NextOffset`; el detalle `/api/booking/{id}` se reserva para expedientes seleccionados, no para descubrir todas las entregas.

| Regla | Resultado |
|---|---|
| 5582 prevista el 10/09 y entregada el 09/09 | Pertenece al lote del 09/09 |
| Entrega acreditada fuera del periodo | `outside_period`; no bloquea el lote actual |
| Timestamp Rently sin zona | Literal intacto y normalización explícita `Europe/Madrid`; nunca se añade `Z` por defecto |
| Fecha prevista automática | Puede migrar a la real solo con procedencia demostrada y auditoría |
| Valor manual o procedencia incierta | No se sobrescribe; queda contradicción abierta |
| Contradicción corregida | Resolución explícita con CAS, motivo, actor y evidencia; historial conservado |
| Reanudación con la misma evidencia | No resucita el conflicto resuelto |
| Cobertura | Solo completa con versión, ausencia de filtros de sede/estado, paginación agotada y alcance temporal acreditado |

## Contrato de rutas y seguridad

Todas las rutas humanas usan la autenticación SES existente. La organización se deriva del contexto autorizado; ninguna ruta acepta `organization_id` desde el cuerpo. Las lecturas requieren `ses_hospedajes.view` y las mutaciones `ses_hospedajes.edit`.

| Método y ruta | Permiso o identidad | Función |
|---|---|---|
| `POST /api/ses/reviews/daily/start` | `ses_hospedajes.edit` | Crear o reanudar periodo diario |
| `POST /api/ses/reviews/historical/start` | `ses_hospedajes.edit` | Crear o reanudar histórico acotado |
| `POST /api/ses/reviews/continue` | `ses_hospedajes.edit` | Ejecutar un paso reanudable |
| `POST /api/ses/reviews/list` | `ses_hospedajes.view` | Listar lotes de la organización |
| `POST /api/ses/reviews/detail` | `ses_hospedajes.view` | Leer lote, ítems, fuentes, propuestas y valores actuales |
| `POST /api/ses/reviews/evidence/accredit` | `ses_hospedajes.edit` | Registrar referencia y fecha literal del justificante |
| `POST /api/ses/reviews/proposals/submit` | `ses_hospedajes.edit` | Registrar dato encontrado para destinatario vinculado |
| `POST /api/ses/reviews/proposals/decide` | `ses_hospedajes.edit` | Aceptar/rechazar propuesta con transacción y conflictos |
| `POST /api/ses/reviews/conflicts/resolve` | `ses_hospedajes.edit` | Validar corrección actual, resolver y auditar con CAS |
| `POST /api/ses/reviews/gmail-draft` | `ses_hospedajes.edit` | Guardar referencia; nunca enviar |
| `POST /api/scheduled/ses-daily-review` | Identidad cron por `task_uid` | Ejecutar el mismo motor en pasos acotados |

El callback cron exige `user.isCron`, `user.taskUid`, configuración habilitada, `Europe/Madrid`, hora válida y actor técnico configurado. Busca la organización exclusivamente por `schedule_task_uid`. No existe ninguna llamada de creación/activación de Heartbeat en el diff.

## Migración propuesta

| Dato | Valor |
|---|---|
| Archivo | `supabase/migrations/20260910100000_ses_daily_review_batches.sql` |
| SHA-256 | `fbc5e49c7b8d927f349acafc3bbc5ddfcac1a6ac2345057e68b3e65796b46d61` |
| Aplicación real | No ejecutada |
| Idempotencia local | Ejecutada dos veces desde cero sin error |
| Operaciones destructivas buscadas | Sin `DROP TABLE`, `TRUNCATE` ni `DELETE FROM` |

La migración añade `rently_booking_events`, lotes, ítems, fuentes, propuestas y configuración de automatización; fuerza RLS y revoca acceso directo de `anon`/`authenticated`. Las funciones invocables validan organización, lease, versiones y vínculos antes de escribir.

## Resultados de validación

| Prueba | Resultado |
|---|---|
| Focales de dominio/rutas/migración/Rently | 52/52 |
| Suite SES ampliada | 170/170 en 38 archivos |
| TypeScript | Aprobado |
| Build | Aprobado |
| PostgreSQL efímero | Migración aplicada dos veces; `fixture_ok` |
| Eventos 5578/5582 | Literales y devolución 5582 preservados; ida/vuelta Madrid correcta |
| Lease concurrente | Segundo ejecutor bloqueado |
| Propuestas concurrentes | `proposal_concurrency_ok`; sin pérdida de conflictos |
| CAS de borrador | Edición manual concurrente conservada |
| Resolución | Corrección manual → resolución auditada → `ready_for_xml` recalculado |
| Reanudación | Misma evidencia no reabre el conflicto resuelto |
| Fixture visual | Verificada en `/__fixtures/ses-daily-review`, sin llamadas externas |
| Suite global | 1.594/1.595; único fallo `server/xexunPoll.test.ts` por respuesta externa 401 |

El fallo global de Xexun es ajeno a SES y depende de una autenticación externa. No se modificó ese conector ni se usó como justificación para omitir las pruebas SES, que aprobaron completas.

## Procedimiento posterior propuesto

1. Revisar independientemente el SQL y comprobar su SHA-256.
2. Crear o confirmar un respaldo recuperable del entorno objetivo.
3. Aplicar primero en un entorno no productivo y repetir las fixtures y postcondiciones.
4. Solicitar autorización separada antes de cualquier SQL de producción.
5. Aplicar la migración en una transacción y verificar tablas, funciones, RLS y conteos.
6. Guardar un nuevo checkpoint y desplegar manualmente desde la interfaz solo después de validar la migración.
7. Probar el flujo humano con datos controlados: abrir expediente, corregir, resolver y revalidar.
8. Solicitar otra autorización antes de crear o activar el Heartbeat de las 04:00 Madrid y persistir su `task_uid`.

Este procedimiento es informativo. **Ninguno de estos pasos operativos se ejecutó en esta tarea.**
