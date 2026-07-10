# PlanMint External API v1

API RESTful para sistemas externos (Bluebnc BYM, etc.) para crear y gestionar solicitudes de transfer en PlanMint.

---

## Base URL

```
https://planmint-preview.manus.space/api/external/v1
```

---

## Autenticación

Todas las peticiones requieren una API key en el header `X-API-Key`:

```http
X-API-Key: pmk_abcdefgh_1234567890abcdef1234567890abcdef
```

Las API keys se generan desde el panel de administración de PlanMint o mediante el endpoint de gestión de keys.

**Formato de la key:** `pmk_<prefix(8)>_<secret(32)>`

---

## Respuestas

Todas las respuestas siguen el formato estándar:

### Éxito

```json
{
  "success": true,
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descripción del error",
    "details": ["campo X es requerido", "..."]
  }
}
```

### Códigos de Error

| Código | HTTP | Descripción |
|--------|------|-------------|
| `MISSING_API_KEY` | 401 | No se proporcionó API key |
| `INVALID_API_KEY_FORMAT` | 401 | Formato de API key incorrecto |
| `INVALID_API_KEY` | 401 | API key no existe o hash no coincide |
| `API_KEY_DEACTIVATED` | 403 | API key desactivada |
| `API_KEY_EXPIRED` | 403 | API key expirada |
| `INSUFFICIENT_PERMISSIONS` | 403 | La key no tiene el permiso requerido |
| `VALIDATION_ERROR` | 422 | Datos de entrada inválidos |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `ALREADY_CANCELLED` | 409 | Transfer ya cancelado |
| `ALREADY_COMPLETED` | 409 | No se puede cancelar un transfer completado |
| `INTERNAL_ERROR` | 500 | Error interno del servidor |

---

## Endpoints

### 1. Crear Solicitud de Transfer

```http
POST /api/external/v1/transfers
```

**Permiso requerido:** `transfers.create`

**Body (JSON):**

```json
{
  "client_name": "John Smith",
  "client_phone": "+34 612 345 678",
  "client_email": "john@example.com",
  "client_type": "villa",
  "villa_name": "Villa Serenity",
  "service_type": "airport",
  "broker_reference": "BYM-2025-0042",
  "notes": "Cliente VIP, necesita silla infantil",
  "items": [
    {
      "transfer_date": "2025-07-20",
      "pickup_location": "Aeropuerto de Palma (PMI)",
      "pickup_time": "14:30",
      "dropoff_location": "Villa Serenity, Calle del Mar 15, Port d'Andratx",
      "pax_count": 4,
      "vehicle_type": "v_class",
      "flight_number": "BA2491",
      "direction": "ida",
      "notes": "Terminal B, salida internacional",
      "has_return": true,
      "return_pickup_location": "Villa Serenity, Calle del Mar 15, Port d'Andratx",
      "return_pickup_time": "10:00",
      "return_dropoff_location": "Aeropuerto de Palma (PMI)",
      "return_dropoff_time": "11:30"
    }
  ]
}
```

**Campos del request:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `client_name` | string | Sí | Nombre del cliente |
| `client_phone` | string | No | Teléfono del cliente |
| `client_email` | string | No | Email del cliente |
| `client_type` | enum | No | `external_client`, `villa`, `boat`. Default: `external_client` |
| `villa_name` | string | No | Nombre de la villa (si `client_type` = `villa`) |
| `boat_name` | string | No | Nombre del barco (si `client_type` = `boat`) |
| `berth_number` | string | No | Número de amarre (si `client_type` = `boat`) |
| `service_type` | enum | No | `point_to_point`, `hourly`, `daily`, `airport`, `port`. Default: `point_to_point` |
| `broker_reference` | string | No | Referencia externa del sistema BYM |
| `notes` | string | No | Notas generales de la solicitud |
| `items` | array | Sí | Lista de transfers (mínimo 1) |

**Campos de cada item:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `transfer_date` | string | Sí | Fecha del transfer (YYYY-MM-DD) |
| `pickup_location` | string | Sí | Dirección de recogida |
| `pickup_time` | string | No | Hora de recogida (HH:MM) |
| `dropoff_location` | string | Sí | Dirección de destino |
| `dropoff_time` | string | No | Hora estimada de llegada (HH:MM) |
| `pax_count` | number | No | Número de pasajeros (1-50). Default: 1 |
| `vehicle_type` | enum | No | `sedan`, `v_class`, `minibus`, `sprinter`, `luxury`. Default: `v_class` |
| `flight_number` | string | No | Número de vuelo (para transfers aeropuerto) |
| `direction` | enum | No | `ida`, `vuelta`. Default: `ida` |
| `notes` | string | No | Notas del item |
| `has_return` | boolean | No | Si incluye trayecto de vuelta |
| `return_pickup_location` | string | Condicional | Requerido si `has_return` = true |
| `return_pickup_time` | string | No | Hora de recogida del retorno (HH:MM) |
| `return_dropoff_location` | string | Condicional | Requerido si `has_return` = true |
| `return_dropoff_time` | string | No | Hora de llegada del retorno (HH:MM) |

