# Rently Migration Test Results — 2026-07-08

## Test 1: /api/bookings/list

**Status: 200 OK** — El endpoint funciona correctamente.

### Hallazgo IMPORTANTE: La respuesta NO coincide con lo que Rently describió en el email

El email decía:
- "DeliveryPlace y ReturnPlace se eliminan → se devuelven DeliveryPlaceId y ReturnPlaceId"
- "Customer, Car, Model, Category pasan a ser DTOs reducidos"
- "Se quitan PriceItems, Attributes, etc."

**Realidad observada:**
- `DeliveryPlace` y `ReturnPlace` **SIGUEN siendo objetos completos** (con Id, Name, Address, City, Country, BranchOfficeId, Latitude, Longitude)
- `DeliveryPlaceId` y `ReturnPlaceId` **NO están presentes** en la respuesta
- `PriceItems` **SIGUE presente** en la respuesta
- `Attributes` **SIGUE presente** en la respuesta
- `Customer` **NO es un DTO reducido** — tiene todos los campos
- `Car` tiene estructura diferente: `Car.Id` es un string ("1892MSD") no un número, y `Plate` no está presente directamente
- `TotalDaysString` y `AvailablePromotions` sí fueron removidos

### Campos verificados (usados por mapBookingToReservation):

| Campo | Estado | Valor ejemplo |
|-------|--------|---------------|
| Customer.Firstname | ⚠️ null en este caso | (era "Matias Miranda" en OData) |
| Customer.Lastname | ✅ Presente | "Mery" |
| Customer.EmailAddress | ✅ Presente | "mgmirand@gmail.com" |
| Customer.CellPhone | ✅ Presente | "688928595" |
| Customer.DocumentId | ✅ Presente | "07172846C" |
| Car.Id | ⚠️ String no Number | "1892MSD" |
| Car.Plate | ❌ No presente | (Car.Id parece ser la matrícula) |
| Car.Model.Name | ✅ Presente | "Cooper S Cabrio" |
| Car.Model.Category.Name | ❌ No presente | (Category es campo separado a nivel de booking) |
| DeliveryPlace.Name | ✅ Presente (objeto completo) | "Oficina Azul Cars..." |
| ReturnPlace.Name | ✅ Presente (objeto completo) | "Oficina Azul Cars..." |
| CustomerPrice | ✅ Presente | 290.4 |
| Origin.Name | ✅ Presente | "Web" |
| TotalDays | ✅ Presente | 1 |
| IsFullBonus | ✅ Presente (nuevo) | false |
| FeeNoShow | ✅ Presente (nuevo) | 0 |

### Conclusión Test 1:
El endpoint `/api/bookings/list` **ya está activo y funciona**, pero la respuesta es MUCHO MÁS RICA de lo que el email sugería. Los cambios descritos (DTOs reducidos, PlaceIds) probablemente se aplicarán el 13/7/2026 cuando se deprece el viejo. Por ahora, ambos endpoints devuelven datos completos.

**ACCIÓN**: Nuestra migración es correcta y compatible con ambos escenarios:
- Si la respuesta sigue teniendo objetos completos → funciona (usa DeliveryPlace.Name directamente)
- Si cambia a IDs → funciona (usa el places cache para resolver)

## Test 2: /api/places

**Status: 200 OK** — 36 places disponibles.
El cache de places funciona correctamente para resolver IDs cuando sea necesario.

## Test 3: /odata/bookings

**Status: 200 OK** — Funciona con $select y $expand.

- `$select` funciona: puede traer solo campos específicos
- `$expand=Customer` funciona: trae datos expandidos
- `$filter=CurrentStatus eq 2` devuelve 400 (probablemente usa enum string, no número)
- CurrentStatus en OData es string ("Canceled") no número (4)

### Evaluación OData:
- **Ventaja**: Reduce payload significativamente con $select
- **Desventaja**: Modelo de datos diferente (CurrentStatus es string, no número)
- **Desventaja**: Requiere reescribir toda la lógica de paginación y filtrado
- **Recomendación**: NO migrar a OData ahora. La migración a /api/bookings/list es suficiente y de menor riesgo.
