# Revisión de la API oficial de Rently frente a PlanMint

**Autor:** Manus AI  
**Fecha:** 3 de septiembre de 2026  
**Alcance:** auditoría documental y estática; **sin modificar código productivo, sin usar credenciales Rently y sin desplegar**.

## Conclusión ejecutiva

**Sí, debemos aplicar cambios.** La conexión base de PlanMint usa correctamente el tenant, OAuth2 Bearer, el listado paginado moderno y los códigos de estado oficiales. Sin embargo, la documentación y el OpenAPI actuales confirman **cuatro rutas de escritura obsoletas**, varios nombres de propiedades incompatibles con los DTO ligeros y completos, un cuerpo de pago incorrecto y dos riesgos de seguridad en el proxy y la auditoría de acciones.

Estos hallazgos explican incoherencias ya visibles como **matrícula/modelo presentes pero marca ausente**. No basta con añadir un fallback aislado en SES.HOSPEDAJES: hay que corregir primero el adaptador común de Rently para que Programación, Vehículos, ficha de reserva y SES consuman un modelo canónico coherente.

## Lo que ya está correcto

| Área | Resultado |
|---|---|
| URL multi-tenant | PlanMint usa `https://{tenant}.rently.com.ar`, conforme a la guía oficial.[1] |
| Autenticación | Envía `grant_type=client_credentials`, `client_id`, `client_secret` y después `Authorization: Bearer`.[1] [2] |
| Listado de reservas | Usa `GET /api/bookings/list`, `limit=100` y el `NextOffset` devuelto por Rently.[3] |
| Estados | El mapa 0 Reservada, 1 Confirmada, 2 Entregada, 3 Cerrada, 4 Cancelada y 5 Cotizada coincide conceptualmente.[3] |
| Detalle y conductores | `GET /api/booking/{id}` y `GET /api/booking/{id}/drivers` siguen vigentes.[4] [5] |
| Operaciones | Entrega, devolución, reubicación y transferencia de vehículos usan rutas oficiales.[6] [7] [8] |
| Protección local | La sincronización conserva horarios confirmados y ubicaciones editadas manualmente; esta protección debe mantenerse al corregir el adaptador.[20] |
| Sincronización post-acción | Tras una escritura exitosa, PlanMint vuelve a consultar la reserva; el patrón es correcto y debe conservarse.[21] |

## Cambios obligatorios

### P0 — corregir antes de confiar en escrituras desde PlanMint

| Hallazgo | Código actual | Contrato oficial | Impacto |
|---|---|---|---|
| Confirmar/reservar | `POST /api/booking/confirm` | `POST /api/booking/reserve` con `BookingId` y `Lastname` obligatorios.[9] | La acción puede responder 404 o 400. El formulario actual solo envía `BookingId`. |
| Crear reserva | `POST /api/booking` | `POST /api/booking/book`.[10] | La creación desde PlanMint apunta a una ruta ausente del OpenAPI. Además usa `Notes`; el campo oficial es `Extra`. |
| Registrar pago | `POST /api/booking/payment` | `POST /api/booking/pay` con `BookingId`, `GatewayId` y `Amount >= 0.01`.[11] | La ruta, nombres y cuerpo no coinciden. El diálogo envía `{reservationId, payload}` y el backend reenvía el wrapper completo. |
| Obtener auto en Rently Hub | `GET /api/car/{id}` | `GET /api/cars/{id}`.[12] | El detalle de vehículo puede fallar aunque el ID sea correcto. |

La comparación automática normalizó parámetros y contrastó **26 rutas únicas configuradas** contra los **130 paths normalizados** del OpenAPI. Solo esas cuatro rutas no existen en el contrato oficial. Las demás rutas inventariadas sí tienen correspondencia.

### P0 — corregir el adaptador de lectura

El comentario de `RentlyBooking` afirma que representa el DTO ligero moderno, pero sus propiedades no coinciden con `BookingDescription`:

