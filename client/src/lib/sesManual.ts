export type SesManualStep = {
  number: number;
  title: string;
  action: string;
  result: string;
  warning?: string;
};

export type SesManualStatus = {
  status: string;
  meaning: string;
  nextAction: string;
  tone: 'slate' | 'amber' | 'emerald' | 'blue' | 'red' | 'orange';
};

export const SES_MANUAL_STEPS: SesManualStep[] = [
  {
    number: 1,
    title: 'Configura los datos oficiales',
    action: 'Abre “Configuración” y comprueba el código de arrendador. En “Control oficial” verás si se usa la plantilla y las Instrucciones v1.2.0 o un XSD oficial auténtico cargado posteriormente.',
    result: 'Sin XSD publicado, PlanMint aplica el contrato estructural oficial local. Si se carga en el futuro un XSD auténtico, este prevalece por versión y huella.',
    warning: 'No introduzcas aquí usuario, contraseña, Cl@ve ni credenciales del portal oficial.',
  },
  {
    number: 2,
    title: 'Selecciona el periodo y prepara',
    action: 'Indica un rango máximo de 93 días y pulsa “Preparar reservas”. Se cruza el listado paginado de Rently con CurrentStatus=2, IsTransfer=false y DeliveryBranchOffice=1 contra PlanMint por reserva y matrícula.',
    result: 'Solo la intersección exacta entra como candidata. Una entrega futura, matrícula distinta, transferencia, otra sucursal o detalle ausente queda excluida.',
    warning: '“Actualizar” solo recarga la pantalla. “Revalidar Rently” vuelve a consultar la lista exacta y el detalle. Una terminada no comunicada solo admite una excepción temporal con protocolo.',
  },
  {
    number: 3,
    title: 'Revisa la bandeja',
    action: 'Usa los contadores del filtro completo, la paginación superior e inferior, la búsqueda exacta por reserva o matrícula, las fechas y el estado para localizar excepciones.',
    result: 'Cada página muestra su rango y el total filtrado; puedes recorrer más de 200 contratos sin perder filas ni alterar los contadores globales.',
  },
  {
    number: 4,
    title: 'Completa únicamente los faltantes',
    action: 'Abre una reserva y revisa las pestañas Contrato, Personas y Lugares. PlanMint señala los campos obligatorios pendientes; al guardarlos manualmente quedan protegidos frente a futuras sincronizaciones de Rently.',
    result: 'Cuando esté completo y sea elegible, pulsa “Comprobar” y registra el resultado exacto del portal para esa referencia, fecha y matrícula.',
    warning: 'No inventes datos legales. Si Rently no ofrece pago, categoría del permiso, domicilio o municipio fiable, confírmalo con la documentación real.',
  },
  {
    number: 5,
    title: 'Selecciona y genera el XML',
    action: 'Marca exclusivamente contratos “Listos” y pulsa “Generar XML”. El servidor revalida las puertas, comprueba referencias únicas y aplica el XSD oficial si está completo; en caso contrario usa el contrato estructural oficial.',
    result: 'El XML se descarga y el lote conserva SHA-256, versión documental, modo de validación y snapshots históricos inmutables.',
    warning: 'Generar el XML no envía información al Gobierno.',
  },
  {
    number: 6,
    title: 'Sube el archivo al portal oficial',
    action: 'Accede manualmente a SES.HOSPEDAJES, selecciona la comunicación de alquiler de vehículos y carga el XML. Cuando el portal muestre el acuse, copia el código oficial del lote en “Registrar subida”.',
    result: 'El lote queda como “Subido · pendiente” hasta que el portal termine de procesarlo.',
    warning: 'No vuelvas a subir el mismo XML si ya recibiste un código de lote.',
  },
  {
    number: 7,
    title: 'Concilia el resultado',
    action: 'En el portal abre “Mis comunicaciones → Lote”. Registra cada aceptación con su código oficial de comunicación único o copia el código y mensaje exactos de cada error.',
    result: 'PlanMint conserva la trazabilidad del lote y deja las comunicaciones rechazadas preparadas para revisión.',
    warning: 'Si el portal sigue procesando, no marques nada como aceptado: espera y vuelve a consultar.',
  },
];

