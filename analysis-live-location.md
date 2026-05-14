# Análisis: Compartir Ubicación en Tiempo Real del Rental

## Resumen del Feature
Cuando un rental pulsa "Iniciar" (En camino), se le ofrece compartir su ubicación GPS en tiempo real. 
El manager ve en el Mapa En Camino un marcador que se mueve mostrando la posición actual del rental.

## Arquitectura Propuesta

### Enfoque: Polling con Supabase (sin WebSockets adicionales)

**¿Por qué no WebSockets/Realtime?**
- El proyecto ya usa Supabase, que tiene Realtime integrado
- PERO: la frecuencia de actualización GPS (cada 10-15s) no justifica un canal WebSocket permanente
- El mapa ya hace polling cada 30s → simplemente incluimos las coordenadas en la respuesta existente
- Menos complejidad = menos bugs

**Flujo:**
1. Rental pulsa "Iniciar" → se le pide permiso de geolocalización (navigator.geolocation)
2. Si acepta → `watchPosition()` empieza a enviar coordenadas cada 15s al backend
3. Backend guarda lat/lng en `en_camino_tracking` (columnas nuevas: `current_lat`, `current_lng`, `location_updated_at`)
4. LiveMap al hacer polling recibe las coordenadas → muestra marcador del vehículo en la posición real
5. Al pulsar "Llegué" o cerrar la app → se detiene el watchPosition

### Cambios necesarios

#### Base de datos (en_camino_tracking)
- `current_lat` FLOAT nullable
- `current_lng` FLOAT nullable  
- `location_updated_at` TIMESTAMPTZ nullable
- `sharing_location` BOOLEAN default false

#### Backend
- Nuevo endpoint: `POST /api/en-camino-tracking/location` 
  - Body: `{ reservation_id, operation_type, lat, lng }`
  - Actualiza current_lat, current_lng, location_updated_at
  - Validación: solo permite actualizar si la operación está activa (no tiene llego_at)
- Modificar `handleEnCaminoList`: incluir current_lat, current_lng, location_updated_at, sharing_location en la respuesta

#### Frontend - ReservationsTable
- Al pulsar "Iniciar": pedir permiso geolocalización con dialog explicativo
- Si acepta: iniciar `navigator.geolocation.watchPosition()` 
- Enviar coordenadas cada 15s via `apiInvoke('en-camino-tracking/location', ...)`
- Guardar watchId en ref para limpieza
- Al pulsar "Llegué": detener watchPosition
- Indicador visual en la fila: icono de ubicación compartida (verde pulsante)

#### Frontend - LiveMap
- Para records con `sharing_location=true` y coordenadas recientes (< 2 min):
  - Mostrar marcador de vehículo en la posición real (icono diferente: coche)
  - Mantener el marcador de destino
  - Polyline desde posición actual hasta destino (no desde base)
  - Badge "En vivo" en la tarjeta del sidebar
- Para records sin ubicación compartida: comportamiento actual (marcador en destino)

### Consideraciones de Privacidad
- Opt-in explícito: el rental decide si comparte
- Solo durante la operación activa (no se trackea fuera de horario)
- Las coordenadas se borran al completar la operación (llego_at)
- No se almacena historial de posiciones, solo la última conocida

### Consideraciones Técnicas
- `watchPosition` consume batería → usar `enableHighAccuracy: false` para balance
- Timeout de 30s en watchPosition para no bloquear
- Si pierde GPS, el marcador muestra la última posición conocida con indicador "hace X min"
- Rate limit: máximo 1 update cada 10s por operación
- Limpiar watchPosition en useEffect cleanup y en beforeunload
