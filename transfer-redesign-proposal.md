# Propuesta de Rediseño — Módulo de Transfers

## Resumen ejecutivo

El módulo actual de transfers está construido alrededor de un flujo de **presupuestación y pricing** (zonas tarifarias, packs por horas, suplementos nocturnos, comisiones, generación de documentos PDF). La propuesta del usuario es simplificarlo radicalmente: eliminar toda la lógica de precios y convertirlo en un sistema de **solicitud → revisión → aceptación → ejecución**, donde el broker introduce la información operativa y Azul Cars confirma disponibilidad y asigna conductor.

---

## Estado actual del sistema

### Tablas en base de datos (Supabase)

| Tabla | Propósito actual |
|-------|-----------------|
| `transfer_requests` | Solicitud padre con broker, cliente, status, campos financieros (provider_cost, client_total, internal_margin, quote/invoice numbers) |
| `transfer_items` | Servicios individuales con rutas, horarios, precios (base_price, price_with_commission, estimated_price, zone, pack_duration) |
| `transfer_brokers` | Registro de brokers con user_id vinculado |
| `transfer_documents` | PDFs de presupuestos/facturas con parsing IA |
| `transfer_pricing` | Tarifario dinámico por zona/vehículo |
| `transfer_providers` | Proveedores externos (Limomallorca, etc.) |
| `transfer_item_vehicles` | Vehículos asignados por item |
| `transfer_invoice_settings` | Configuración de facturación |
| `transfer_change_history` | Historial de cambios |
| `transfer_status_history` | Historial de estados |
| `transfer_request_notes` | Notas internas |

### Flujo actual del broker (4 pasos)

1. **Tipo de cliente** — external_client o broker_client (con servicio asociado: villa/charter/yate)
2. **Tipo de servicio** — point_to_point o pack + selección de vehículo + zona + suplementos + cálculo de precio
3. **Detalles** — nombre cliente, referencia, items con rutas/horarios
4. **Resumen** — revisión con precio estimado y envío

### Flujo actual interno (Azul Cars)

Estados: `pendiente` → `en_gestion` → `presupuesto_enviado` → `confirmado` → `completado` / `cancelado`

El foco está en generar presupuestos, enviarlos al broker, esperar aceptación, y luego gestionar facturación.

---

## Propuesta de nuevo diseño

### Filosofía

> Sin precios. Sin presupuestos. Sin facturas. El broker solicita, Azul Cars acepta o rechaza, y asigna conductor. Simple.

### Nuevo flujo de estados

| Estado | Quién actúa | Descripción |
|--------|-------------|-------------|
| `pendiente` | — | Solicitud recién creada por el broker, esperando revisión |
| `aceptado` | Azul Cars | Azul Cars confirma disponibilidad y acepta el servicio |
| `conductor_asignado` | Azul Cars | Se asigna conductor + teléfono (visible para el broker) |
| `en_curso` | Conductor/Azul Cars | El transfer está en ejecución |
| `completado` | Azul Cars | Servicio finalizado |
| `rechazado` | Azul Cars | No hay disponibilidad o se rechaza por otro motivo |
| `cancelado` | Broker/Azul Cars | Cancelación por cualquiera de las partes |

### Nuevo modelo de datos

#### Tabla `transfer_requests` (modificada)

Se eliminan los campos financieros y se añaden los nuevos campos del cliente:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `organization_id` | uuid | Organización |
| `request_number` | text | Número secuencial auto-generado |
| `broker_id` | uuid | FK a transfer_brokers |
| `broker_name` | text | Nombre del broker (denormalizado) |
| `status` | text | Nuevo enum de estados |
| `client_type` | text | **`villa`** o **`charter`** (antes era external_client/broker_client) |
| `client_name` | text | Nombre del cliente |
| `client_phone` | text | **NUEVO** — Teléfono de contacto del cliente |
| `client_email` | text | **NUEVO** — Email del cliente (opcional) |
| `villa_name` | text | **NUEVO** — Nombre de la villa (si client_type = villa) |
| `boat_name` | text | **NUEVO** — Nombre del barco (si client_type = charter) |
| `berth_number` | text | **NUEVO** — Número de amarre (si client_type = charter) |
| `notes` | text | Notas generales |
| `rejection_reason` | text | **NUEVO** — Motivo de rechazo (si status = rechazado) |
| `created_by` | uuid | Usuario que creó |
| `accepted_by` | uuid | **NUEVO** — Usuario de Azul Cars que aceptó |
| `accepted_at` | timestamptz | **NUEVO** — Fecha de aceptación |
| `created_at` | timestamptz | Fecha creación |
| `updated_at` | timestamptz | Fecha actualización |

