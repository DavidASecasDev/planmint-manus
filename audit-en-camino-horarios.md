# Auditoría — Mapa En Camino, Reservas (Iniciar/Llegué), Horarios

## Backend: enCaminoTrackingEndpoint.ts

### Bug 1: handleEnCaminoTrack — upsert borra llego_at de operaciones completadas
**Severidad: ALTA**
Si un usuario pulsa "Iniciar" en una operación que ya fue completada (tiene llego_at), el upsert
sobreescribe el registro con en_camino_at nuevo y SIN llego_at (porque no se incluye en el upsert).
Esto resetea una operación completada a "En camino" de nuevo.
**Fix:** Antes del upsert, verificar si ya existe un registro con llego_at != null.

### Bug 3: handleEnCaminoLlego — permite múltiples llegadas
**Severidad: MEDIA**
Si existe un registro con llego_at ya puesto, lo sobreescribe con un nuevo llego_at.
**Fix:** Añadir check: si el registro ya tiene llego_at, rechazar.

### Bug 8: Nominatim sin throttle puede causar rate limiting
**Severidad: MEDIA**
Múltiples requests simultáneas a Nominatim sin delay de 1s.

## Backend: scheduleEndpoints.ts (Horarios)

### Bug 13: dailyCounts usa `desde`/`hasta` en lugar de confirmed datetime
**Severidad: MEDIA**
Debería usar confirmed_entrega_datetime con fallback a desde.

### Bug 14: Filtro de reservas para dailyCounts tiene lógica OR incorrecta
**Severidad: ALTA**
La query `.or().or()` produce AND de dos ORs, resultados incorrectos.

## Bugs a Corregir (Priorizados)

| # | Severidad | Descripción |
|---|-----------|-------------|
| 1 | ALTA | Upsert puede resetear operaciones completadas |
| 14 | ALTA | Filtro OR incorrecto en dailyCounts |
| 3 | MEDIA | Permite múltiples llegadas |
| 13 | MEDIA | dailyCounts usa desde/hasta en vez de confirmed |
| 8 | MEDIA | Nominatim sin throttle |
