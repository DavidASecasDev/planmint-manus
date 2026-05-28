# Rently Services API - Documentación descubierta

## Endpoints disponibles

### 1. GET /api/services/{id}
Retrieves a specific service by its identifier.
- **Path params**: id (integer, required)
- **Response 200**: Returns the requested service
- **Response 400**: Invalid service ID
- **Response 403**: Unauthenticated user
- **Response 404**: Service not found

Response sample:
```json
{
  "Id": 1,
  "CarId": "CAR123",
  "Km": 50000,
  "ServiceType": {
    "Id": 1,
    "Name": "Oil Change"
  },
  "Notes": "Regular maintenance service",
  "FromDate": "2026-05-28T18:52:19.6556301Z",
  "ToDate": "2026-05-28T20:52:19.6556301Z",
  "Status": 0,
  "Provider": null,
  "Price": 0,
  "IsFixed": true,
  "IsLockedForEdit": false
}
```

### 2. GET /api/services/types
Retrieves all active service types.
- **Response 200**: Returns the list of active service types

### 3. PUT /api/services
Updates an existing service schedule.
- Request body (same structure as create)

### 4. POST /api/services
Creates a new service schedule for a car.

Request body:
```json
{
  "CarId": "CAR123",        // string - Car ID in Rently
  "Km": 50000,              // integer - Current km
  "ServiceTypeId": 1,       // integer - Service type ID
  "Notes": "Regular maintenance service",  // string
  "FromDate": "2026-05-28T18:52:19.6556301Z",  // date-time
  "ToDate": "2026-05-28T20:52:19.6556301Z",    // date-time
  "Status": 0,              // integer - Enum: "Programed"=0, "InExecution"=1, "Finished"=2, "Canceled"=3
  "ProviderId": 1,          // integer - Provider/taller ID
  "Price": 0,               // number
  "IsFixed": false,         // boolean
  "IsLockedForEdit": false  // boolean
}
```

Response 200: Returns the created service (same structure as GET)
Response 400: Invalid request or car not available
Response 403: User lacks required permissions

## Status Enum
- 0 = "Programed" (Programado)
- 1 = "InExecution" (En Ejecución)
- 2 = "Finished" (Finalizado)
- 3 = "Canceled" (Cancelado)

## GET /api/services/types - Response sample
```json
[
  { "Id": 1, "Name": "Oil Change" },
  { "Id": 2, "Name": "Tire Rotation" },
  { "Id": 3, "Name": "Brake Service" }
]
```
Necesitamos llamar este endpoint para obtener el ID de "Bloqueo Disponibilidad".

## PUT /api/services - Update
This endpoint updates an existing service schedule, including:
- Service dates
- Provider information
- Service status
- Additional notes

Permissions required:
- CanEditServiceSchedule (base)
- CanBlockServiceUpdates: To change the locked status
- CanMakeServiceFixed: To change the fixed status

Request body (same as POST but with Id):
```json
{
  "Id": 1,
  "CarId": "CAR123",
  "Km": 50000,
  "ServiceTypeId": 1,
  "Notes": "Regular maintenance service",
  "FromDate": "2026-05-28T18:52:19Z",
  "ToDate": "2026-05-28T20:52:19Z",
  "Status": 1,
  "ProviderId": 1,
  "Price": 0,
  "IsFixed": true,
  "IsLockedForEdit": false
}
```

## Notas de implementación CLAVE
- **CarId ES LA MATRÍCULA** (ej: "2691MTL", "9589MTB") — NO es un número
- ServiceTypeId para "Bloqueo Disponibilidad" = **11**
- Status: 0=Programed, 1=InExecution, 2=Finished, 3=Canceled
- FromDate y ToDate son ISO 8601 date-time (sin Z en la respuesta, ej: "2024-05-28T11:00:00")
- ProviderId es opcional (integer) — podemos dejarlo null
- PUT requiere el Id del servicio para actualizar
- Para finalizar: PUT con Status=2 (Finished)
- Service types reales:
  - 1: Chapa/Pintura
  - 2: Neumáticos
  - 3: Asistencia en carretera
  - 4: Lunas
  - 5: Mecánica
  - 6: Tapiceria
  - 7: Escoba
  - 8: Limpieza especial
  - 9: Limpieza adicional
  - 10: Defleet
  - 11: Bloqueo Disponibilidad
  - 12: Lavado
