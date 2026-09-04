# Reparación integral de matrículas — horizonte reciente y futuro

**Fecha:** 4 de septiembre de 2026  
**Estado:** reparación aplicada y estable después de un autosync desplegado.

## Alcance

Se revisaron todas las reservas no archivadas con identificador externo y operación desde el 4 de septiembre de 2026 hasta el último registro futuro disponible, el 22 de julio de 2027.

| Métrica del dry-run | Resultado |
|---|---:|
| Registros inspeccionados | 416 |
| Reservas Rently ya correctas | 50 |
| Matrículas vacías recuperables | 292 |
| Aliases `CurrentPlate` reemplazables | 68 |
| Filas manuales excluidas | 6 |
| Valores manuales preservados | 0 afectados |
| Casos Rently sin resolver | 0 |

La reparación obtuvo `Car.Id` directamente del detalle de Rently para cada contrato. No dedujo matrículas a partir de modelo, marca ni flota. Solo actualizó `reservations.auto` cuando estaba vacío o coincidía exactamente con un alias oficial `CurrentPlate`; cualquier otro valor habría quedado preservado.

## Resultado aplicado

Se actualizaron y verificaron **360 matrículas**: 292 campos vacíos y 68 aliases operativos. Las seis filas manuales quedaron fuera del proceso. La escritura usó precondiciones por UUID y valor anterior, backup previo y rollback automático ante cualquier discrepancia.

## Verificación posterior al despliegue

Una consulta independiente posterior confirmó:

| Métrica | Resultado |
|---|---:|
| Reservas futuras totales | 416 |
| Filas manuales | 6 |
| Reservas Rently | 410 |
| Reservas Rently con Auto vacío | **0** |

Después de la reparación se completó un autosync incremental desplegado a las 13:17:45 UTC con `status=completed`, `error_message=null` y watermark actualizado. La segunda verificación mantuvo **0 matrículas vacías**, demostrando que el parche publicado ya no vuelve a borrarlas.
