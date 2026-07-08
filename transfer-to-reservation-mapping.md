# Transfer → Reservation Mapping

## Existing Transfer reservations pattern:
- `external_reservation_id`: "MANUAL-{timestamp}" → we'll use "TRF-{transfer_item_id}"
- `organization_id`: "a23a0d42-5af7-4cda-9955-569c10cc6714"
- `tipo_actividad`: "Transfer"
- `cliente_nombre`: client name from transfer request
- `desde`: transfer_time (the date/time of the service)
- `lugar_entrega`: pickup address (used as the route description)
- `lugar_devolucion`: null (or dropoff for reference)
- `auto`: vehicle plate (if known)
- `modelo`: vehicle type (Vito/V-Class)
- `notas`: any notes
- `origen_reserva`: "Manual" → we'll use "Transfer Automático"
- `contacto`: client phone
- `es_transferencia`: false (existing ones have false, but we could set true)
- `estado`: null (existing ones have null)

## Mapping from transfer_items:
| Reservation field | Transfer source |
|---|---|
| external_reservation_id | "TRF-{item.id}" |
| organization_id | request.organization_id |
| tipo_actividad | "Transfer" |
| cliente_nombre | request.client_name |
| telefono | request.client_phone |
| email | request.client_email |
| desde | item.transfer_time |
| lugar_entrega | item.pickup_address |
| lugar_devolucion | item.dropoff_address |
| lugar_entrega_direccion | item.pickup_address (full) |
| lugar_devolucion_direccion | item.dropoff_address (full) |
| modelo | item.vehicle_type |
| notas | item.notes + direction info |
| origen_reserva | "Transfer Broker" or "Transfer Interno" |
| contacto | request.client_phone |
| es_transferencia | true |
