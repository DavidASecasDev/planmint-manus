# Entrega técnica — PlanMint Transfers API v1

**Autor:** Manus AI  
**Fecha:** 1 de septiembre de 2026  
**Decisiones aprobadas:** API bidireccional, una clave compartida para Azul Cars y lectura de todas las solicitudes de la organización.

> El esquema aditivo ya está aplicado y vacío. El código no está publicado, no se ha creado ninguna clave real, no se ha registrado ningún webhook y no se ha creado ninguna solicitud de prueba en producción.

## Resultado

La API externa heredada se sustituyó por un contrato versionado que permite crear solicitudes, listar y consultar todas las solicitudes de Azul Cars, consultar estado, cancelar de forma controlada y administrar webhooks. La lectura se filtra siempre por la organización autenticada, pero no por comercial, broker ni canal de creación.[1] [2]

| Capacidad | Ruta | Scope |
|---|---|---|
| Crear solicitud | `POST /api/external/v1/transfers` | `transfers.create` |
| Listar todas | `GET /api/external/v1/transfers` | `transfers.read` |
| Consultar detalle | `GET /api/external/v1/transfers/{id}` | `transfers.read` |
| Consultar estado | `GET /api/external/v1/transfers/{id}/status` | `transfers.read` |
| Cancelar | `POST /api/external/v1/transfers/{id}/cancel` | `transfers.cancel` |
| Gestionar webhooks | `/api/external/v1/webhooks` | `webhooks.manage` |
| OpenAPI | `GET /api/external/v1/openapi.json` | Público, sin datos |

## Seguridad y consistencia

La clave compartida se almacena únicamente como SHA-256 y se compara en tiempo constante. Puede crearse, rotarse o revocarse desde Ajustes usando el permiso granular existente `integrations.manage_api_keys`; el valor completo se muestra una sola vez. Los cuatro scopes permanecen separados aunque la primera credencial sea compartida.[3] [4]

La creación exige `Idempotency-Key`. Una función transaccional serializa la numeración por organización, crea cabecera e items y conserva la respuesta para reintentos. La misma clave y contenido devuelve el resultado original; la misma clave con otro contenido responde `409`. La cancelación es también transaccional e idempotente.[2] [5]

Los logs no guardan cuerpos de petición o respuesta. IP y agente de usuario se persisten como hashes con sal secreta, junto con correlación, endpoint, código y duración. El límite por minuto usa una tabla distribuida y falla cerrado si el esquema no está listo.[3] [5]

## Webhooks

Los eventos `transfer.created`, `transfer.status_changed` y `transfer.cancelled` se generan mediante trigger para solicitudes creadas o modificadas desde cualquier canal. El payload contiene únicamente identidad, número y estado; el receptor obtiene el detalle por API.[5]

Los secretos de firma se cifran con AES-256-GCM, las entregas usan HMAC-SHA256 sobre `timestamp.rawBody`, y cada destino se valida contra SSRF tanto al registrarlo como justo antes de enviarlo. No se siguen redirecciones y hay timeout. La outbox se reclama atómicamente con `FOR UPDATE SKIP LOCKED`, recupera procesos interrumpidos y aplica reintentos escalonados hasta estado agotado.[6] [7] [8]

## Campos funcionales

El contrato de creación incluye los datos actuales del portal: cliente, contacto, villa/hotel, notas, referencia externa y uno o más servicios. Cada servicio admite ida/vuelta, fecha, hora, origen/destino, Google Place IDs y coordenadas, tipo de vehículo, pasajeros, maletas, entre una y cuatro furgonetas, sillitas con edad/peso, observaciones y enlace entre trayectos. La respuesta de lectura excluye costes internos de proveedor y márgenes.[1] [2]

## Base de datos

Se aplicaron dos migraciones forward-only al proyecto PlanMint confirmado:

