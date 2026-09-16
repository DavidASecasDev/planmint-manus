# SES.HOSPEDAJES — cancelaciones Rently (incidencia 5592)

**Estado:** diagnóstico confirmado; corrección en preview.  
**Restricciones:** sin cambios en producción, Rently, comunicaciones oficiales ni otros módulos.

## Evidencia de producción de solo lectura

La reserva 5592 existe en `reservations` con `estado=Cancelada`, `rently_status_code=4` y sin entrega ni devolución real. Su borrador SES `c284407c-9801-46f2-ac70-6d46c6489251` existe como `incomplete`, `is_eligible=true`, `ready_for_xml=false`, once validaciones pendientes y sin lote, item de lote ni comunicación oficial asociada. No tiene campos manuales marcados.

## Causa confirmada

La sincronización canónica sí persiste correctamente `CurrentStatus=4`, las fechas reales y la reactivación. El fallo está en la proyección SES: `handleSesSyncDrafts` recorre todas las reservas y deriva el estado solo de `validateSesDraft`, fijando `is_eligible=true`; no consulta el estado Rently ni la ausencia de entrega. El listado vuelve a derivar `incomplete` únicamente desde las validaciones. La exportación XML vuelve a validar campos, pero no ejecuta una regla independiente de cancelación. La revisión diaria clasifica por evidencia de entrega, pero tampoco distingue `status=4` sin entrega.

La política de importación Rently permite que una reserva ya existente cambie a cancelada y se reactive después. Por tanto, filtrar altas nuevas o aplicar `status!=4` solo en la UI no corrige expedientes existentes ni cubre reactivaciones.

## Verificación visual sintética

La fixture `/__fixtures/ses-hospedajes` muestra 5592 como **«Cancelada · no aplicable»**, sin contador de faltantes ni botón «Completar» y con acceso a «Ver historial». Una segunda cancelación sintética con comunicación previa se muestra como **«Cancelada · revisar»** y conserva su acceso histórico. Los checkboxes XML están deshabilitados en ambos casos. La vista se comprobó a 1280×800 y 390×844 sin consultar datos reales; en móvil la tabla mantiene la referencia y la acción accesibles mediante su diseño responsive existente.

## Pruebas funcionales

La matriz SES aprobó **188/188 pruebas en 40 archivos**, TypeScript y el build. Las pruebas funcionales ejecutan clasificación 5592, cancelación posterior a la importación, conservación manual, repetición idempotente, entrega real, comunicación oficial previa, reactivación, estado desconocido, contador diario y preflight XML con un contador de efectos que permanece en cero cuando existe un bloqueo.

El handler Express completo no se ejecuta contra una base aislada porque combina autenticación, Supabase y generación de lotes; esa cobertura end-to-end requeriría levantar un servidor y una copia de base equivalente. Para reducir el hueco, el guard XML que usa el handler se extrajo a una función pura y se prueba funcionalmente antes de efectos. Una prueba estática auxiliar verifica únicamente que el handler invoca ese guard antes de generar XML; no se presenta como demostración conductual.

La suite SES completa aprobó **188/188 pruebas en 40 archivos**. `pnpm check` y `pnpm build` finalizaron correctamente; permanecen únicamente los avisos históricos de tamaño de chunks y Browserslist. La suite global aprobó **1.644/1.645 pruebas**; el único fallo fue la autenticación externa Xexun con HTTP 401, ajena a SES y no modificada.

## Reconciliación prevista

No se propone migración ni backfill SQL. Tras revisar y publicar el checkpoint, «Sincronizar Rently» recorrerá los borradores existentes de forma idempotente: 5592 conservará su expediente e historial, pasará a no elegible/no listo y la UI la proyectará como cancelada no aplicable. La clasificación solo incrementa versión y auditoría cuando cambia. Una reserva reactivada vuelve al flujo normal en la siguiente sincronización. No se envían anulaciones ni comunicaciones oficiales.