| Entidad | Oficial | PlanMint espera actualmente | Efecto |
|---|---|---|---|
| Cliente en lista | `Name`, `Lastname`, `DocumentType`, `Birthday`, `Country` | `Firstname`, `DocumentTypeId`, `BirthDate` | Nombre, documento y nacimiento pueden quedar vacíos hasta cargar detalle. |
| Vehículo en lista | `Car.Id`, `Car.Model`, `Car.CurrentPlate.Id` | `Car.Plate`; si falta, usa `Car.Id` como matrícula | Puede guardar el identificador interno del auto como si fuese matrícula. |
| Modelo/categoría | `Model` y `Category` también están en la raíz de la reserva | Busca principalmente `Car.Model` y `Car.Model.Category` | Puede perder modelo/categoría aunque Rently los haya enviado. |
| Marca | `BookingDescription.Brand` y, según el DTO completo, datos del modelo | No normaliza la marca en el adaptador común | Marca ausente en PlanMint y SES aunque Rently tenga información. |
| Matrícula en detalle | `CurrentPlateId` y `CurrentPlate.Id` | `Car.Plate` | El enriquecimiento detallado puede no recuperar la matrícula. |
| Combustible | `FuelType` es string y el nivel es `Gasoline` | `FuelType.Name` y `FuelLevel` | Tipo y nivel pueden quedar nulos. |
| Fecha de estado | `CurrentStatusDate` | Guarda `new Date()` como `rently_status_date` | La ficha muestra hora de sincronización bajo la etiqueta “Último cambio estado”. |

El adaptador debe aceptar **aliases controlados** para respuestas históricas, pero dar precedencia a las propiedades oficiales actuales. Debe prohibirse expresamente usar `Car.Id` como matrícula.

### P0 — cerrar dos riesgos de seguridad

`POST /api/rently-hub` permite actualmente `action=explore`, método HTTP arbitrario y endpoint arbitrario a cualquier sesión autenticada, sin permiso granular ni allowlist. Aunque no aparece conectado a la interfaz, la ruta existe en el servidor y podría invocar escrituras de Rently. Debe restringirse a `GET` y catálogo permitido o eliminarse; si se conserva una consola administrativa, debe exigir `rently.manage`.[22]

La auditoría de `rentlyActions` guarda `requestData: { ...actionData, _redacted: true }`. Añadir `_redacted` **no elimina** el resto de los campos. Una acción de cliente o pago podría persistir documento, contacto o datos de tarjeta/CVV. Debe registrarse solo acción, entidad, resultado, código de error, duración y campos no sensibles permitidos. Nunca debe persistirse el cuerpo de pago.[21]

## Cambios recomendados

### P1 — importante para integridad y rendimiento

| Cambio | Motivo |
|---|---|
| Cliente OAuth compartido con caché | Rently indica que el token dura un día y debe reutilizarse hasta expirar.[1] PlanMint tiene cinco implementaciones distintas de autenticación y solicita tokens repetidamente. |
| Catálogo de tipos documentales | Los tipos están configurados por tenant en `GET /api/configurations/documentTypes`; el mapa fijo `1=DNI, 2=Licencia, 3=Pasaporte` no es portable.[13] |
| Diferenciar nacionalidad y residencia | Rently describe `Customer.Country` como país de nacionalidad.[14] SES usa actualmente ese valor como país del domicilio; no debe afirmarse que es residencia sin evidencia. |
| Validar conductores en runtime | La operación oficial existe, pero su página no publica schema.[5] El parser debe aceptar el modelo observado de forma defensiva y alertar si cambia. |
| Eliminar límite silencioso del Hub | El explorador se detiene después de 10 páginas/1.000 registros. Debe seguir `NextOffset` o devolver `truncated=true`. |
| Corregir búsqueda de clientes | La API oficial usa `filter`, `offset` y `limit`; PlanMint envía `search`.[15] |
| Parsear errores estructurados | Rently documenta `{ ErrorMessage, ErrorCode, Id }` para errores de negocio.[16] PlanMint devuelve texto genérico y puede ocultar el identificador útil de soporte. |
| Pruebas de contrato OpenAPI | Deben fijar paths, métodos, parámetros máximos y DTOs críticos para detectar futuras desviaciones. |