| Migración | SHA-256 | Resultado |
|---|---|---|
| `20260901124500_external_transfers_bidirectional_api.sql` | `e3033f8f6aebf6b5df24af79ba8780a6a8589c99f198f53500938e310faf086b` | Aplicada correctamente. |
| `20260901130000_external_transfer_api_fk_indexes.sql` | `84a66fec7a7beb91921efbe5765deb33091fc6f1b0310e74db6564741add4d3f` | Aplicada correctamente. |

Las postcondiciones confirmaron tablas de idempotencia, rate limiting, webhooks, entregas y configuración; funciones de creación, cancelación y reclamación; trigger general de outbox; RLS forzado; y cero filas en idempotencia, webhooks y entregas. La segunda migración añadió los dos índices de claves foráneas señalados por el asesor de rendimiento.

El asesor de seguridad solo informa que las tablas nuevas tienen RLS sin políticas. Es intencional: `anon` y `authenticated` están revocados y no existe acceso directo; únicamente `service_role` y las funciones explícitamente concedidas operan sobre ellas. No aparecen advertencias nuevas de funciones `SECURITY DEFINER` ejecutables por anónimos para esta API.[5] [9]

## Verificación

| Prueba | Resultado |
|---|---|
| Suite focal API | **37/37** pruebas aprobadas en 9 archivos. |
| Suite global PlanMint | **1.523/1.524** aprobadas en 135 archivos. Único fallo externo preexistente: Xexun devolvió código 401. |
| TypeScript | `pnpm check`: aprobado, 0 errores. |
| Build local | `pnpm build`: aprobado; solo avisos preexistentes de chunks grandes. |
| Migración sintética | Aplicada dos veces; numeración, creación, cancelación, outbox, idempotencia y RLS: PASS. |
| Smoke test local | OpenAPI 200; listado, creación y webhooks sin clave: 401 `MISSING_API_KEY`. |
| Verificación visual | Fixture sintética de Ajustes revisada en 1440×1000; no usa Supabase, `fetch` ni claves reales. |
| Secretos en repositorio | 0 claves reales o claves privadas detectadas. |

## Documentación entregada

La guía de integración incluye contratos, cabeceras, ejemplos `curl`, JavaScript y PHP, verificación HMAC, errores y buenas prácticas. También se entrega una colección Postman sin credenciales.[10] [11] La especificación OpenAPI se sirve desde el propio backend y una página navegable está disponible en `/api/external/v1/docs`.[12]

## Pendiente antes de uso real

El checkpoint debe publicarse desde la interfaz de Manus. Hasta entonces, la producción sigue ejecutando el servidor anterior aunque el esquema nuevo ya exista. Después de publicar, un administrador autorizado debe crear la clave compartida en **Ajustes → Transfers**, copiarla una sola vez y entregarla por un canal seguro.

El despachador de webhooks necesita además registrar el Heartbeat cada minuto con el `task_uid` guardado en `external_api_webhook_dispatcher_config`. Este paso debe hacerse después de publicar para no programar llamadas contra una ruta todavía inexistente. Hasta configurarlo, ningún webhook real debe activarse.

## References

[1]: ../server/externalTransferApiContract.ts "Contrato versionado de Transfers v1"
[2]: ../server/externalApiTransfers.ts "Endpoints bidireccionales"
[3]: ../server/externalApiAuth.ts "Autenticación, scopes, límite y auditoría"
[4]: ../server/externalApiKeyManagement.ts "Gestión administrativa de clave compartida"
[5]: ../supabase/migrations/20260901124500_external_transfers_bidirectional_api.sql "Migración principal"
[6]: ../server/externalApiWebhooks.ts "Gestión de webhooks"
[7]: ../server/externalWebhookSecurity.ts "Cifrado, firma y SSRF"
[8]: ../server/externalWebhookDispatcher.ts "Despachador y reintentos"
[9]: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy "Supabase Database Linter: RLS Enabled No Policy"
[10]: ./TRANSFER_API_INTEGRATION.md "Guía de integración"
[11]: ./planmint-transfers-api.postman_collection.json "Colección Postman"
[12]: ../server/externalTransferOpenApi.ts "OpenAPI y documentación navegable"