**Campos eliminados:** `provider_cost`, `client_total`, `internal_margin`, `quote_number`, `invoice_number`, `quote_generated_at`, `invoice_generated_at`, `service_type`, `associated_service`, `client_reference`, `is_external_provider`, `external_provider_name`, `archived_at`.

#### Tabla `transfer_items` (simplificada)

Cada item es un **movimiento independiente** (ida o vuelta), gestionable por separado:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `request_id` | uuid | FK a transfer_requests |
| `organization_id` | uuid | Organización |
| `linked_item_id` | uuid | **NUEVO** — FK a otro transfer_item (liga ida con vuelta) |
| `direction` | text | **NUEVO** — `ida` o `vuelta` |
| `position` | integer | Orden dentro de la solicitud |
| `transfer_date` | date | Fecha del servicio |
| `transfer_time` | time | **NUEVO** — Hora del servicio (simplificado, una sola hora) |
| `pickup_location` | text | Dirección de recogida |
| `pickup_lat` | numeric | **NUEVO** — Latitud recogida (Google Maps) |
| `pickup_lng` | numeric | **NUEVO** — Longitud recogida (Google Maps) |
| `pickup_place_id` | text | **NUEVO** — Google Maps Place ID para abrir en app |
| `dropoff_location` | text | Dirección de destino |
| `dropoff_lat` | numeric | **NUEVO** — Latitud destino |
| `dropoff_lng` | numeric | **NUEVO** — Longitud destino |
| `dropoff_place_id` | text | **NUEVO** — Google Maps Place ID |
| `vehicle_type` | text | `mercedes_vito` o `mercedes_v_class` |
| `pax_count` | integer | Número de pasajeros |
| `status` | text | `pendiente` / `aceptado` / `en_curso` / `completado` / `cancelado` |
| `driver_name` | text | Asignado por Azul Cars tras aceptar |
| `driver_phone` | text | Asignado por Azul Cars tras aceptar |
| `notes` | text | Notas del item |
| `created_at` | timestamptz | Fecha creación |

**Campos eliminados:** `pickup_enabled`, `dropoff_enabled`, `pickup_time`, `dropoff_time`, `has_return`, `return_pickup_*`, `return_dropoff_*`, `zone`, `zone_address`, `base_price`, `price_with_commission`, `price_manually_set`, `provider_cost`, `pack_duration`, `estimated_price`, `flight_number`, `driver_pending`.

**Cambio clave:** La ida y la vuelta ya no son campos dentro del mismo item. Son **dos items separados** ligados por `linked_item_id`, cada uno con su propio estado, conductor y gestión independiente.

### Tablas que se eliminan o quedan en desuso

| Tabla | Acción |
|-------|--------|
| `transfer_pricing` | **Eliminar** — Ya no hay cálculo de precios |
| `transfer_documents` | **Eliminar** — Ya no hay presupuestos/facturas |
| `transfer_invoice_settings` | **Eliminar** — Ya no hay facturación |
| `transfer_providers` | **Eliminar** — Ya no hay proveedores externos |
| `transfer_item_vehicles` | **Eliminar** — El vehículo se indica directamente en el item |
| `transfer_change_history` | **Mantener** — Trazabilidad |
| `transfer_status_history` | **Mantener** — Trazabilidad |
| `transfer_request_notes` | **Mantener** — Notas internas |
| `transfer_brokers` | **Mantener** — Registro de brokers |

---

## Portal del Broker — Nuevo formulario

### Formulario simplificado (1 sola página, sin wizard multi-paso)

El broker rellena un único formulario con las siguientes secciones:

**Sección 1 — Tipo de cliente**
- Toggle: **Villa** o **Charter**
- Si Villa: campo "Nombre de la villa"
- Si Charter: campos "Nombre del barco" + "Número de amarre"

**Sección 2 — Datos del cliente**
- Nombre del cliente (obligatorio)
- Teléfono de contacto (obligatorio)
- Email (opcional)

**Sección 3 — Detalles del transfer**
- Fecha (obligatorio)
- Hora (obligatorio)
- Punto de recogida — Input con autocompletado Google Maps (se guarda dirección + coordenadas + place_id)
- Punto de destino — Input con autocompletado Google Maps
- Vehículo: **Mercedes Vito** o **Mercedes V-Class** (selector)
- Número de pasajeros

