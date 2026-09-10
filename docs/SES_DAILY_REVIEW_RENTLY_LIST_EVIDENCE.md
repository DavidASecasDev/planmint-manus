# Evidencia de contrato Rently para revisión diaria SES

**Origen:** verificación de solo lectura comunicada por el usuario el 10/09/2026. No se realizaron consultas adicionales ni escrituras desde esta tarea.

| Consulta observada | Resultado relevante |
|---|---|
| `GET /api/bookings/list?limit=1` | Devuelve `Offset`, `Limit`, `Total=5587`, `Results` y `NextOffset` |
| Elementos de `Results` | Incluyen `DeliveryInfo`, `DropoffInfo`, `UpdatedOn` y `CurrentStatus` |
| `GET /api/bookings/list?limit=30&offset=5560` | Incluye los casos de prueba 5578 y 5582 en la misma página paginada |
| Reserva 5578 | `CurrentStatus=2`, `DeliveryInfo.Date=2026-09-09T17:56:39.05` |
| Reserva 5582 | `CurrentStatus=3`, `DeliveryInfo.Date=2026-09-09T23:05:19.643`, `DropoffInfo.Date=2026-09-10T17:30:11.73` |

Esta evidencia permite acreditar los **eventos de entrega y devolución** mediante un barrido completo de `/api/bookings/list`, siempre que se demuestre inicio en offset cero, agotamiento de `NextOffset`, ausencia de filtros de sede/estado y ventana temporal completa. El detalle `GET /api/booking/{id}` se reserva para expedientes ya seleccionados que necesiten enriquecimiento adicional; no es requisito para descubrir cada evento.