**Respuesta (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "request_number": "TRF-2025-0123",
    "status": "pendiente",
    "created_at": "2025-07-15T10:30:00.000Z",
    "items_count": 1,
    "items": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "position": 1,
        "transfer_date": "2025-07-20",
        "pickup_location": "Aeropuerto de Palma (PMI)",
        "dropoff_location": "Villa Serenity, Calle del Mar 15, Port d'Andratx",
        "vehicle_type": "v_class",
        "pax_count": 4
      }
    ]
  }
}
```

---

### 2. Listar Solicitudes de Transfer

```http
GET /api/external/v1/transfers
```

**Permiso requerido:** `transfers.read`

**Query Parameters:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | number | 1 | Página actual |
| `limit` | number | 20 | Resultados por página (máx. 100) |
| `status` | string | - | Filtrar por estado |
| `from_date` | string | - | Desde fecha (YYYY-MM-DD) |
| `to_date` | string | - | Hasta fecha (YYYY-MM-DD) |
| `search` | string | - | Buscar por nombre de cliente, número de solicitud o referencia |

**Respuesta (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "request_number": "TRF-2025-0123",
      "broker_name": "Bluebnc BYM",
      "client_name": "John Smith",
      "client_phone": "+34 612 345 678",
      "client_email": "john@example.com",
      "status": "confirmado",
      "service_type": "airport",
      "client_type": "villa",
      "notes": "Cliente VIP",
      "client_reference": "BYM-2025-0042",
      "created_at": "2025-07-15T10:30:00.000Z",
      "updated_at": "2025-07-15T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

---

### 3. Obtener Detalle de Transfer

```http
GET /api/external/v1/transfers/:id
```

**Permiso requerido:** `transfers.read`

**Respuesta (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "request_number": "TRF-2025-0123",
    "status": "confirmado",
    "client_name": "John Smith",
    "client_phone": "+34 612 345 678",
    "service_type": "airport",
    "notes": "Cliente VIP",
    "created_at": "2025-07-15T10:30:00.000Z",
    "items": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "position": 1,
        "transfer_date": "2025-07-20",
        "pickup_location": "Aeropuerto de Palma (PMI)",
        "pickup_time": "14:30:00",
        "dropoff_location": "Villa Serenity",
        "vehicle_type": "v_class",
        "pax_count": 4,
        "flight_number": "BA2491",
        "status": "confirmado",
        "driver_name": "Carlos García",
        "vehicle_plate": "4550NFG"
      }
    ],
    "status_history": [
      {
        "previous_status": null,
        "new_status": "pendiente",
        "changed_by_type": "api",
        "changed_by_name": "API: Bluebnc BYM",
        "note": "Solicitud creada vía API externa",
        "created_at": "2025-07-15T10:30:00.000Z"
      },
      {
        "previous_status": "pendiente",
        "new_status": "confirmado",
        "changed_by_type": "user",
        "changed_by_name": "Marc von Eiberg",
        "note": "Conductor asignado",
        "created_at": "2025-07-15T12:00:00.000Z"
      }
    ]
  }
}
```

---

### 4. Consultar Estado

```http
GET /api/external/v1/transfers/:id/status
```

**Permiso requerido:** `transfers.read`

Endpoint ligero para polling de estado sin cargar todos los datos.

**Respuesta (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "request_number": "TRF-2025-0123",
    "status": "confirmado",
    "updated_at": "2025-07-15T12:00:00.000Z"
  }
}
```

---

### 5. Cancelar Transfer

```http
POST /api/external/v1/transfers/:id/cancel
```

**Permiso requerido:** `transfers.cancel`

**Body (JSON, opcional):**

```json
{
  "reason": "Cliente canceló la reserva"
}
```

**Respuesta (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "request_number": "TRF-2025-0123",
    "previous_status": "pendiente",
    "new_status": "cancelado",
    "cancelled_at": "2025-07-16T09:00:00.000Z"
  }
}
```

---

### 6. Tipos de Vehículo (Metadata)

```http
GET /api/external/v1/transfers/meta/vehicle-types
```

**Permiso requerido:** `transfers.read`

**Respuesta (200 OK):**

```json
{
  "success": true,
  "data": [
    { "id": "sedan", "name": "Sedan", "description": "Berlina estándar (hasta 3 pasajeros)", "max_pax": 3 },
    { "id": "v_class", "name": "V-Class", "description": "Mercedes V-Class (hasta 6 pasajeros)", "max_pax": 6 },
    { "id": "minibus", "name": "Minibus", "description": "Minibus (hasta 16 pasajeros)", "max_pax": 16 },
    { "id": "sprinter", "name": "Sprinter", "description": "Mercedes Sprinter (hasta 19 pasajeros)", "max_pax": 19 },
    { "id": "luxury", "name": "Luxury", "description": "Vehículo de lujo (hasta 3 pasajeros)", "max_pax": 3 }
  ]
}
```

---

