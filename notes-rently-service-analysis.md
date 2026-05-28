# Análisis: Crear servicio en Rently automáticamente al enviar vehículo a taller

## Hallazgos clave

### API de Rently - Servicios
Basándome en las capturas del usuario, Rently tiene un módulo de "Servicios" separado de reservas con:
- **Campos**: Auto, Tipo de Servicio, Proveedor, Desde, Hasta, Estado, Notas, Archivo Adjunto, Bloquear Edición
- **Tipos de Servicio**: Asistencia en carretera, Bloqueo Disponibilidad, Chapa/Pintura, Defleet, Escoba, Lavado, Limpieza adicional, Limpieza especial
- **Estados**: Programado, En Ejecución, Finalizado, Cancelado

### Endpoint probable de la API
No hay documentación pública de la API de servicios de Rently, pero siguiendo el patrón de la API existente:
- Reservas: `/api/booking` (POST), `/api/bookings` (GET list)
- Clientes: `/api/customer` (POST), `/api/customers` (GET list)
- Vehículos: `/api/cars` (GET list), `/api/car/{id}` (GET)

**Patrón probable para servicios:**
- `POST /api/service` → Crear servicio
- `GET /api/services` → Listar servicios
- `GET /api/service/{id}` → Detalle
- `PUT /api/service` → Actualizar servicio

### Payload probable para crear servicio
Basándome en los campos visibles en la UI de Rently:
```json
{
  "CarId": 123,           // ID del coche en Rently
  "ServiceTypeId": 2,     // ID del tipo (Bloqueo Disponibilidad)
  "From": "2026-05-28",   // Fecha inicio
  "To": "2026-06-15",     // Fecha fin
  "Notes": "Chapa y pintura - golpe lateral",
  "Status": 1             // 1=Programado, 2=En Ejecución, 3=Finalizado, 4=Cancelado
}
```

### Plan de implementación

#### Fase 1: Descubrir la API de servicios
- Usar el endpoint `explore` del rentlyHub para probar `/api/services` y `/api/service`
- Identificar los IDs de tipos de servicio disponibles
- Confirmar el payload de creación

#### Fase 2: Backend - Nuevo endpoint `/api/repair-service-sync`
- Crear servicio en Rently cuando repair pasa a `en_taller`
- Actualizar servicio cuando cambian fechas en Garatech
- Finalizar servicio cuando repair pasa a `finalizado`
- Guardar `rently_service_id` en tabla repairs (nuevo campo)

#### Fase 3: Frontend - Integrar en flujo de cambio de status
- Al mover a `en_taller`: llamar al endpoint de sync automáticamente
- Mostrar feedback del resultado (éxito/error)
- No bloquear el cambio de status si Rently falla (best-effort + retry)

#### Fase 4: Sincronización bidireccional de fechas
- Cuando se actualizan `started_at` o `completed_at` en Garatech → actualizar en Rently
- Tipo de servicio: "Bloqueo Disponibilidad" (el más genérico para bloquear el coche)
