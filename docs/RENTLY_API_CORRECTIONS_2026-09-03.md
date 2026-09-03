# Correcciones de la integración oficial de Rently

**Autor:** Manus AI  
**Fecha:** 3 de septiembre de 2026  
**Estado:** código implementado y migración aditiva aplicada; **sin publicar ni ejecutar una resincronización real**.

## Resultado

Se aplicaron las correcciones P0, P1 y P2 derivadas de la documentación y el OpenAPI oficiales de Rently. La integración utiliza ahora un cliente OAuth compartido, contratos de escritura oficiales, DTOs canónicos para lista y detalle, catálogos del tenant y una sincronización híbrida con reconciliación completa diaria.[1] [2] [3]

| Área | Corrección |
|---|---|
| Seguridad | El explorador HTTP arbitrario queda deshabilitado y Rently Hub solo expone operaciones de lectura explícitas. |
| Auditoría | Las acciones dejan de persistir cuerpos; no se guardan documentos, contacto, pagos ni respuestas sensibles. |
| OAuth | Las cinco implementaciones duplicadas se sustituyeron por una caché compartida por tenant y credencial, con expiración y un único reintento ante 401. |
| Errores | Se interpretan `ErrorMessage`, `ErrorCode` e `Id` y se devuelve una forma segura y útil para soporte. |
| Reservas | Confirmar usa `/api/booking/reserve`; crear usa `/api/booking/book`; pagar usa `/api/booking/pay`. |
| Vehículos | El detalle usa `/api/cars/{id}` y la matrícula procede de `CurrentPlate.Id`/`CurrentPlateId`; nunca de `Car.Id`. |
| Cliente | Se admiten `Name`, `Lastname`, `DocumentType`, `Birthday` y aliases históricos controlados. |
| Vehículo | Se normalizan marca, modelo, categoría, `Gasoline`, `FuelType` y `CurrentStatusDate`. |
| Pagos | El formulario carga `/api/configurations/gateways` y envía `BookingId`, `GatewayId` y `Amount` sin wrapper. |
| Documentos | La sincronización carga `/api/configurations/documentTypes`; el mapa histórico queda solo como fallback si el catálogo no responde. |
| SES | `Customer.Country` se guarda como nacionalidad, no como país de residencia inventado. |
| Sincronización | `updatedSince` usa 10 minutos de solapamiento; cada 24 horas se fuerza un recorrido completo para recuperar legados sin `UpdatedOn`. |

## Escrituras oficiales

| Acción | Ruta | Validación local |
|---|---|---|
| Confirmar | `POST /api/booking/reserve` | `BookingId` y `Lastname` obligatorios. |
| Cancelar | `POST /api/booking/cancel` | `BookingId` y `Lastname` obligatorios. |
| Crear | `POST /api/booking/book` | Fechas y categoría obligatorias; `Notes` se normaliza a `Extra`. |
| Pagar | `POST /api/booking/pay` | `BookingId`, `GatewayId` y `Amount >= 0.01`. |

Tras una escritura correcta se mantiene la sincronización inmediata de la reserva afectada. Una entrada inválida se rechaza antes de llamar a Rently.

## Adaptador canónico

El DTO ligero y el detalle se modelan con aliases explícitos. La matrícula prioriza `CurrentPlate.Id`, después `CurrentPlateId` y solo como compatibilidad `Plate`. `Car.Id` queda excluido de esa decisión. Marca, modelo y categoría pueden llegar en la raíz del DTO ligero o en el modelo del detalle, y el adaptador usa la forma oficial antes de los aliases históricos.[2]

Las fechas confirmadas y ubicaciones manuales conservan las protecciones existentes. Los valores vacíos de Rently tampoco borran datos enriquecidos válidos. Esta regresión se verificó en Programación, Reservas, Vehículos y SES.HOSPEDAJES.

## Sincronización incremental

Se añadió `watermark_updated_at`, `last_full_sync_at` y `sync_mode` a `rently_sync_status`. La migración `20260903111500_rently_incremental_sync_watermark.sql` se aplicó correctamente al proyecto Supabase de PlanMint. SHA-256: `f67b334e719589a63c640fb44006f8854c5586f04b5f5297044cc897e19e9941`.[3]

La sincronización incremental resta diez minutos al watermark para evitar pérdidas por bordes temporales. El watermark solo avanza cuando finalizan todas las páginas. Al menos cada 24 horas se ejecuta modo completo, que incluye reservas antiguas aunque no tengan `UpdatedOn`.

## Pruebas

| Verificación | Resultado |
|---|---|
| Regresión dirigida Rently/Reservas/Programación/Vehículos/SES | **359/359** pruebas aprobadas en 58 archivos. |
| Pruebas nuevas focales | Cliente OAuth, escrituras, DTO canónico, Hub seguro e incremental: **16/16**. |
| TypeScript | `pnpm check`: aprobado, 0 errores. |
| Build local | `pnpm build`: aprobado. Solo permanecen avisos preexistentes de chunks grandes. |
| Suite global | **1.541/1.542** aprobadas; único fallo externo preexistente: Xexun devuelve 401. |
| Rutas obsoletas | Búsqueda productiva: 0 coincidencias para `/booking/confirm`, `/booking/payment` y `/api/car/`. |
| OAuth duplicado | Solo `server/rentlyClient.ts` contiene `client_credentials`. |
| Diff | `git diff --check`: aprobado. |

## Límites

No se publicó el checkpoint y no se ejecutó ninguna llamada de escritura ni sincronización real contra Rently durante las pruebas. La migración solo añade columnas y una restricción al estado de sincronización; no modifica reservas.

Cuando se publique, la primera sincronización será completa porque `last_full_sync_at` está vacío. Después alternará incrementales y una reconciliación completa diaria. Conviene observar ese primer ciclo y revisar agregados de matrículas, marcas y estados antes de considerar terminado cualquier backfill.

## References

[1]: https://developers.rently.com.ar/authentication "Autenticación OAuth2 de Rently"
[2]: https://developers.rently.com.ar/api-overview "API Overview y OpenAPI de Rently"
[3]: ../supabase/migrations/20260903111500_rently_incremental_sync_watermark.sql "Migración incremental de PlanMint"