### 7. Estados Posibles (Metadata)

```http
GET /api/external/v1/transfers/meta/statuses
```

**Permiso requerido:** `transfers.read`

**Respuesta (200 OK):**

```json
{
  "success": true,
  "data": [
    { "id": "pendiente", "name": "Pendiente", "description": "Solicitud recibida, pendiente de revisión" },
    { "id": "aceptado", "name": "Aceptado", "description": "Solicitud aceptada y en proceso de asignación" },
    { "id": "confirmado", "name": "Confirmado", "description": "Transfer confirmado con conductor asignado" },
    { "id": "en_curso", "name": "En Curso", "description": "Transfer en ejecución" },
    { "id": "completado", "name": "Completado", "description": "Transfer finalizado" },
    { "id": "cancelado", "name": "Cancelado", "description": "Solicitud cancelada" }
  ]
}
```

---

## Gestión de API Keys

Estos endpoints requieren autenticación de usuario interno (JWT de Supabase) y son para administradores de PlanMint.

### Crear API Key

```http
POST /api/external/v1/keys
Authorization: Bearer <supabase_jwt>
```

```json
{
  "name": "Bluebnc BYM Production",
  "permissions": ["transfers.create", "transfers.read", "transfers.cancel"],
  "expires_at": "2026-12-31T23:59:59Z"
}
```

**Respuesta (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "key-uuid",
    "api_key": "pmk_abcdefgh_1234567890abcdef1234567890abcdef",
    "prefix": "abcdefgh",
    "name": "Bluebnc BYM Production",
    "message": "Store this API key securely. It will not be shown again."
  }
}
```

### Listar API Keys

```http
GET /api/external/v1/keys
Authorization: Bearer <supabase_jwt>
```

### Revocar API Key

```http
DELETE /api/external/v1/keys/:id
Authorization: Bearer <supabase_jwt>
```

### Ver Logs de una API Key

```http
GET /api/external/v1/keys/:id/logs?page=1&limit=50
Authorization: Bearer <supabase_jwt>
```

---

## Ejemplo Completo (cURL)

```bash
# Crear un transfer
curl -X POST https://planmint-preview.manus.space/api/external/v1/transfers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pmk_abcdefgh_1234567890abcdef1234567890abcdef" \
  -d '{
    "client_name": "John Smith",
    "client_phone": "+34 612 345 678",
    "client_type": "villa",
    "villa_name": "Villa Serenity",
    "service_type": "airport",
    "broker_reference": "BYM-2025-0042",
    "items": [
      {
        "transfer_date": "2025-07-20",
        "pickup_location": "Aeropuerto de Palma (PMI)",
        "pickup_time": "14:30",
        "dropoff_location": "Villa Serenity, Port d Andratx",
        "pax_count": 4,
        "vehicle_type": "v_class",
        "flight_number": "BA2491",
        "direction": "ida"
      }
    ]
  }'

# Consultar estado
curl -X GET https://planmint-preview.manus.space/api/external/v1/transfers/550e8400-e29b-41d4-a716-446655440000/status \
  -H "X-API-Key: pmk_abcdefgh_1234567890abcdef1234567890abcdef"

# Cancelar
curl -X POST https://planmint-preview.manus.space/api/external/v1/transfers/550e8400-e29b-41d4-a716-446655440000/cancel \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pmk_abcdefgh_1234567890abcdef1234567890abcdef" \
  -d '{"reason": "Cliente canceló reserva"}'
```

---

## Ejemplo en JavaScript/Node.js

```javascript
const API_BASE = "https://planmint-preview.manus.space/api/external/v1";
const API_KEY = "pmk_abcdefgh_1234567890abcdef1234567890abcdef";

async function createTransfer(transferData) {
  const response = await fetch(`${API_BASE}/transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(transferData),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(`API Error: ${result.error.code} - ${result.error.message}`);
  }

  return result.data;
}

// Uso
const transfer = await createTransfer({
  client_name: "María García",
  client_phone: "+34 655 123 456",
  service_type: "airport",
  items: [
    {
      transfer_date: "2025-08-01",
      pickup_location: "Hotel Meliá Palma, Paseo Marítimo",
      pickup_time: "06:00",
      dropoff_location: "Aeropuerto de Palma (PMI)",
      pax_count: 2,
      vehicle_type: "sedan",
      flight_number: "VY3912",
      direction: "ida",
    },
  ],
});

console.log(`Transfer creado: ${transfer.request_number}`);
```

---

## Rate Limiting

Actualmente no hay rate limiting estricto, pero se recomienda no exceder:
- 60 peticiones por minuto
- 1000 peticiones por hora

---

## Webhooks (Próximamente)

En futuras versiones se añadirá soporte para webhooks que notifiquen cambios de estado:
- `transfer.status_changed` — Cuando cambia el estado de un transfer
- `transfer.driver_assigned` — Cuando se asigna un conductor
- `transfer.completed` — Cuando se completa un transfer

---

## Soporte

Para dudas sobre la API, contactar con el equipo de PlanMint.
