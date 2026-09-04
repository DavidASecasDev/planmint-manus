# Incidencia crítica — Reservas Rently ausentes en PlanMint

**Fecha:** 4 de septiembre de 2026  
**Casos reportados:** 5494, 5496 y 5507  
**Estado:** datos recuperados; esquema corregido; protección fail-closed y Heartbeat implementados en checkpoint pendiente de publicación.

## Causa raíz confirmada

La integración Rently actualizada comenzó a escribir el campo `marca` en `public.reservations`, pero esa columna no existía todavía en el esquema de producción. A las **08:21:41 UTC**, PostgREST rechazó el upsert por lotes con `PGRST204` y el mensaje de que no encontraba `marca` en la caché del esquema.

El fallback individual recibió el mismo error para cada reserva. Sin embargo, el código solo escribió esos errores en consola: no los acumuló, no marcó el ciclo como fallido y permitió que el offset y el watermark avanzaran. El ciclo terminó como `completed` con cero inserciones. Por tanto, Rently sí entregó las reservas; PlanMint las descartó por una incompatibilidad de esquema y después dejó la ventana atrás.

## Alcance comprobado

La auditoría de solo lectura comparó todas las reservas que Rently devolvía desde la última reconciliación completa con los IDs existentes en PlanMint. El resultado fue:

| Métrica | Resultado |
|---|---:|
| Reservas Rently en la ventana | 84 |
| Ya presentes en PlanMint | 63 |
| Ausentes | 21 |
| Rango ausente | 5489–5509 |
| Recreaciones manuales inequívocas | 3 |

Las tres recreaciones manuales contenían de forma inequívoca las referencias 5494, 5496 y 5507. No se usaron cliente, teléfono, email, matrícula ni otros datos personales en los informes de diagnóstico.

## Reparación de datos

Se añadió la columna nullable `marca text` mediante la migración forward-only `20260904110500_reservations_brand_and_sync_safety.sql`. No se eliminó ni reescribió ninguna reserva existente.

Las tres recreaciones manuales se vincularon a sus IDs Rently reales dentro de una sola transacción con precondiciones. Se conservaron sus UUID originales y todas sus ediciones operativas. Después se rebobinó el watermark diez minutos antes de la última reconciliación completa para que el autosync recuperara la ventana completa.

Verificación posterior:

| Comprobación | Resultado |
|---|---:|
| Reservas 5489–5509 presentes | 21 |
| IDs Rently distintos | 21 |
| Registros con fecha de devolución | 21 |
| Identificadores manuales antiguos restantes | 0 |
| UUID original de 5494 preservado | Sí |
| UUID original de 5496 preservado | Sí |
| UUID original de 5507 preservado | Sí |

La sincronización publicada volvió a finalizar con `status=completed`, `error_message=null` y un watermark posterior a la recuperación.

## Corrección preventiva en código

`server/syncRently.ts` ahora acumula fallos de insert y update. Si una sola escritura no duplicada falla:

1. marca `rently_sync_status.status='error'`;
2. guarda un resumen sin PII;
3. avisa al propietario;
4. lanza error antes de sumar totales;
5. no avanza offset ni watermark.

El reintento es seguro: cualquier fila ya insertada queda protegida por la unicidad `(organization_id, external_reservation_id)` y el siguiente ciclo continúa desde la ventana no confirmada.

También se implementó `/api/scheduled/rently-reservations`, autenticado como Heartbeat y vinculado a la organización exclusivamente por `schedule_cron_task_uid`. El job continúa ciclos parciales automáticamente y elimina la dependencia de que un usuario mantenga PlanMint abierto. La columna e índice necesarios se aplicaron con `20260904112500_rently_reservation_sync_heartbeat.sql`.

## Pruebas

| Verificación | Resultado |
|---|---|
| Seguridad de escritura + Heartbeat + incremental + DTO | **13/13** aprobadas |
| Regresión dirigida Rently/Reservas/Programación/Vehículos/SES | **949/949** aprobadas en 79 archivos |
| Suite global | **1.549/1.550** aprobadas; único fallo externo preexistente: Xexun 401 |
| TypeScript | `pnpm check`: aprobado |
| Build | `pnpm build`: aprobado |
| Migración de marca | Aplicada correctamente |
| Migración Heartbeat | Aplicada correctamente |

## Pendiente operativo

El código preventivo y la ruta Heartbeat todavía requieren publicar el checkpoint. Después de publicar debe crearse el Heartbeat del proyecto y persistirse su `task_uid` en `rently_sync_status`. Hasta entonces, el esquema corregido ya permite que la sincronización publicada inserte reservas, pero los fallos futuros todavía solo quedarán completamente bloqueados y alertados cuando el nuevo checkpoint esté desplegado.
