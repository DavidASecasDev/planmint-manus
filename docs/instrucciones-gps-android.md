# Instrucciones GPS en Vivo — App Android

## Problema actual

Cuando un conductor marca "En Camino" desde la web (Programación), el registro de tracking se crea correctamente pero **la ubicación del conductor NO aparece en el Mapa En Vivo** porque la app Android no está enviando coordenadas GPS al servidor.

## Solución requerida

La app Android debe enviar la posición GPS del conductor **cada 10-15 segundos** al siguiente endpoint mientras el trayecto esté activo.

---

## Endpoint de envío GPS

```
POST https://plan-mint.com/api/en-camino-tracking/location
```

**Headers:**
```
Authorization: Bearer <supabase_jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "reservation_id": "37354c20-ef33-4a73-be38-9ed400294078",
  "operation_type": "devolucion",
  "latitude": 39.5697,
  "longitude": 2.6502,
  "accuracy": 12.5
}
```

**Respuesta (200):**
```json
{ "ok": true }
```

---

## ¿De dónde saco el `reservation_id` y `operation_type`?

Cuando el conductor inicia "En Camino" desde la app, o cuando la web lo marca, el registro se crea en la tabla `en_camino_tracking`. La app puede consultar las operaciones activas del conductor:

```
POST https://plan-mint.com/api/en-camino-tracking/status
```

```json
{
  "reservation_ids": ["37354c20-ef33-4a73-be38-9ed400294078"]
}
```

O bien, al iniciar el trayecto desde la app con `POST /api/en-camino-tracking`, la respuesta devuelve el `reservation_id` y `operation_type` que se deben usar.

---

## Implementación mínima en Kotlin

```kotlin
class GpsTrackingService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var reservationId: String = ""
    private var operationType: String = ""

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        reservationId = intent?.getStringExtra("reservation_id") ?: return START_NOT_STICKY
        operationType = intent.getStringExtra("operation_type") ?: return START_NOT_STICKY
        
        startForeground(NOTIFICATION_ID, createNotification())
        startLocationUpdates()
        return START_STICKY
    }

    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
            .setMinUpdateIntervalMillis(5_000L)
            .build()

        fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    }

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            
            // Solo enviar si la precisión es aceptable (< 50 metros)
            if (location.accuracy > 50f) return
            
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    api.post("/api/en-camino-tracking/location", mapOf(
                        "reservation_id" to reservationId,
                        "operation_type" to operationType,
                        "latitude" to location.latitude,
                        "longitude" to location.longitude,
                        "accuracy" to location.accuracy
                    ))
                } catch (e: Exception) {
                    // Guardar en cola local para reintentar
                    Log.w("GPS", "Error enviando posición: ${e.message}")
                }
            }
        }
    }

    fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        
        // Notificar al servidor que se detuvo la compartición
        CoroutineScope(Dispatchers.IO).launch {
            api.post("/api/en-camino-tracking/location-stop", mapOf(
                "reservation_id" to reservationId,
                "operation_type" to operationType
            ))
        }
        
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }
}
```

---

## Cuándo iniciar y detener el servicio GPS

| Evento | Acción |
|--------|--------|
| Conductor pulsa "Iniciar trayecto" | Iniciar `GpsTrackingService` |
| Conductor pulsa "He llegado" | Llamar `stopTracking()` → luego `POST /llego` |
| Conductor cancela el trayecto | Llamar `stopTracking()` → luego `DELETE /en-camino-tracking` |
| App se cierra / conductor desactiva GPS | Llamar `POST /location-stop` |

---

## Permisos Android necesarios

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

## Qué pasa en el servidor cuando recibe GPS

1. Actualiza `current_lat`, `current_lng`, `location_updated_at` en `en_camino_tracking`
2. Pone `sharing_location = true`
3. Inserta un punto en `location_history` (para dibujar el trail en el mapa)
4. El Live Map del equipo de oficina ve el marcador del coche moverse en tiempo real

---

## Validaciones importantes

- **Filtrar por accuracy < 50m** — no enviar posiciones imprecisas (GPS indoor, sin señal)
- **No enviar si el dispositivo está quieto** — comparar con la última posición enviada, si la distancia es < 5m no enviar
- **Reintentar en caso de error de red** — guardar en cola local y enviar cuando haya conexión
- **Frecuencia: 10-15 segundos** — no más frecuente (consume batería), no menos frecuente (el mapa se ve "saltando")

---

## Ejemplo de test rápido con cURL

Para probar que el endpoint funciona (reemplazar el JWT y reservation_id reales):

```bash
curl -X POST https://plan-mint.com/api/en-camino-tracking/location \
  -H "Authorization: Bearer <JWT_DEL_CONDUCTOR>" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": "37354c20-ef33-4a73-be38-9ed400294078",
    "operation_type": "devolucion",
    "latitude": 39.5697,
    "longitude": 2.6502,
    "accuracy": 10
  }'
```

Si devuelve `{"ok": true}`, el marcador aparecerá inmediatamente en el Live Map.

---

## Resumen

**El problema es simple:** la app no está llamando a `POST /api/en-camino-tracking/location`. Una vez que se implemente el `ForegroundService` que envía GPS cada 10-15s, el marcador del conductor aparecerá automáticamente en el Mapa En Vivo y los clientes podrán ver la ubicación en tiempo real desde el enlace de tracking.