**Sección 4 — Vuelta (opcional)**
- Toggle "Crear servicio de vuelta"
- Si se activa: Fecha vuelta, Hora vuelta, Punto de recogida vuelta (pre-relleno con el destino de la ida), Punto de destino vuelta (pre-relleno con la recogida de la ida)
- Ambos servicios quedan ligados pero son movimientos independientes

**Sección 5 — Notas**
- Campo de texto libre para instrucciones adicionales

### Resultado al enviar

Se crean:
- 1 `transfer_request` con status `pendiente`
- 1 `transfer_item` (ida) con direction `ida`
- 1 `transfer_item` (vuelta, opcional) con direction `vuelta` y `linked_item_id` apuntando al de ida

---

## Panel interno Azul Cars — Nuevo flujo

### Vista de listado

Se mantienen las vistas actuales (lista, kanban, calendario) pero con los **nuevos estados**. El kanban tendrá columnas: Pendiente | Aceptado | Conductor Asignado | En Curso | Completado.

### Vista de detalle / Revisión

Cuando llega una solicitud nueva (`pendiente`), Azul Cars ve:
- Información del broker y del cliente
- Tipo (villa/charter) con datos específicos
- Cada item con fecha, hora, ruta (mini-mapa), vehículo solicitado
- Botones: **Aceptar** o **Rechazar** (con motivo obligatorio)

### Asignación de conductor

Tras aceptar, aparece un formulario para cada item:
- Nombre del conductor
- Teléfono del conductor

Una vez asignado, el estado pasa a `conductor_asignado` y el broker puede ver esta información en su portal.

### Visibilidad para el broker

El broker ve en su portal:
- Estado actual de cada solicitud
- Cuando está aceptada: nombre y teléfono del conductor asignado
- Botón para abrir la ubicación en Google Maps (usando el place_id guardado)

---

## Archivos a modificar / eliminar

### Archivos que se eliminan completamente

| Archivo | Motivo |
|---------|--------|
| `client/src/lib/transferPricing.ts` | Ya no hay pricing |
| `client/src/lib/transferPricing.test.ts` | Test del pricing |
| `client/src/lib/pricingEngine.ts` (si existe) | Motor de precios |
| `client/src/lib/nightHoursCalculator.ts` (si existe) | Suplementos nocturnos |
| `client/src/utils/transferCalculations.ts` | Cálculos financieros |
| `client/src/utils/transferCalculations.test.ts` | Tests |
| `client/src/utils/exportTransfersCsv.ts` | Export CSV (se rehará si necesario) |
| `client/src/components/transfers/TransferFinancialSummary.tsx` | Resumen financiero |
| `client/src/components/transfers/TransferQuoteActions.tsx` | Acciones de presupuesto |
| `client/src/components/transfers/TransferInvoiceSettings.tsx` | Facturación |
| `client/src/components/transfers/TransferDocumentsSection.tsx` | Documentos |
| `client/src/components/transfers/TransferAutoMovements.tsx` | Movimientos automáticos |
| `client/src/components/transfers/TransferMovementReview.tsx` | Revisión movimientos |
| `client/src/hooks/useTransferInvoiceSettings.ts` | Hook facturación |
| `client/src/hooks/useTransferDocuments.ts` | Hook documentos |
| `client/src/hooks/useTransferQuotePdf.ts` | Hook PDF presupuesto |
| `client/src/hooks/useTransferItemVehicles.ts` | Hook vehículos por item |
| `client/src/hooks/useTransferProviders.ts` | Hook proveedores |
| `client/src/hooks/useTransferReports.ts` | Hook reportes financieros |
| `client/src/pages/transfers/TransferPricing.tsx` | Página de tarifas |
| `client/src/pages/transfers/InternalNewTransferWizard.tsx` | Wizard interno (se rehace) |
| `client/src/pages/transfers/InternalEditTransferWizard.tsx` | Wizard edición (se rehace) |
| `client/src/pages/PublicTransferForm.tsx` | Formulario público |
| `client/src/components/reports/TransferReportsCharts.tsx` | Gráficos reportes |
| `client/src/components/reports/TransferReportsTable.tsx` | Tabla reportes |
| `server/parseTransferDocument.ts` | Parsing IA de documentos |
| `server/createMovementsFromTransfer.ts` | Creación de movimientos |
| `server/transferRouteEstimateEndpoint.ts` | Estimación de rutas |
| `server/transferAutomationEndpoint.ts` | Automatización |
| `scripts/seed-transfer-pricing.sql` | Seed de tarifas |

### Archivos que se reescriben desde cero

