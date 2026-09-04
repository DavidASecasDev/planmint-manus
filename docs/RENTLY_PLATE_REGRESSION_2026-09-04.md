# Regresión crítica — Matrículas ausentes en Programación

**Fecha:** 4 de septiembre de 2026  
**Estado:** datos del día reparados; corrección preventiva preparada; checkpoint pendiente de publicación.

## Causa raíz

La regresión fue introducida al interpretar `Car.Id` como un identificador interno y priorizar `CurrentPlate.Id`. La respuesta real de Rently para Azul Cars demuestra lo contrario:

| Campo Rently | Ejemplo real sanitizado | Semántica observada |
|---|---|---|
| `Car.Id` | `1892MSD` | Matrícula legal que debe mostrarse en Auto |
| `Car.CurrentPlate.Id` | `MINI1-9` | Alias operativo interno |

En reservas recientes, `CurrentPlate` puede no venir expandido. Al excluir `Car.Id`, el adaptador escribió `auto=null`; cuando sí venía expandido, escribió el alias operativo. Programación renderiza directamente `reservations.auto`, por lo que mostró guiones o aliases en lugar de matrículas.

## Alcance y reparación

La auditoría inicial del 4 de septiembre detectó 45 reservas con operación ese día:

| Métrica inicial | Resultado |
|---|---:|
| Auto vacío | 35 |
| Matrícula legal reconocible | 2 |
| Alias operativo | 8 |

Se consultó el detalle de Rently de las 45 reservas sin extraer datos personales. Rently devolvió una matrícula legal para las 45. Un dry-run con precondiciones detectó 43 cambios seguros: 34 campos vacíos y 9 aliases. La reparación actualizó únicamente `reservations.auto`; no modificó horarios, ubicaciones, asignaciones, estados, clientes ni ningún otro campo.

La verificación inmediata confirmó 45/45 con Auto. Antes de publicar el parche, el autosync todavía desplegado volvió a vaciar tres filas, lo que confirmó experimentalmente la causa. Esas filas deben repararse de nuevo justo antes de la entrega y publicar inmediatamente el checkpoint para que no reaparezca.

## Corrección preventiva

`resolveRentlyCarPlate` ahora sigue esta prioridad:

1. `Car.Id` cuando es string no vacío: matrícula legal del tenant.
2. `CurrentPlate.Id`, `CurrentPlateId` o `Plate` solo como aliases de compatibilidad.
3. Los IDs numéricos se rechazan como opacos.

El mismo criterio se aplica en el DTO ligero, detalle y resolver de SES.HOSPEDAJES. Además, `removeEmptyRentlyEnrichmentFields` protege `auto`, `modelo` y `marca`: una respuesta resumida vacía nunca vuelve a borrar un valor válido guardado.

## Pruebas

| Verificación | Resultado |
|---|---|
| Pruebas críticas de matrícula y protección | **17/17** aprobadas |
| Pruebas relacionadas con Auto/flota/SES | **130/130** aprobadas |
| Regresión dirigida Rently/Programación/Reservas/Vehículos/SES | **1.031/1.031** aprobadas en 96 archivos |
| Suite global | **1.551/1.552** aprobadas; único fallo externo preexistente: Xexun 401 |
| TypeScript | Aprobado |
| Build | Aprobado |

## Restricción operativa

Hasta publicar este checkpoint, la versión anterior del autosync continúa activa cada cinco minutos en los navegadores abiertos y puede volver a escribir el valor incorrecto. La publicación es necesaria para estabilizar definitivamente las matrículas. Después debe ejecutarse una sincronización y comprobar el agregado del día antes de cerrar la incidencia.
