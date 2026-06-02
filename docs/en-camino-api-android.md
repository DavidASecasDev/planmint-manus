# API "En Camino" — Documentación para Android

## Base URL

```
https://plan-mint.com/api
```

Todas las peticiones requieren autenticación via header `Authorization: Bearer <supabase_jwt>` excepto las rutas públicas marcadas.

---

## Ciclo de vida completo de una operación "En Camino"

```
1. INICIAR  →  POST /api/en-camino-tracking
2. GPS      →  POST /api/en-camino-tracking/location  (cada 10-15s)
3. LLEGÓ    →  POST /api/en-camino-tracking/llego
   ─── ó ───
3. CANCELAR →  DELETE /api/en-camino-tracking  (o POST con _method: 'DELETE')
```

---

## 1. Iniciar trayecto (marcar "En Camino")

**`POST /api/en-camino-tracking`**

```json
{
  "reservation_id": "uuid-de-la-reserva",
  "operation_type": "entrega" | "devolucion",
  "destination_address": "Portals Nous, Calvià",
  "assigned_user_name": "Nombre del conductor",
  "estimated_minutes": 25
}
```

**Respuesta (200):**
```json
{
  "ok": true,
  "record": {
    "id": "uuid-del-tracking",
    "share_token": "Xpe7vRZmh4V1",
    "en_camino_at": "2026-06-01T13:13:40.636Z",
    "sharing_location": false
  }
}
```

**Notas:**
- Usa `upsert` con conflicto en `(reservation_id, operation_type)`, así que llamar dos veces actualiza el timestamp en lugar de crear duplicados.
- El `share_token` se genera automáticamente y sirve para el enlace público `/track/:token`.
- Si la operación ya tiene `llego_at` (ya llegó), devuelve error 409.

---

## 2. Enviar ubicación GPS en vivo

**`POST /api/en-camino-tracking/location`**

```json
{
  "reservation_id": "uuid-de-la-reserva",
  "operation_type": "entrega" | "devolucion",
  "latitude": 39.5697,
  "longitude": 2.6502,
  "accuracy": 12.5
}
```

**Respuesta (200):**
```json
{ "ok": true }
```

**Notas:**
- Enviar cada **10-15 segundos** mientras el conductor está en movimiento.
- Actualiza `current_lat`, `current_lng`, `location_updated_at` y `sharing_location = true` en el registro.
- También inserta un punto en `location_history` para el trail/replay posterior.
- **Importante:** Filtrar por `accuracy < 50m` antes de enviar para evitar puntos GPS imprecisos.

---

## 3. Detener compartición de ubicación (sin cancelar el trayecto)

**`POST /api/en-camino-tracking/location-stop`**

```json
{
  "reservation_id": "uuid-de-la-reserva",
  "operation_type": "entrega" | "devolucion"
}
```

**Respuesta (200):**
```json
{ "ok": true }
```

**Notas:**
- Pone `sharing_location = false` y limpia `current_lat/lng/location_updated_at`.
- El registro sigue activo en el Live Map pero sin posición GPS en vivo.
- Usar cuando el usuario desactiva manualmente la compartición de ubicación.

---

## 4. Confirmar llegada al destino

**`POST /api/en-camino-tracking/llego`**

```json
{
  "reservation_id": "uuid-de-la-reserva",
  "operation_type": "entrega" | "devolucion",
  "estimated_minutes": 25,
  "llego_user_name": "Nombre de quien confirma"
}
```

**Respuesta (200):**
```json
{
  "ok": true,
  "real_minutes": 22,
  "estimated_minutes": 25,
  "llego_at": "2026-06-01T13:35:40.000Z"
}
```

**Notas:**
- Establece `llego_at` en el registro, lo que automáticamente lo elimina de la lista activa del Live Map.
- Devuelve la comparativa de tiempo real vs estimado.
- Si ya tiene `llego_at`, devuelve los datos existentes sin actualizar.
- **Después de llamar a `/llego`, también llamar a `/location-stop`** para limpiar el GPS.

---

## 5. Cancelar operación (CRÍTICO — eliminar del Live Map)

**`DELETE /api/en-camino-tracking`**

```json
{
  "reservation_id": "uuid-de-la-reserva",
  "operation_type": "entrega" | "devolucion"
}
```

**Respuesta (200):**
```json
{ "ok": true }
```