| Archivo | Nuevo propósito |
|---------|----------------|
| `client/src/types/transfers.ts` | Nuevos tipos simplificados |
| `client/src/pages/broker/BrokerNewRequest.tsx` | Nuevo formulario simplificado |
| `client/src/pages/broker/BrokerEditRequest.tsx` | Edición (solo si status = pendiente) |
| `client/src/pages/broker/BrokerRequestDetail.tsx` | Detalle con info de conductor |
| `client/src/pages/transfers/Transfers.tsx` | Listado con nuevos estados |
| `client/src/pages/transfers/TransferDetail.tsx` | Detalle + aceptar/rechazar + asignar conductor |
| `client/src/hooks/useBrokerRequests.ts` | Nuevo payload simplificado |
| `client/src/hooks/useTransferRequests.ts` | Adaptado a nuevos campos |
| `client/src/hooks/useTransferItems.ts` | Adaptado a nuevo modelo |
| `client/src/components/broker/TransferItemFormCard.tsx` | Nuevo card simplificado |
| `client/src/components/transfers/TransferRequestCard.tsx` | Card con nuevos estados |
| `client/src/components/transfers/TransferStatusBadge.tsx` | Nuevos badges |
| `client/src/components/transfers/TransfersKanban.tsx` | Nuevas columnas |
| `client/src/components/transfers/TransfersCalendar.tsx` | Adaptado |
| `client/src/components/transfers/TransferFilters.tsx` | Filtros simplificados |

### Archivos que se mantienen sin cambios

- `client/src/hooks/useTransferBrokers.ts` — Gestión de brokers
- `client/src/hooks/useTransferChangeHistory.ts` — Historial de cambios
- `client/src/hooks/useTransferStatusHistory.ts` — Historial de estados
- `client/src/hooks/useTransferNotes.ts` — Notas internas
- `client/src/components/transfers/TransferNotesSection.tsx` — UI de notas
- `client/src/components/transfers/TransferSettingsSection.tsx` — Ajustes generales

---

## Migración de datos

La migración de datos existentes requiere:

1. **Añadir nuevas columnas** a `transfer_requests`: `client_phone`, `client_email`, `villa_name`, `boat_name`, `berth_number`, `rejection_reason`, `accepted_by`, `accepted_at`.
2. **Añadir nuevas columnas** a `transfer_items`: `linked_item_id`, `direction`, `transfer_time`, `pickup_lat`, `pickup_lng`, `pickup_place_id`, `dropoff_lat`, `dropoff_lng`, `dropoff_place_id`.
3. **Mapear client_type**: `external_client` → `villa`, `broker_client` → `charter` (o decidir manualmente).
4. **Mapear status**: `en_gestion` → `pendiente`, `presupuesto_enviado` → `pendiente`, `confirmado` → `aceptado`.
5. **Separar ida/vuelta**: Los items con `has_return = true` se dividen en dos items separados con `linked_item_id`.
6. Las columnas financieras antiguas se pueden dejar como nullable/deprecated sin eliminarlas inmediatamente para no perder datos históricos.

---

## Preguntas pendientes antes de implementar

1. **¿Se eliminan los datos históricos de pricing/facturación?** O se mantienen las columnas antiguas como deprecated para consulta.
2. **¿El broker puede cancelar una solicitud ya aceptada?** O solo Azul Cars puede cancelar tras aceptar.
3. **¿Se mantiene la vista de reportes financieros?** Si ya no hay precios, ¿qué métricas se quieren ver?
4. **¿El formulario interno de Azul Cars para crear transfers sigue existiendo?** O solo los brokers crean solicitudes.
5. **¿Se mantiene la funcionalidad de "Clonar" solicitudes?**
6. **¿El campo `flight_number` se elimina por completo?** O se mantiene como opcional para casos de aeropuerto.

---

## Estimación de esfuerzo

| Fase | Descripción | Complejidad |
|------|-------------|-------------|
| 1 | Migración de esquema DB (nuevas columnas, mapeo datos) | Media |
| 2 | Nuevos tipos TypeScript + hooks | Baja |
| 3 | Nuevo formulario broker (1 página con Google Maps) | Alta |
| 4 | Nuevo detalle broker (ver conductor, abrir Maps) | Media |
| 5 | Nuevo detalle interno (aceptar/rechazar/asignar) | Alta |
| 6 | Adaptar listado/kanban/calendario a nuevos estados | Media |
| 7 | Eliminar código muerto (pricing, documentos, etc.) | Baja |
| 8 | Tests y validación | Media |

---

## Siguiente paso

Una vez aprobada esta propuesta (con las respuestas a las preguntas pendientes), procederé a implementar el rediseño completo en el orden indicado.
