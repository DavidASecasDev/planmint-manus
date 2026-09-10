# SES.HOSPEDAJES — Revisión diaria v1

## Objetivo y límites

Esta versión añade una revisión diaria e histórica **persistente, reanudable y auditable**. La selección no usa la fecha prevista de Rently como prueba de entrega: clasifica una reserva cuando el listado paginado acredita `DeliveryInfo.Date`. El literal original recibido se conserva y cualquier instante normalizado se calcula aplicando explícitamente `Europe/Madrid`.

| Incluido | Excluido deliberadamente |
|---|---|
| Lotes diarios e históricos de hasta 91 días naturales | Publicación o despliegue automático |
| Reanudación por cursor, lease renovable y fencing | Ejecución de SQL en producción |
| Propuestas externas tipadas y auditadas | Envío de correos, mensajes o comunicaciones SES |
| UI autenticada en español | Descarga inventada de un PDF que Rently no expone |
| Callback Heartbeat común, registrado pero no activado | Consulta automática de HubSpot/respond.io sin un conector acreditado |

## Decisiones de diseño

El descubrimiento de eventos usa `/api/bookings/list`, que devuelve `Offset`, `Limit`, `Total`, `NextOffset` y, por reserva, `DeliveryInfo`, `DropoffInfo`, `UpdatedOn` y `CurrentStatus`. `FromDate` y `ToDate` se conservan como fechas previstas; `DeliveryInfo.Date` y `DropoffInfo.Date` se conservan como fechas reales. El detalle `/api/booking/{id}` queda reservado para expedientes seleccionados que requieren completar otros campos. Una entrega real acreditada fuera del periodo se guarda como `outside_period`, queda excluida del lote actual sin bloquearlo y mantiene su referencia para el periodo correcto.

| Regla | Comportamiento |
|---|---|
| Falta `DeliveryInfo.Date` | `missing_delivery_evidence`; nunca se interpreta como “no entregada” |
| Entrega real dentro del periodo sin justificante acreditado | Pendiente de acreditar referencia y fecha de generación |
| Generación del justificante discrepante | `evidence_conflict`; conserva ambos originales |
| Entrega real fuera del periodo | `outside_period`; no crea pendientes externos ni bloquea el lote |
| Fecha prevista automática frente a entrega real | Migra a la real solo con procedencia automática demostrada; conserva la prevista |
| Fecha manual o procedencia incierta | No sobrescribe; crea contradicción revisable |

La cobertura no se deriva de `last_full_sync_at`. Para ser completa exige una versión de sincronización y un alcance que acredite ausencia de filtros de sede/estado, agotamiento real de `NextOffset`, eventos incluidos y cobertura hasta el final del periodo. El enriquecimiento de otros datos puede ser parcial sin invalidar la cobertura de eventos. Si cambia `coverage_version` después de agotar páginas, el lote reinicia el descubrimiento aunque la nueva versión ya sea completa.

| Garantía de concurrencia | Implementación |
|---|---|
| Un lote por organización, tipo y periodo | Índice único permanente y función idempotente de crear/reanudar |
| Un ejecutor efectivo por organización | Advisory lock y exclusión de periodos solapados |
| Un ejecutor por lote | Lease con token, vencimiento, renovación y reclamación |
| Escrituras después de perder lease | Rechazadas mediante fencing antes de cada grupo y dentro de RPC transaccionales |
| Edición manual concurrente | CAS por `updated_at` y `draft_version`; relee una vez y nunca pisa la edición |
| Dos propuestas simultáneas | Bloqueo del ítem y fusión transaccional de contradicciones existentes |

## Modelo persistente propuesto

La migración no ejecutada es `supabase/migrations/20260910100000_ses_daily_review_batches.sql`. Es aditiva, idempotente y no contiene `DROP TABLE`, `TRUNCATE` ni `DELETE`. Las tablas nuevas fuerzan RLS y solo conceden acceso directo a `service_role`; la aplicación exige autenticación y resuelve siempre la organización desde el contexto autorizado.

| Tabla | Responsabilidad |
|---|---|
| `rently_booking_events` | Índice sin PII de fechas previstas/reales, estado, versión de lista y vínculo opcional a reserva |
| `ses_review_batches` | Periodo, cursor, progreso, cobertura, lease, reintento y referencia de borrador Gmail |
| `ses_review_items` | Una reserva candidata, literales/instantes, evidencia, cambios, contradicciones y siguiente acción |
| `ses_review_item_sources` | Estado `pending`, `consulted` o `inaccessible` por Rently, HubSpot, respond.io o documento |
| `ses_review_evidence_proposals` | Propuesta idempotente, destinatario, versión objetivo, decisión y token de reclamación |
| `ses_review_automation_settings` | Hora local, zona, actor técnico y `schedule_task_uid`; no crea un job por sí sola |

La migración añade a `ses_contract_drafts` campos separados para fecha prevista y real de recogida/devolución, con literal original, instante normalizado y procedencia. Añade también `coverage_version` y `coverage_scope` a `rently_sync_status` para impedir que una fecha reciente se confunda con cobertura probada.

## Contrato exacto de rutas

Todas las rutas REST devuelven `{ data, error: null }` cuando tienen éxito y usan el manejador SES común para errores. Las rutas humanas usan la sesión normal del navegador a través del cliente autenticado existente. **La organización nunca se acepta desde el cuerpo**: se deriva de `authorize` y todas las consultas se filtran por `ctx.organizationId`.