### P2 — mejora de sincronización

Rently ofrece `updatedSince` en `GET /api/bookings/list`; devuelve reservas actualizadas estrictamente después del instante indicado, pero excluye legados sin `UpdatedOn`.[3] Conviene adoptar un diseño híbrido: incremental frecuente con solapamiento temporal y reconciliación completa periódica. También existe `GET /api/bookings/closed`, con rango de cierre máximo de 90 días, útil para reconciliar cierres históricos.[17]

La sincronización actual recorre tres páginas por llamada y reinicia desde cero cuando completa. Es funcional, pero las cinco páginas “sin cambios” solo consideran cambios de estado o detalles cargados, no todos los campos del DTO. Una reserva antigua cuyo horario, vehículo o cliente cambie sin cambiar de estado puede tardar hasta el siguiente recorrido completo en actualizarse. `UpdatedOn` permite detectar ese caso con menor coste.

## Impacto por módulo

| Módulo | Impacto de no corregir | Cambio requerido |
|---|---|---|
| Programación | Matrícula/modelo incorrectos dificultan emparejar operaciones; `rently_status_date` muestra una fecha engañosa. | Usar DTO canónico y `CurrentStatusDate`; preservar fechas confirmadas y ubicaciones manuales. |
| Vehículos | Un ID interno guardado como matrícula puede romper el enlace con flota y la liberación/asignación automática. | Resolver `CurrentPlate.Id`; normalizar matrícula en todos los enlaces. |
| SES.HOSPEDAJES | Marca, matrícula, categoría, combustible y país pueden quedar ausentes o semánticamente mal clasificados. | Alimentar SES desde el adaptador corregido; mantener pendientes cuando el dato oficial no existe y no inventar residencia. |
| Ficha de reserva | Combustible y “último cambio de estado” pueden ser incorrectos o nulos. | Mapear `Gasoline`, `FuelType` y `CurrentStatusDate`. |
| Acciones Rently | Confirmación, creación y pago no cumplen las rutas actuales; cancelación tampoco aporta el apellido obligatorio desde el hook. | Validar cuerpos con esquemas por acción y corregir rutas antes de habilitarlas. |

## Plan de implementación recomendado

| Fase | Trabajo | Pruebas de aceptación |
|---|---|---|
| 1. Seguridad y escrituras | Desactivar temporalmente confirmación, creación y pago; cerrar `explore`; redactar auditoría. | Ninguna acción fuera de allowlist; ningún cuerpo/PII/CVV en logs; rutas y campos oficiales exactos. |
| 2. Adaptador canónico | Crear tipos separados `BookingDescription` y `BookingDetail`; normalizar cliente, vehículo, lugares, estado y fechas. | Fixtures oficiales: `CurrentPlate.Id`, modelo/categoría raíz, `Gasoline`, `FuelType`, `CurrentStatusDate`; cero `Car.Id` usado como matrícula. |
| 3. Escrituras correctas | Corregir reserve/book/pay/car; exigir apellido y `GatewayId`; usar `Extra`; validar con Zod. | 400 local antes de llamar a Rently si falta un obligatorio; post-acción sincroniza el ID resultante. |
| 4. OAuth y errores | Unificar cliente, caché con expiración y retry único ante 401; parsear errores Rently. | Reutiliza token; 401 renueva una vez; conserva `ErrorCode` e `Id` sin datos sensibles. |
| 5. Incremental híbrida | Añadir `updatedSince` con watermark y solapamiento, manteniendo reconciliación completa/closed. | Cambio sin estado se importa; legado sin `UpdatedOn` aparece en reconciliación completa; cursor no pierde filas. |
| 6. Regresión | Programación, flota, SES, reservas y acciones. | Fechas manuales intactas; ubicaciones manuales intactas; marca/modelo/matrícula coherentes; cancelación/reactivación correctas. |

