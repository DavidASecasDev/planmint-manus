# PlanMint Transfers API v1

**Autor:** Manus AI  
**Base URL de producción:** `https://plan-mint.com/api/external/v1`  
**Especificación OpenAPI:** `https://plan-mint.com/api/external/v1/openapi.json`

> La API usa una clave compartida de Azul Cars. La clave permite consultar todas las solicitudes de Transfers de la organización, incluidas las creadas desde PlanMint, el portal y la propia API. El software comercial no debe conectarse directamente a Supabase.[1](../server/externalApiAuth.ts) [2](../server/externalApiTransfers.ts)

## Autenticación y seguridad

Todas las operaciones protegidas requieren la cabecera `X-API-Key`. La creación requiere además una cabecera `Idempotency-Key` estable para el intento lógico. Si el software reintenta la misma petición con la misma clave y el mismo contenido, PlanMint devuelve la solicitud original; si reutiliza la clave con un contenido distinto, responde `409 IDEMPOTENCY_CONFLICT`.[2](../server/externalApiTransfers.ts) [3](../supabase/migrations/20260901124500_external_transfers_bidirectional_api.sql)

| Cabecera | Obligatoria | Uso |
|---|---:|---|
| `X-API-Key` | Sí | Autenticación compartida y scopes. |
| `Idempotency-Key` | Solo `POST /transfers` | Evita duplicados por reintentos. |
| `X-Request-ID` | No | UUID de correlación generado por el cliente; PlanMint devuelve uno si falta. |
| `Content-Type` | En operaciones con cuerpo | `application/json`. |

La clave se muestra una sola vez al crearla o rotarla. Debe guardarse en el gestor de secretos del software comercial, nunca en código fuente, navegador, URL, correo o logs.

## Scopes

| Scope | Capacidades |
|---|---|
| `transfers.create` | Crear solicitudes. |
| `transfers.read` | Listar y consultar todas las solicitudes de Azul Cars. |
| `transfers.cancel` | Cancelar solicitudes pendientes o aceptadas. |
| `webhooks.manage` | Crear, editar, probar, rotar y desactivar webhooks. |

## Crear una solicitud

`POST /transfers`

Los campos `client_type`, `client_name`, `client_phone` e `items` son obligatorios. Cada servicio requiere fecha, hora, origen, destino, tipo de vehículo y pasajeros. La API admite maletas, hasta cuatro furgonetas, sillitas, coordenadas de Google Places y enlaces entre ida y vuelta.[4](../server/externalTransferApiContract.ts)

```bash
curl --request POST 'https://plan-mint.com/api/external/v1/transfers' \
  --header 'X-API-Key: ${PLANMINT_API_KEY}' \
  --header 'Idempotency-Key: crm-transfer-2026-000123' \
  --header 'Content-Type: application/json' \
  --data '{
    "client_type": "villa",
    "client_name": "Cliente de ejemplo",
    "client_phone": "+34000000000",
    "client_email": "cliente@example.com",
    "villa_name": "Villa de ejemplo",
    "external_reference": "CRM-000123",
    "items": [{
      "direction": "ida",
      "transfer_date": "2026-09-18",
      "transfer_time": "10:30",
      "pickup_location": "Aeropuerto de Palma",
      "dropoff_location": "Destino de ejemplo",
      "vehicle_type": "mercedes_v_class",
      "pax_count": 4,
      "luggage_count": 3,
      "vans_needed": 1,
      "baby_seats_count": 1,
      "baby_seats": [{ "age": 3, "weight": 15 }]
    }]
  }'
```

```javascript
const response = await fetch("https://plan-mint.com/api/external/v1/transfers", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.PLANMINT_API_KEY,
    "Idempotency-Key": "crm-transfer-2026-000123",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
const result = await response.json();
if (!response.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
```

```php
$ch = curl_init('https://plan-mint.com/api/external/v1/transfers');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: ' . getenv('PLANMINT_API_KEY'),
        'Idempotency-Key: crm-transfer-2026-000123',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);
$result = json_decode(curl_exec($ch), true);
```

Una creación nueva devuelve HTTP `201`; un reintento idempotente correcto devuelve HTTP `200` y `data.replayed: true`.

## Consultar solicitudes