export const SES_AUTOMATIC_DATA = [
  'Referencia y fechas del contrato',
  'Nombre, documento, email y teléfono del cliente',
  'Nacimiento, domicilio y país cuando Rently los contiene',
  'Número, país y caducidad del permiso cuando están disponibles',
  'Categoría, marca, modelo, matrícula, bastidor y color del vehículo',
  'Kilómetros de recogida y devolución cuando Rently los devuelve',
  'Lugares reutilizables y municipio INE cuando la coincidencia es segura',
];

export const SES_MANUAL_DATA = [
  'Tipo de pago real cuando Rently no lo informa',
  'Categoría del permiso de conducir cuando no consta de forma fiable',
  'Domicilio, código postal o municipio que falten o sean ambiguos',
  'Identidades incompletas que no permiten crear un perfil reutilizable',
  'Bastidor o kilómetros que tampoco existen en el detalle ni en la flota de Rently',
  'Resultado exacto de aceptación o error mostrado por el portal oficial',
  'Resultado de la consulta exacta por contrato cuando no existe comunicación previa',
  'Protocolo, justificación y caducidad de una excepción manual autorizada',
];

export const SES_MANUAL_STATUSES: SesManualStatus[] = [
  { status: 'Incompleto', meaning: 'Falta al menos un dato obligatorio.', nextAction: 'Abrir y completar los campos señalados.', tone: 'amber' },
  { status: 'Listo', meaning: 'Está completo, pertenece a la intersección exacta y no tiene duplicado oficial.', nextAction: 'Seleccionar para generar XML.', tone: 'emerald' },
  { status: 'En lote', meaning: 'Ya forma parte de un XML generado.', nextAction: 'Subir ese archivo al portal.', tone: 'slate' },
  { status: 'Subido · pendiente', meaning: 'El portal recibió el XML y sigue procesándolo.', nextAction: 'Esperar el resultado definitivo.', tone: 'blue' },
  { status: 'Aceptado', meaning: 'El portal confirmó la comunicación.', nextAction: 'No requiere ninguna acción adicional.', tone: 'emerald' },
  { status: 'Error', meaning: 'El portal rechazó la comunicación.', nextAction: 'Copiar el error, corregir y volver a preparar.', tone: 'red' },
  { status: 'Requiere revisión', meaning: 'Cambió un dato después de generar o aceptar.', nextAction: 'Revisar antes de crear una nueva comunicación.', tone: 'orange' },
  { status: 'Revisión obligatoria', meaning: 'Existe una discrepancia Rently/PlanMint u oficial, o una terminada sin protocolo autorizado.', nextAction: 'Resolver la causa o registrar una excepción temporal verificable; no generar XML mientras siga bloqueada.', tone: 'red' },
];

export const SES_GOLDEN_RULES = [
  'Rently completa datos; PlanMint valida; una persona revisa; el portal oficial acepta o rechaza.',
  'Una corrección manual prevalece siempre sobre una sincronización posterior.',
  '“Listo” significa: completo, elegible, libre de duplicado oficial y preparado para XML.',
  'Cada lote conserva snapshots; cambios posteriores en perfiles o lugares no alteran lo que se generó.',
  'Sin XSD auténtico se usa la plantilla y documentación oficial; nunca se etiqueta un esquema inferido como XSD oficial.',
  'No se exige un inventario masivo: cada contrato se comprueba por referencia, tipo, fecha y matrícula.',
  'PlanMint nunca envía automáticamente datos al Gobierno.',
  'El acuse de subida no equivale a una aceptación: hay que consultar el resultado del lote.',
];