## Decisión recomendada

No recomiendo aplicar un parche aislado solamente a la marca. Recomiendo ejecutar **P0 y P1 como una única corrección del adaptador Rently**, seguida de pruebas sintéticas contra fixtures derivados del OpenAPI. P2 puede realizarse después porque mejora latencia y carga, pero no es requisito para corregir los datos ya desalineados.

No parece necesaria una migración destructiva. Puede ser útil una migración aditiva pequeña para guardar el watermark `UpdatedOn` y, si se decide, separar nacionalidad de país de residencia. Antes de cualquier backfill real debe hacerse un dry-run agregado que detecte reservas donde `auto` coincide con un ID de coche Rently y no con una matrícula; no debe corregirse por heurística ni sobrescribirse una asignación manual.

## Archivos afectados si se autoriza

| Archivo | Cambio principal |
|---|---|
| `server/syncRently.ts` | DTOs oficiales, adaptador canónico, matrícula/modelo/categoría/estado/cliente y OAuth compartido. |
| `server/rentlyActions.ts` | Rutas/cuerpos correctos, validación por acción y auditoría segura. |
| `server/rentlyHub.ts` | Cerrar `explore`, corregir auto/clientes y eliminar truncamiento silencioso. |
| `client/src/hooks/useRentlyActions.ts` | Apellido obligatorio y contratos tipados. |
| `client/src/components/reservations/CreateRentlyBookingDialog.tsx` | `Extra`, ruta book y validación oficial. |
| `client/src/components/reservations/BookingPaymentsDialog.tsx` | Cuerpo `pay`, `GatewayId` y eliminación del wrapper. |
| `server/sesHospedajes/vehicleResolver.ts` | `CurrentPlate`, marca/categoría raíz y aliases controlados. |
| Pruebas Rently/SES/Programación | Fixtures OpenAPI y protección de campos manuales. |

## References

[1]: https://developers.rently.com.ar/api-overview "Visión general de la API de Rently"
[2]: https://developers.rently.com.ar/authentication "Autenticación OAuth2"
[3]: https://developers.rently.com.ar/api/bookings-list-bookings-2 "Listar reservas"
[4]: https://developers.rently.com.ar/api/bookings-get-booking "Obtener reserva"
[5]: https://developers.rently.com.ar/api/bookings-get-drivers "Listar conductores"
[6]: https://developers.rently.com.ar/api/operations-deliveries "Listar entregas"
[7]: https://developers.rently.com.ar/api/operations-returns "Listar devoluciones"
[8]: https://developers.rently.com.ar/api/cars-create-relocation "Reubicar auto"
[9]: https://developers.rently.com.ar/api/bookings-reserve-booking "Reservar"
[10]: https://developers.rently.com.ar/api/bookings-save-booking "Crear reserva"
[11]: https://developers.rently.com.ar/api/bookings-payments-pay-booking "Pagar reserva"
[12]: https://developers.rently.com.ar/api/cars-get-car "Obtener auto"
[13]: https://developers.rently.com.ar/api/rently-api "OpenAPI: /api/configurations/documentTypes"
[14]: https://developers.rently.com.ar/api/customers-api-get-customer "Obtener cliente"
[15]: https://developers.rently.com.ar/api/rently-api "OpenAPI: /api/customers"
[16]: https://developers.rently.com.ar/errors-and-pagination "Errores y paginación"
[17]: https://developers.rently.com.ar/api/bookings-list-closed-bookings "Listar reservas cerradas"
[20]: ../server/syncRently.ts "Sincronización actual de PlanMint"
[21]: ../server/rentlyActions.ts "Acciones Rently actuales"
[22]: ../server/rentlyHub.ts "Proxy Rently Hub actual"
