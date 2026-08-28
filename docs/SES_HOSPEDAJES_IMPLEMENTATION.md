# SES.HOSPEDAJES — Diseño de implementación

## Alcance de la primera versión

La primera versión prepara comunicaciones de **alquiler de vehículos**, reutiliza datos de Rently y PlanMint, permite completar faltantes mediante edición asistida y genera un XML compatible con la plantilla oficial aportada. No inicia sesión, no automatiza el navegador y no envía comunicaciones al Ministerio.

## Alternativas consideradas

| Enfoque | Ventajas | Coste operativo | Complejidad |
|---|---|---:|---:|
| Exportación XML asistida | Control humano, validación previa, sin credenciales gubernamentales | Una subida manual por lote | Media |
| Servicio web oficial | Envío y acuse automáticos | Mínimo tras la configuración | Alta; requiere WSDL y credenciales oficiales |

La primera versión implementa la exportación XML asistida. El núcleo de datos queda preparado para incorporar el servicio web sin rehacer la bandeja ni las validaciones.

## Principios de seguridad

1. Todas las lecturas y escrituras pasan por endpoints Express autenticados.
2. Las tablas SES tienen RLS activado y no se consultan directamente con la anon key.
3. El acceso se controla con `ses_hospedajes.view`, `ses_hospedajes.edit`, `ses_hospedajes.export` y `ses_hospedajes.manage_settings`.
4. Solo owner/admin reciben permisos por defecto; otros usuarios requieren autorización explícita.
5. No se almacenan números completos de tarjeta ni códigos de seguridad.
6. La auditoría registra campos modificados, usuario y fecha, evitando duplicar PII en históricos.
7. Ninguna acción realiza envíos al Gobierno en esta versión.

## Modelo de datos

### `ses_person_profiles`

Perfil reutilizable por organización, tipo y número de documento. Conserva nombre desglosado, nacimiento, nacionalidad, sexo, domicilio, contacto y permiso de conducir. Cada campo importado mantiene `source` y `source_updated_at`; la edición humana prevalece sobre Rently.

### `ses_locations`

Maestro reutilizable de lugares de recogida y devolución. Se vincula opcionalmente a `rently_place_id` y guarda dirección estructurada, código INE, país y código oficial de establecimiento. Para cada operación se usa **dirección o código de establecimiento**, no ambos.

### `ses_contract_drafts`

Borrador de una comunicación asociado a una reserva. Guarda referencias a titular, conductor principal/secundario y lugares, además de contrato, pago, vehículo, lista de errores, estado y huella del contenido. Los valores específicos de la comunicación quedan congelados al incluirse en un lote.

### `ses_batches` y `ses_batch_items`

Representan un lote XML y sus comunicaciones. El lote guarda nombre de fichero, hash SHA-256, versión de esquema, recuentos y estado. Los items enlazan cada borrador y registran aceptación/error cuando el operador concilie el resultado del portal.

### `ses_audit_events`

Registra entidad, acción, campos modificados, usuario y fecha. No almacena documentos completos ni valores anteriores en claro.

### `ses_municipalities`

Catálogo oficial de municipios españoles con código INE de cinco dígitos. La resolución automática utiliza país, provincia/estado, municipio y código postal; las coincidencias ambiguas quedan pendientes de revisión.

## Precedencia de datos

1. Corrección manual validada en el perfil SES.
2. Dato ya guardado y validado en el perfil reutilizable.
3. Endpoint de detalle de cliente/reserva de Rently.
4. Datos sincronizados en `reservations`.
5. Campo vacío pendiente de completar.

Una sincronización nunca sustituye un dato marcado como manual.

## Datos recuperables de Rently

| Campo | Ruta | Cobertura observada |
|---|---|---:|
| Nacimiento | `Customer.BirthDate` | 27/39 |
| País de domicilio | `Customer.Country` | 37/39 |
| Dirección | `Customer.Address` | 36/39 |
| Número, ciudad, provincia y CP | Campos estructurados de `Customer` | 27/39 |
| Número de permiso | `Customer.DriverLicenceNumber` | 37/39 |
| País del permiso | `Customer.DriverLicenceCountry` | 28/39 |
| Caducidad del permiso | `Customer.DriverLicenseExpiration` | 35/39 |
| Tipo de documento | `Customer.DocumentTypeId` | 39/39 |

Rently no aportó nacionalidad, sexo, categoría del permiso, código INE ni método de pago en la muestra auditada. Esos campos se completan una sola vez y se reutilizan.

## Estados del borrador

| Estado | Significado |
|---|---|
| `pending_sync` | Falta recuperar el detalle completo de Rently |
| `incomplete` | Falta un dato obligatorio o hay una validación pendiente |
| `ready` | Supera todas las validaciones locales |
| `batched` | Incluido en un lote XML |
| `uploaded_pending_result` | El operador subió el fichero y aún no registró el resultado |
| `accepted` | Comunicación aceptada |
| `error` | El portal devolvió un error |
| `needs_revision` | Estado único de revisión: existe una discrepancia de elegibilidad o evidencia oficial que exige intervención antes de continuar |

## Validaciones principales

* Deben existir titular (`TI`) y conductor principal (`CP`).
* El conductor secundario (`CS`) es opcional.
* Se exige tipo/número de documento y domicilio; nacimiento, nacionalidad y sexo son opcionales según la guía oficial, pero se incluyen cuando Rently o el operador los aportan.
* Para país `ESP`, se exige código INE y no se emite nombre de municipio.
* Para otros países, se exige nombre de municipio y no se emite código INE.
* Se exige tipo, validez y número del permiso para conductores.
* El pago usa uno de `DESTI`, `EFECT`, `TARJT`, `PLATF`, `TRANS`, `MOVIL`, `TREG` u `OTRO`.
* El vehículo exige categoría, tipo, marca, modelo, matrícula, bastidor, color y kilómetros de recogida. Los kilómetros de devolución y datos GPS son opcionales.
* Las fechas se serializan con zona `Europe/Madrid`.
* La huella del contenido impide generar accidentalmente el mismo borrador dos veces.

## Flujo operativo

1. El operador abre la bandeja y selecciona un periodo.
2. PlanMint prepara o actualiza borradores desde Rently sin sobrescribir correcciones manuales.
3. La bandeja muestra únicamente faltantes y errores.
4. El operador corrige en línea, reutiliza datos por documento y puede aplicar valores a varias filas.
5. Solo los borradores `ready` con elegibilidad revalidada e inventario oficial confirmado pueden seleccionarse.
6. El servidor valida de nuevo, genera el XML, calcula hash y registra el lote.
7. El operador descarga y sube manualmente el XML al portal oficial.
8. El resultado se registra o concilia posteriormente; no existe envío automático en esta fase.

## Estructura XML

El generador conserva el orden de la plantilla oficial:

`peticion > solicitud > comunicacion > contrato > vehiculo > persona(TI) > persona(CP) > persona(CS opcional)`.

Las etiquetas opcionales vacías se omiten. El XML se escapa y valida antes de permitir la descarga.
