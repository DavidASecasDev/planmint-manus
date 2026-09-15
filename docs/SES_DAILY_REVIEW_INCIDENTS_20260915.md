# SES.HOSPEDAJES — incidencias de revisión diaria del 15/09/2026

**Autor:** Manus AI  
**Alcance:** diagnóstico de producción en solo lectura y corrección exclusiva en preview. No se crearon lotes, no se modificaron expedientes, no se aplicó SQL y no se publicó.

## Evidencia de producción consultada en solo lectura

| Elemento | Valor observado |
|---|---|
| Lote histórico | `401e92af-c590-4968-bf44-8abf2a392605` |
| Periodo persistido | 08/09/2026–14/09/2026 |
| Estado/fase | `running` / `discover_deliveries` |
| Candidatas / procesadas | 103 / 103 |
| Cursor | `sourceIndex=1`, `offset=50` |
| Páginas / cobertura | `false` / `false` |
| Motivo | «La ventana temporal del listado estaba filtrada» |

El estado Rently vigente correspondía a un barrido `incremental`, con `unfilteredDateWindow=false`, indicadores de eventos incompletos y sin una fotografía utilizable del barrido completo anterior. Por tanto, la cobertura incompleta del lote es **real para los metadatos actualmente persistidos**; no procede relajarla ni declarar que 103 candidatas son el universo completo.

Para 5578, el ítem, la reserva local y el índice paginado conservaban `2026-09-09T17:56:39.05`. El ítem también conservaba `Delivery 5578.pdf — Rently reserva 5578, apartado Entrega` y `2026-09-09T17:56:39`, pero seguía `missing_delivery_evidence`. La causa no era pérdida del literal ni discrepancia temporal: ambos valores representan el mismo segundo visible.

## Causas confirmadas y correcciones

| Incidencia | Causa confirmada | Corrección en preview |
|---|---|---|
| Rango histórico | No existe un efecto de refetch que reinicialice el rango. El riesgo reproducible era que una automatización `fill` modificara el valor nativo visible sin consolidar todavía el estado React. | Los inputs consolidan `onInput`, `onChange` y `onBlur`; «Iniciar histórico» toma el valor DOM visible con fallback al estado React. Teclado+blur y fill+blur conservan y envían 09/09 después de un refresco sintético. |
| 100% con cobertura pendiente | El porcentaje era `processed_count / candidate_count`, aunque `pages_complete` y `coverage_complete` fueran falsos. Además, cada incremental sustituía `coverage_scope` y ocultaba la última cobertura full acreditada. | La UI separa «candidatas conocidas procesadas» de «cobertura global confirmada»: esta última es binaria, 0% o 100%. Un incremental conserva `lastFullCoverage`, pero nunca se convierte por ello en full. Solo se reutiliza una fotografía previa que siga acreditando endpoint oficial, todas las sedes/estados, offset cero, fin de paginación, ventana no filtrada y eventos completos. |
| 5578 no se revalidaba | Los reintentos acreditados se atendían únicamente al terminar las fuentes del cursor. Además, la consulta de reintento podía depender otra vez de la fotografía de la reserva y no superponer los literales ya preservados en el ítem. | La cola prioriza un caso recién acreditado antes de avanzar otra página, reutiliza entrega/devolución/estado persistidos en el ítem y mantiene upsert por `(batch_id, external_booking_id)`. El mismo segundo visible es válido aunque Rently conserve fracción; una diferencia de un segundo, minutos u otro día continúa como conflicto. |

La regla 5582 permanece intacta: `DeliveryInfo.Date=2026-09-09T23:05:19.643` determina el 09/09 aunque `FromDate` sea el 10/09. En un lote del día 10 queda excluida por pertenecer a otro periodo, no como contradicción ni evidencia ausente.

## Cambios de interfaz

El panel muestra el **ID exacto del lote** con acción de copia para enlazarlo con Azul Office. Si la cobertura no está acreditada, presenta 0% de cobertura global y un texto separado con `procesadas/conocidas`; ya no sugiere revisión completa. La fixture `/__fixtures/ses-daily-review` reproduce 103 candidatas conocidas, cobertura pendiente, 5578 y 5582 sin consultar Supabase ni servicios externos.

## Pruebas

| Verificación | Resultado |
|---|---|
| Regresión focal completa SES + preservación de Tareas | 181/181 pruebas aprobadas en 38 archivos. |
| TypeScript | `pnpm check` aprobado. |
| Build | `pnpm build` aprobado; solo avisos históricos de tamaño de chunks/Browserslist. |
| Suite global | 1.618/1.619 aprobadas; único fallo externo conocido: autenticación Xexun 401. |
| Visual | Escritorio 1280×760 y móvil 390×844 con datos exclusivamente sintéticos. |

## Pendientes reales

La fila de producción no contiene ya una fotografía de cobertura full recuperable: la corrección evita futuras pérdidas, pero no inventa ese metadato histórico. Tras publicar este código, hará falta ejecutar o esperar un **barrido full real** que agote páginas sin filtros de fecha prevista, sede ni estado; solo entonces la cobertura podrá pasar a 100%. El lote existente debe continuarse, no duplicarse. No se consultó ni presentó nada al portal oficial SES y no se marcó aceptación oficial.