**Alternativa (si el cliente HTTP no soporta body en DELETE):**

**`POST /api/en-camino-tracking`** con:
```json
{
  "_method": "DELETE",
  "reservation_id": "uuid-de-la-reserva",
  "operation_type": "entrega" | "devolucion"
}
```

**Notas:**
- **ESTE ES EL ENDPOINT QUE FALTABA.** Si el usuario cancela el trayecto, cambia el estado de la reserva, o decide no ir, **DEBE** llamarse este endpoint.
- Elimina completamente el registro de `en_camino_tracking`.
- Sin esta llamada, la operación seguirá apareciendo en el Mapa En Vivo indefinidamente.
- **Antes de llamar a DELETE**, llamar primero a `/location-stop` si había GPS activo.

---

## 6. Obtener estado de tracking (consulta)

**`POST /api/en-camino-tracking/status`**

```json
{
  "reservation_ids": ["uuid-1", "uuid-2"]
}
```

**Respuesta (200):**
```json
{
  "ok": true,
  "status": {
    "uuid-1": {
      "entrega": {
        "en_camino_at": "2026-06-01T13:13:40.636Z",
        "llego_at": null,
        "real_minutes": null,
        "estimated_minutes": 25,
        "assigned_user_name": "David",
        "llego_user_name": null
      }
    }
  }
}
```

---

## 7. Obtener share token (para enlace público)

**`POST /api/en-camino-tracking/share-token`**

```json
{
  "reservation_id": "uuid-de-la-reserva",
  "operation_type": "entrega" | "devolucion"
}
```

**Respuesta (200):**
```json
{
  "ok": true,
  "share_token": "Xpe7vRZmh4V1"
}
```

El enlace público es: `https://plan-mint.com/track/Xpe7vRZmh4V1`

---

## Ruta pública (sin autenticación)

**`GET /api/track/:token`** — Devuelve datos sanitizados para el cliente final (sin IDs internos).

**`GET /api/track/:token/eta`** — Devuelve ETA calculado por Google Maps.

---

## Flujo recomendado para Android

```kotlin
// 1. Usuario pulsa "Iniciar trayecto"
val response = api.post("/en-camino-tracking", body)
val shareToken = response.record.share_token

// 2. Iniciar servicio de ubicación en foreground
locationService.start { location ->
    if (location.accuracy < 50) {
        api.post("/en-camino-tracking/location", LocationBody(
            reservation_id = reservationId,
            operation_type = opType,
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = location.accuracy
        ))
    }
}

// 3a. Usuario confirma llegada
locationService.stop()
api.post("/en-camino-tracking/location-stop", StopBody(...))
api.post("/en-camino-tracking/llego", LlegoBody(...))

// 3b. Usuario CANCELA el trayecto
locationService.stop()
api.post("/en-camino-tracking/location-stop", StopBody(...))
api.delete("/en-camino-tracking", DeleteBody(
    reservation_id = reservationId,
    operation_type = opType
))
// ⚠️ SIN ESTA LLAMADA, la operación queda "fantasma" en el Live Map
```

---

## Errores comunes

| Código | Mensaje | Causa |
|--------|---------|-------|
| 400 | `reservation_id and operation_type required` | Faltan campos obligatorios |
| 409 | `Operation already completed` | Se intentó re-iniciar una operación que ya tiene `llego_at` |
| 500 | `Internal server error` | Error de Supabase (ver logs del servidor) |

---

## Tabla de campos en `en_camino_tracking`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK auto-generado |
| `reservation_id` | uuid | FK a reservations |
| `operation_type` | text | `'entrega'` o `'devolucion'` |
| `en_camino_at` | timestamptz | Momento en que se marcó En Camino |
| `llego_at` | timestamptz | Momento de llegada (null = en curso) |
| `destination_address` | text | Dirección destino |
| `assigned_user_name` | text | Nombre del conductor |
| `estimated_minutes` | int | Minutos estimados por Google Maps |
| `current_lat` | float | Última latitud GPS |
| `current_lng` | float | Última longitud GPS |
| `location_updated_at` | timestamptz | Última actualización GPS |
| `sharing_location` | boolean | Si está compartiendo GPS en vivo |
| `share_token` | text | Token para enlace público |
| `llego_user_name` | text | Quién confirmó la llegada |
