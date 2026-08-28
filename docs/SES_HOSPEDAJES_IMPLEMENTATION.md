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

### `ses_official_communications`

Conserva evidencia oficial de forma aditiva por código de comunicación. La comprobación operativa se hace bajo demanda para la identidad exacta `referencia + tipo + fecha de contrato + matrícula normalizada`; una comunicación activa o aceptada bloquea el reenvío y una anulada, errónea o distinta exige revisión.

### `ses_eligibility_exceptions` (migración propuesta, no ejecutada)

Registra exclusivamente excepciones temporales para reservas terminadas y no comunicadas. Exige protocolo, justificación, actor, fecha de aprobación y caducidad máxima de siete días; puede revocarse y nunca omite las comprobaciones de matrícula, sucursal, transferencia, entrega, completitud o duplicados oficiales.

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
| `ready` | Está completo, pertenece a la intersección Rently–PlanMint y supera la comprobación oficial exacta |
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
* La candidatura exige aparecer en el listado paginado de Rently con `CurrentStatus=2`, `IsTransfer=false` y `DeliveryBranchOffice=1`, y coincidir con PlanMint por identificador de reserva y matrícula normalizada.
* La fecha real de entrega debe existir y no ser futura. El detalle contractual de Rently debe confirmar identificador, estado, sucursal, transferencia y matrícula.
* Las reservas terminadas no comunicadas quedan en revisión salvo una excepción temporal con protocolo vigente; esa excepción no convierte por sí sola el borrador en listo.
* Cada identidad contractual se consulta exactamente en el portal oficial. No se exige transcribir un inventario masivo.

## Flujo operativo

1. El operador abre la bandeja y selecciona un periodo.
2. PlanMint obtiene todas las páginas del listado Rently filtrado y calcula la intersección exacta con las reservas locales del periodo.
3. Solo las coincidencias por reserva y matrícula se preparan; las exclusiones actualizan borradores previos sin crear candidatos nuevos indiscriminadamente.
4. El operador corrige en línea, reutiliza datos por documento y puede aplicar valores a varias filas.
5. El operador registra por contrato el resultado de la consulta oficial exacta. Un resultado no encontrado solo vale mientras no cambien referencia, fecha o matrícula.
6. Solo los borradores `ready` con elegibilidad revalidada y conciliación oficial exacta pueden seleccionarse.
7. El servidor valida de nuevo, genera el XML, calcula hash y registra el lote.
8. El operador descarga y sube manualmente el XML al portal oficial.
9. El resultado se registra o concilia posteriormente; no existe envío automático en esta fase.

## Estructura XML

El generador conserva el orden de la plantilla oficial:

`peticion > solicitud única > comunicacion (1..n) > contrato > vehiculo > persona(TI) > persona(CP) > persona(CS opcional)`.

Las etiquetas opcionales vacías se omiten. El XML se escapa y valida antes de permitir la descarga.

## Precedencia del validador XML

Cuando no existe un XSD oficial auténtico y completo, el servidor aplica el contrato estructural local derivado de la plantilla oficial de alquiler de vehículo y de las Instrucciones v1.2.0. Este validador comprueba namespace, orden, cardinalidades, formatos, longitudes, enumeraciones y condiciones conocidas, pero nunca se presenta como “XSD oficial”.

Si se configura posteriormente un XSD auténtico con clave de almacenamiento, versión y SHA-256, este tiene precedencia estricta. Una configuración parcial o una huella que no coincida bloquea la exportación; no existe retorno silencioso al validador estructural.

## Paginación y contadores

La consulta devuelve `total` mediante conteo exacto y calcula el resumen de estados sobre todas las páginas filtradas. La interfaz muestra 50 filas por página y controles superiores e inferiores con rango visible, página actual y total; los contadores no se limitan a la página renderizada.
