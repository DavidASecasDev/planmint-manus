# API de Movimientos — Documentación para Android

## Base URL

```
https://plan-mint.com/api
```

Todas las peticiones requieren autenticación via header `Authorization: Bearer <supabase_jwt>`.

El JWT se obtiene al hacer login con Supabase Auth (`signInWithPassword`). El SDK de Supabase para Android gestiona automáticamente el refresh del token.

---

## Ciclo de vida completo de un Movimiento

```
1. FOTO + OCR  →  POST /api/ocr-plate           (opcional, detectar matrícula)
2. SUBIR FOTO  →  POST /api/movements/upload-photo
3. INICIAR     →  POST /api/movements/start
4. CONSULTAR   →  GET  /api/movements/mine       (mis movimientos)
5. FINALIZAR   →  POST /api/movements/end
   ─── ó ───
5. CANCELAR    →  POST /api/movements/cancel
```

---

## Tipos de movimiento

| Valor       | Descripción                        |
|-------------|-------------------------------------|
| `entrega`   | Entregar un vehículo al cliente     |
| `recogida`  | Recoger un vehículo del cliente     |
| `escoba`    | Vehículo de acompañamiento          |
| `limpieza`  | Limpieza de un vehículo             |

## Estados de movimiento

| Valor        | Descripción                           |
|--------------|----------------------------------------|
| `en_curso`   | Movimiento activo (en progreso)        |
| `completado` | Movimiento finalizado correctamente    |
| `cancelado`  | Movimiento cancelado                   |

---

## 1. OCR de matrícula (opcional)

**`POST /api/ocr-plate`**

Envía una foto del vehículo y el servidor detecta la matrícula automáticamente usando IA.