`GET /transfers?page=1&limit=50` devuelve todas las solicitudes de la organización, sin distinguir su canal de origen. Admite `status`, `from_date`, `to_date` y `search`. El máximo por página es 100.

```bash
curl 'https://plan-mint.com/api/external/v1/transfers?status=pendiente&page=1&limit=50' \
  --header 'X-API-Key: ${PLANMINT_API_KEY}'
```

`GET /transfers/{id}` devuelve la solicitud, sus servicios y el historial de estados. `GET /transfers/{id}/status` devuelve únicamente el estado actual.

## Cancelar

`POST /transfers/{id}/cancel` admite únicamente solicitudes `pendiente` o `aceptado`. Una cancelación ya aplicada es idempotente; los servicios asociados pasan también a `cancelado`.[2](../server/externalApiTransfers.ts) [3](../supabase/migrations/20260901124500_external_transfers_bidirectional_api.sql)

```bash
curl --request POST 'https://plan-mint.com/api/external/v1/transfers/UUID/cancel' \
  --header 'X-API-Key: ${PLANMINT_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '{"reason":"El cliente ha cancelado el servicio"}'
```

## Webhooks

El software comercial puede registrar un receptor HTTPS mediante `POST /webhooks`. El secreto `signing_secret` se muestra una sola vez. PlanMint valida el destino contra redes privadas, firma cada cuerpo con HMAC-SHA256, bloquea redirecciones y aplica reintentos persistentes.[5](../server/externalApiWebhooks.ts) [6](../server/externalWebhookSecurity.ts) [7](../server/externalWebhookDispatcher.ts)

```json
{
  "name": "CRM comercial",
  "url": "https://crm.example.com/webhooks/planmint",
  "events": ["transfer.created", "transfer.status_changed", "transfer.cancelled"]
}
```

| Cabecera webhook | Contenido |
|---|---|
| `X-PlanMint-Event` | Tipo de evento. |
| `X-PlanMint-Delivery` | UUID único de entrega. |
| `X-PlanMint-Timestamp` | Epoch en segundos usado en la firma. |
| `X-PlanMint-Signature` | `v1=` seguido de HMAC-SHA256. |

Para verificar la firma, calcule HMAC sobre `${timestamp}.${rawBody}` usando el secreto del webhook. Debe usar el cuerpo crudo recibido y rechazar timestamps antiguos según la política del software receptor.

```javascript
import crypto from "node:crypto";

function validPlanMintSignature({ secret, timestamp, rawBody, signature }) {
  const expected = "v1=" + crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
```

Los eventos contienen `event_id`, `type`, `occurred_at` y `data`. La combinación `webhook_id + event_id` es única, por lo que el receptor también debe deduplicar por `event_id`.

## Errores

Todas las respuestas de error mantienen el mismo contrato:

```json
{
  "success": false,
  "request_id": "uuid-de-correlacion",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": [{ "field": "items.0.transfer_time", "message": "..." }]
  }
}
```

| HTTP | Código habitual | Significado |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Campo ausente o formato inválido. |
| 401 | `MISSING_API_KEY`, `INVALID_API_KEY` | Credencial ausente o no válida. |
| 403 | `INSUFFICIENT_PERMISSIONS` | La clave no contiene el scope. |
| 404 | `NOT_FOUND` | Recurso ajeno o inexistente. |
| 409 | `IDEMPOTENCY_CONFLICT`, `CANCELLATION_NOT_ALLOWED` | Conflicto lógico. |
| 429 | `RATE_LIMIT_EXCEEDED` | Límite por minuto superado. |

## References

[1]: ../server/externalApiAuth.ts "Autenticación de la API externa"
[2]: ../server/externalApiTransfers.ts "Endpoints bidireccionales de Transfers"
[3]: ../supabase/migrations/20260901124500_external_transfers_bidirectional_api.sql "Migración transaccional e idempotente"
[4]: ../server/externalTransferApiContract.ts "Contrato y validación v1"
[5]: ../server/externalApiWebhooks.ts "Gestión de webhooks"
[6]: ../server/externalWebhookSecurity.ts "Firma, cifrado y anti-SSRF"
[7]: ../server/externalWebhookDispatcher.ts "Outbox y reintentos"