| Método y ruta | Permiso | Cuerpo |
|---|---|---|
| `POST /api/ses/reviews/daily/start` | `ses_hospedajes.edit` | `{ reviewDate?: "YYYY-MM-DD", runFirstStep?: boolean }`; por defecto revisa ayer en Madrid |
| `POST /api/ses/reviews/historical/start` | `ses_hospedajes.edit` | `{ dateFrom, dateTo, runFirstStep?: boolean }`; máximo 91 días naturales |
| `POST /api/ses/reviews/continue` | `ses_hospedajes.edit` | `{ batchId: uuid }` |
| `POST /api/ses/reviews/list` | `ses_hospedajes.view` | `{ status?, limit?: 1..100, offset?: >=0 }` |
| `POST /api/ses/reviews/detail` | `ses_hospedajes.view` | `{ batchId: uuid }` |
| `POST /api/ses/reviews/gmail-draft` | `ses_hospedajes.edit` | `{ batchId, gmailDraftReference }`; registra referencia, no envía |
| `POST /api/ses/reviews/evidence/accredit` | `ses_hospedajes.edit` | `{ batchId, itemId, evidenceReference, evidenceGeneratedLiteral }` |
| `POST /api/ses/reviews/proposals/submit` | `ses_hospedajes.edit` | `{ batchId, itemId, source, externalSubmissionId, targetType, targetId, payload, evidenceReference?, observedAt? }` |
| `POST /api/ses/reviews/proposals/decide` | `ses_hospedajes.edit` | `{ proposalId, decision: "accept"|"reject", reason }` |
| `POST /api/ses/reviews/conflicts/resolve` | `ses_hospedajes.edit` | `{ itemId, conflictKey, reason, evidenceReference }`; valida el valor corregido y usa CAS |
| `POST /api/scheduled/ses-daily-review` | Solo identidad cron | Sin organización en el cuerpo; busca configuración por `user.taskUid` |

El callback programado autentica con el SDK interno, exige `user.isCron` y `user.taskUid`, busca exactamente `ses_review_automation_settings.schedule_task_uid`, exige `Europe/Madrid`, una hora válida y un `actor_user_id` configurado, y ejecuta el mismo motor reanudable en pasos acotados. No existe ninguna llamada de creación o activación de Heartbeat en esta entrega.

## Propuestas y destinatarios

“Añadir dato encontrado” funciona con la sesión autenticada normal. Antes de aceptar, la UI muestra fuente, destinatario y valores actuales/propuestos. La API verifica que el destinatario pertenece a la organización y está vinculado al borrador; después aplica solo campos vacíos, conserva manuales y convierte toda discrepancia en contradicción.

| Destinatario | Campos permitidos |
|---|---|
| `draft` | Referencia, fechas, pago, vehículo, kilómetros y GPS |
| `person` | Documento, nombre, nacimiento, nacionalidad, sexo, domicilio, municipio, postal, contacto y permiso |
| `pickup_location` | Nombre, código de establecimiento, domicilio, municipio, postal, país, coordenadas y verificación |
| `return_location` | La misma allowlist de lugar, aplicada solo al lugar de devolución vinculado |

No existe una regla que infiera el permiso de conducir a partir del pasaporte. Un documento `OTRO`, nombre/apellido duplicados, pasaporte copiado en permiso o una letra discordante se muestran como contradicciones con procedencia. `ready_for_xml` permanece bloqueado mientras exista cualquier contradicción abierta o el borrador siga incompleto. Tras corregir manualmente el expediente, «Resolver contradicción» compara el valor actual, exige motivo y referencia, registra actor/evidencia y conserva la contradicción como historial `resolved`; la misma evidencia no la reabre.

## Interfaz operativa

La cabecera de SES.HOSPEDAJES añade **Revisar entregas**. El panel permite revisar ayer o una fecha explícita, iniciar un histórico, continuar/reintentar un lote, abrir el expediente, acreditar un justificante, añadir un dato encontrado y resolver una contradicción ya corregida. Muestra progreso persistido, cobertura, candidatas, entregas acreditadas, pendientes, errores, faltantes reales, contradicciones abiertas, historial resuelto y siguiente acción.

| Estado visible | Significado operativo |
|---|---|
| En cola / En curso | El lote espera o conserva un lease válido |
| Pendiente de revisión | Quedan fuentes, borradores incompletos, errores o contradicciones |
| Completado | Páginas y cobertura confirmadas, sin pendientes, errores ni contradicciones |
| Interrumpido | Fallo recuperable; el lote y sus páginas no se pierden |
| Excluida: otro periodo | La entrega real está acreditada, pero corresponde a otra fecha |

## Procedimiento futuro de aplicación

No se debe desplegar el código antes de revisar y aplicar la migración en el entorno correspondiente. El orden seguro es: revisión independiente del SQL y su hash; respaldo verificable; aplicación primero en un entorno no productivo; ejecución de las fixtures y comprobaciones; autorización separada para producción; aplicación transaccional; verificación de tablas, funciones, RLS y conteos; checkpoint y despliegue del código; y, solo después de desplegar y con otra autorización, creación del Heartbeat y persistencia de su `task_uid`.

| Paso | Puerta de salida |
|---|---|
| Revisar migración | SQL íntegro, hash y ausencia de operaciones destructivas |
| Aplicar esquema | Transacción exitosa y segunda ejecución idempotente |
| Verificar backend | Pruebas, TypeScript y build aprobados |
| Desplegar | Acción manual del usuario desde la interfaz, nunca automática desde esta tarea |
| Activar Heartbeat | Sitio ya desplegado, actor técnico definido, horario confirmado y autorización expresa |

## Limitaciones conocidas

La primera versión no consulta directamente HubSpot ni respond.io: los hallazgos entran como propuestas autenticadas y auditables. Tampoco descarga un justificante desde una ruta no documentada; registra la referencia y la fecha acreditadas. `coverage_complete` permanece en falso cuando el listado no acredita fin de paginación, ausencia de filtros o alcance temporal; no depende de completar detalles personales de todas las reservas.