```json
{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Respuesta (200):**
```json
{
  "plate": "1234ABC",
  "success": true
}
```

**Si no se detecta:**
```json
{
  "plate": "",
  "success": false
}
```

> **Nota:** El OCR es best-effort. Si falla, el conductor debe introducir la matrícula manualmente.

---

## 2. Subir foto del movimiento

**`POST /api/movements/upload-photo`**

Sube una foto (inicio o fin del movimiento) y devuelve la URL pública.

```json
{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Respuesta (200):**
```json
{
  "ok": true,
  "url": "https://quilsunfhfqqnibheqzl.supabase.co/storage/v1/object/public/movement-photos/org123/1717250000-abc123.jpg"
}
```

> **Importante:** La imagen debe ser JPEG o PNG. Tamaño máximo recomendado: 5MB. El campo `image_base64` puede incluir o no el prefijo `data:image/...;base64,`.

---

## 3. Iniciar movimiento

**`POST /api/movements/start`**

```json
{
  "matricula": "1234ABC",
  "movement_type": "entrega",
  "start_photo_url": "https://...url-de-la-foto-subida...",
  "start_lat": 39.5696,
  "start_lng": 2.6502,
  "destination_address": "Portals Nous, Calvià",
  "estimated_minutes": 25,
  "enable_tracking": true,
  "notes": "Cliente espera en recepción hotel"
}
```

| Campo               | Tipo     | Requerido | Descripción                              |
|---------------------|----------|-----------|------------------------------------------|
| `matricula`         | string   | **Sí**    | Matrícula del vehículo (sin espacios)    |
| `movement_type`     | string   | **Sí**    | Uno de: entrega, recogida, escoba, limpieza |
| `start_photo_url`   | string   | No        | URL de la foto de inicio (del paso 2)    |
| `start_lat`         | number   | No        | Latitud GPS al iniciar                   |
| `start_lng`         | number   | No        | Longitud GPS al iniciar                  |
| `destination_address` | string | No        | Dirección de destino (para tracking en mapa) |
| `estimated_minutes` | number   | No        | Minutos estimados de viaje               |
| `enable_tracking`   | boolean  | No        | Activar tracking GPS en vivo (default: true para entrega/recogida) |
| `reservation_id`    | string   | No        | UUID de la reserva asociada (si aplica)  |
| `vehicle_id`        | string   | No        | UUID del vehículo operacional            |
| `notes`             | string   | No        | Notas adicionales                        |

**Respuesta (200):**
```json
{
  "ok": true,
  "movement": {
    "id": "uuid-del-movimiento",
    "organization_id": "uuid-org",
    "matricula": "1234ABC",
    "movement_type": "entrega",
    "driver_id": "uuid-del-conductor",
    "start_photo_url": "https://...",
    "start_lat": 39.5696,
    "start_lng": 2.6502,
    "status": "en_curso",
    "started_at": "2026-06-02T10:30:00.000Z",
    "notes": "Cliente espera en recepción hotel"
  },
  "tracking": {
    "enabled": true,
    "share_token": "Xpe7vRZmh4V1"
  }
}
```

**Errores posibles:**

| Status | Mensaje                                          | Causa                                    |
|--------|--------------------------------------------------|------------------------------------------|
| 400    | `matricula and movement_type are required`       | Campos obligatorios faltantes            |
| 400    | `movement_type must be one of: ...`              | Tipo de movimiento inválido              |
| 404    | `Matrícula "X" no encontrada en la flota...`     | La matrícula no existe en fleet_vehicles |

> **Validación de matrícula:** El servidor verifica que la matrícula exista en la tabla `fleet_vehicles` de la organización. Si no existe, devuelve 404. El conductor debe verificar la matrícula o registrar el vehículo en Flota primero.

---

## 4. Consultar movimientos

### 4a. Mis movimientos (del conductor actual)

**`GET /api/movements/mine`**

Query params opcionales:

| Param    | Tipo   | Default | Descripción                          |
|----------|--------|---------|--------------------------------------|
| `status` | string | todos   | Filtrar por estado (en_curso, completado, cancelado) |
| `limit`  | number | 20      | Máximo de resultados (max 100)       |
| `offset` | number | 0       | Offset para paginación               |

**Ejemplo:** `GET /api/movements/mine?status=en_curso&limit=10`

**Respuesta (200):**
```json
{
  "ok": true,
  "movements": [
    {
      "id": "uuid",
      "matricula": "1234ABC",
      "movement_type": "entrega",
      "status": "en_curso",
      "started_at": "2026-06-02T10:30:00.000Z",
      "ended_at": null,
      "start_photo_url": "https://...",
      "end_photo_url": null,
      "notes": "..."
    }
  ]
}
```

### 4b. Movimientos activos de la organización

**`GET /api/movements/active`**

Devuelve todos los movimientos con `status = "en_curso"` de la organización. Incluye datos del conductor.

**Respuesta (200):**
```json
{
  "ok": true,
  "movements": [
    {
      "id": "uuid",
      "matricula": "1234ABC",
      "movement_type": "entrega",
      "status": "en_curso",
      "started_at": "2026-06-02T10:30:00.000Z",
      "driver": {
        "id": "uuid-conductor",
        "name": "David Dev."
      }
    }
  ]
}
```

### 4c. Detalle de un movimiento

**`GET /api/movements/:id`**

**Respuesta (200):**
```json
{
  "ok": true,
  "movement": {
    "id": "uuid",
    "matricula": "1234ABC",
    "movement_type": "entrega",
    "status": "en_curso",
    "started_at": "2026-06-02T10:30:00.000Z",
    "ended_at": null,
    "start_photo_url": "https://...",
    "end_photo_url": null,
    "start_lat": 39.5696,
    "start_lng": 2.6502,
    "end_lat": null,
    "end_lng": null,
    "notes": "...",
    "driver": {
      "id": "uuid-conductor",
      "name": "David Dev."
    }
  }
}
```

---

## 5. Finalizar movimiento

**`POST /api/movements/end`**

```json
{
  "movement_id": "uuid-del-movimiento",
  "end_photo_url": "https://...url-de-la-foto-final...",
  "end_lat": 39.5432,
  "end_lng": 2.6789
}
```

| Campo          | Tipo   | Requerido | Descripción                           |
|----------------|--------|-----------|---------------------------------------|
| `movement_id`  | string | **Sí**    | UUID del movimiento a finalizar       |
| `end_photo_url`| string | No        | URL de la foto final (del paso 2)     |
| `end_lat`      | number | No        | Latitud GPS al finalizar              |
| `end_lng`      | number | No        | Longitud GPS al finalizar             |

**Respuesta (200):**
```json
{
  "ok": true,
  "movement": {
    "id": "uuid",
    "status": "completado",
    "ended_at": "2026-06-02T11:05:00.000Z",
    "end_photo_url": "https://...",
    "end_lat": 39.5432,
    "end_lng": 2.6789
  }
}
```

**Errores posibles:**

| Status | Mensaje                                          | Causa                                    |
|--------|--------------------------------------------------|------------------------------------------|
| 400    | `movement_id is required`                        | Falta el ID del movimiento               |
| 404    | `Movimiento no encontrado`                       | ID no existe o no pertenece a la org     |
| 403    | `No tienes acceso a este movimiento`             | El movimiento es de otra organización    |
| 409    | `El movimiento ya está en estado "X"`            | Solo se pueden finalizar movimientos en_curso |

---

## 6. Cancelar movimiento

**`POST /api/movements/cancel`**

```json
{
  "movement_id": "uuid-del-movimiento"
}
```

**Respuesta (200):**
```json
{
  "ok": true,
  "movement": {
    "id": "uuid",
    "status": "cancelado"
  }
}
```

**Errores posibles:**

| Status | Mensaje                                                    | Causa                              |
|--------|------------------------------------------------------------|------------------------------------|
| 400    | `movement_id is required`                                  | Falta el ID                        |
| 404    | `Movimiento no encontrado`                                 | ID no existe                       |
| 409    | `Solo se pueden cancelar movimientos en curso (actual: X)` | Ya completado o cancelado          |

---

## Flujo completo en Kotlin (ejemplo)

```kotlin
// 1. Capturar foto y detectar matrícula
val ocrResponse = api.post("/api/ocr-plate", mapOf(
    "image_base64" to imageBase64
))
val plate = if (ocrResponse.success) ocrResponse.plate else manualPlateInput

// 2. Subir la foto
val uploadResponse = api.post("/api/movements/upload-photo", mapOf(
    "image_base64" to imageBase64
))
val photoUrl = uploadResponse.url

// 3. Obtener GPS
val location = locationManager.getLastKnownLocation()

// 4. Iniciar el movimiento (con tracking GPS en vivo)
val startResponse = api.post("/api/movements/start", mapOf(
    "matricula" to plate,
    "movement_type" to "entrega",
    "start_photo_url" to photoUrl,
    "start_lat" to location.latitude,
    "start_lng" to location.longitude,
    "destination_address" to destinationAddress,  // ¡IMPORTANTE para el mapa!
    "estimated_minutes" to estimatedMinutes,      // opcional
    "enable_tracking" to true,                    // default para entrega/recogida
    "notes" to notesInput
))
val movementId = startResponse.movement.id
val shareToken = startResponse.tracking?.share_token  // Token para compartir con el cliente

// 5. TRACKING GPS EN VIVO (mientras el conductor conduce)
// Enviar posición cada 10-15 segundos
val trackingReservationId = "mov_$movementId"  // ¡Prefijo mov_ obligatorio!
fun sendGpsUpdate(lat: Double, lng: Double, accuracy: Float?) {
    api.post("/api/en-camino-tracking/location", mapOf(
        "reservation_id" to trackingReservationId,
        "operation_type" to "entrega",  // o "devolucion" para recogida
        "lat" to lat,
        "lng" to lng,
        "accuracy" to accuracy
    ))
}

// Iniciar servicio de ubicación en background
locationService.startTracking { location ->
    sendGpsUpdate(location.latitude, location.longitude, location.accuracy)
}

// ... el conductor conduce hacia el destino ...

// 6. Al llegar: detener tracking + capturar foto final
locationService.stopTracking()
// Opcionalmente, notificar que se detuvo la ubicación:
api.post("/api/en-camino-tracking/location-stop", mapOf(
    "reservation_id" to trackingReservationId,
    "operation_type" to "entrega"
))

val endPhotoUrl = uploadPhoto(endImageBase64)
val endLocation = locationManager.getLastKnownLocation()

// 7. Finalizar el movimiento (esto también cierra el tracking automáticamente)
val endResponse = api.post("/api/movements/end", mapOf(
    "movement_id" to movementId,
    "end_photo_url" to endPhotoUrl,
    "end_lat" to endLocation.latitude,
    "end_lng" to endLocation.longitude
))

// ─── Alternativa: Cancelar (también elimina el tracking) ───
locationService.stopTracking()
val cancelResponse = api.post("/api/movements/cancel", mapOf(
    "movement_id" to movementId
))
```

---

## Headers requeridos

```
Authorization: Bearer <supabase_jwt>
Content-Type: application/json
```

El JWT se obtiene con el SDK de Supabase para Android:
```kotlin
val session = supabase.auth.currentSession
val jwt = session?.accessToken
```

---

## Notas de implementación

1. **Validación de matrícula:** El servidor valida que la matrícula exista en `fleet_vehicles`. Si el vehículo no está registrado, devuelve 404. No se puede crear un movimiento para un vehículo no registrado.

2. **Fotos:** Siempre subir la foto ANTES de crear/finalizar el movimiento. El endpoint `upload-photo` devuelve la URL que luego se pasa a `start` o `end`.

3. **GPS:** Es opcional pero muy recomendado. Permite al equipo de oficina ver dónde se inició y finalizó cada movimiento.

4. **OCR:** El reconocimiento de matrícula es best-effort. Si falla (`success: false`), mostrar un campo de texto para que el conductor la introduzca manualmente.

5. **Movimientos activos:** Un conductor puede tener múltiples movimientos activos simultáneamente (ej. escoba + entrega).

6. **Integración con En Camino (Tracking GPS en vivo):** Al iniciar un movimiento tipo `entrega` o `recogida`, el servidor crea automáticamente un registro de tracking GPS en vivo. Esto permite que el equipo de oficina vea el movimiento en el **Mapa En Vivo** (Live Map). Al finalizar o cancelar el movimiento, el tracking se desactiva automáticamente. Para movimientos tipo `escoba` o `limpieza`, NO se activa tracking (no tienen destino definido). Puedes desactivar el tracking pasando `enable_tracking: false` en el body de start.

7. **Offline:** Si la app pierde conexión, guardar los datos localmente y reintentar cuando vuelva la conexión. El campo `started_at` se genera en el servidor, no en el cliente.

---

## Tabla de campos del movimiento

| Campo             | Tipo      | Descripción                                    |
|-------------------|-----------|------------------------------------------------|
| `id`              | uuid      | ID único del movimiento                        |
| `organization_id` | uuid      | Organización a la que pertenece                |
| `matricula`       | string    | Matrícula del vehículo                         |
| `movement_type`   | enum      | entrega, recogida, escoba, limpieza            |
| `driver_id`       | uuid      | ID del conductor que creó el movimiento        |
| `status`          | enum      | en_curso, completado, cancelado                |
| `started_at`      | timestamp | Fecha/hora de inicio (UTC)                     |
| `ended_at`        | timestamp | Fecha/hora de fin (UTC, null si en_curso)      |
| `start_photo_url` | string    | URL de la foto de inicio                       |
| `end_photo_url`   | string    | URL de la foto de fin                          |
| `start_lat`       | number    | Latitud GPS al iniciar                         |
| `start_lng`       | number    | Longitud GPS al iniciar                        |
| `end_lat`         | number    | Latitud GPS al finalizar                       |
| `end_lng`         | number    | Longitud GPS al finalizar                      |
| `vehicle_id`      | uuid      | ID del vehículo operacional (FK)               |
| `reservation_id`  | uuid      | ID de la reserva asociada (opcional)           |
| `notes`           | string    | Notas adicionales                              |

---

## Integración GPS Tracking en Vivo (En Camino)

Cuando se inicia un movimiento tipo `entrega` o `recogida`, el servidor crea automáticamente un registro de tracking GPS. Esto permite que el equipo de oficina vea la posición del conductor en tiempo real en el **Mapa En Vivo**.

### Flujo automático

```
POST /api/movements/start (entrega/recogida)
    └── Servidor crea registro en en_camino_tracking
        └── Live Map muestra la operación automáticamente
        └── Se genera share_token para compartir con el cliente

POST /api/movements/end
    └── Servidor marca tracking como "llegó" y desactiva GPS

POST /api/movements/cancel
    └── Servidor elimina el registro de tracking completamente
```

### Enviar posición GPS durante el trayecto

**`POST /api/en-camino-tracking/location`**

```json
{
  "reservation_id": "mov_<movement_id>",
  "operation_type": "entrega",
  "lat": 39.5696,
  "lng": 2.6502,
  "accuracy": 10.5
}
```

| Campo             | Tipo   | Requerido | Descripción                                    |
|-------------------|--------|-----------|------------------------------------------------|
| `reservation_id`  | string | **Sí**    | `"mov_" + movement_id` (prefijo obligatorio)   |
| `operation_type`  | string | **Sí**    | `"entrega"` o `"devolucion"` (recogida → devolucion) |
| `lat`             | number | **Sí**    | Latitud actual                                 |
| `lng`             | number | **Sí**    | Longitud actual                                |
| `accuracy`        | number | No        | Precisión del GPS en metros                    |

**Respuesta (200):**
```json
{ "ok": true }
```

**Errores:**

| Status | Mensaje                              | Causa                                         |
|--------|--------------------------------------|-----------------------------------------------|
| 400    | `reservation_id and operation_type required` | Campos faltantes                      |
| 400    | `lat and lng are required as numbers`| Coordenadas inválidas                         |
| 404    | `No active en_camino record found`   | El movimiento ya fue finalizado o cancelado   |

### Detener compartición de ubicación

**`POST /api/en-camino-tracking/location-stop`**

```json
{
  "reservation_id": "mov_<movement_id>",
  "operation_type": "entrega"
}
```

> **Nota:** Esto solo marca `sharing_location = false`. El registro de tracking sigue existiendo hasta que se llame a `end` o `cancel`. Útil si el conductor quiere pausar temporalmente la compartición.

### Mapeo de tipos

| `movement_type` | `operation_type` en tracking | Tracking activo |
|-----------------|------------------------------|-----------------|
| `entrega`       | `entrega`                    | **Sí**          |
| `recogida`      | `devolucion`                 | **Sí**          |
| `escoba`        | —                            | No              |
| `limpieza`      | —                            | No              |

### Frecuencia de envío GPS recomendada

| Situación                | Intervalo recomendado |
|--------------------------|-----------------------|
| Conduciendo (> 10 km/h) | Cada 10 segundos      |
| Parado/lento             | Cada 30 segundos      |
| Batería baja (< 15%)    | Cada 60 segundos      |

### Enlace de seguimiento para el cliente

Cuando el movimiento se inicia con tracking, la respuesta incluye un `share_token`. La URL pública de seguimiento es:

```
https://plan-mint.com/track/<share_token>
```

Esta URL se puede enviar al cliente por WhatsApp para que vea en tiempo real dónde está su vehículo.

### Implementación Android recomendada

```kotlin
class GpsTrackingService : Service() {
    private var movementId: String? = null
    private var operationType: String = "entrega"
    
    fun startTracking(movId: String, opType: String) {
        movementId = movId
        operationType = opType
        // Usar FusedLocationProviderClient con PRIORITY_HIGH_ACCURACY
        // Intervalo: 10 segundos
        locationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
    }
    
    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            // Enviar al servidor en background (usar WorkManager o coroutine)
            scope.launch {
                try {
                    api.post("/api/en-camino-tracking/location", mapOf(
                        "reservation_id" to "mov_${movementId}",
                        "operation_type" to operationType,
                        "lat" to location.latitude,
                        "lng" to location.longitude,
                        "accuracy" to location.accuracy
                    ))
                } catch (e: Exception) {
                    // No fallar silenciosamente, guardar para retry
                    pendingUpdates.add(GpsUpdate(location))
                }
            }
        }
    }
    
    fun stopTracking() {
        locationClient.removeLocationUpdates(locationCallback)
        // Notificar al servidor que se detuvo
        scope.launch {
            api.post("/api/en-camino-tracking/location-stop", mapOf(
                "reservation_id" to "mov_${movementId}",
                "operation_type" to operationType
            ))
        }
    }
}
```

> **Permisos Android requeridos:**
> - `ACCESS_FINE_LOCATION`
> - `ACCESS_COARSE_LOCATION`
> - `FOREGROUND_SERVICE` (para tracking en background)
> - `FOREGROUND_SERVICE_LOCATION` (Android 14+)
