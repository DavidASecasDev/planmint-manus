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
    action: 'Abre “Configuración” y comprueba el código de arrendador. Después entra en “Control oficial”, carga el XSD oficial vigente y confirma un inventario completo de comunicaciones ya existentes en el portal.',
    result: 'PlanMint dispone de la norma técnica y del inventario necesarios para validar y evitar duplicados.',
    warning: 'No introduzcas aquí usuario, contraseña, Cl@ve ni credenciales del portal oficial.',
  },
  {
    number: 2,
    title: 'Selecciona el periodo y prepara',
    action: 'Indica un rango máximo de 93 días y pulsa “Preparar reservas”. Solo entran alquileres entregados en Rently (CurrentStatus 2), de la sucursal 1, no transfer, con entrega efectiva no futura y coincidencia de reserva y matrícula.',
    result: 'La tabla muestra los contratos elegibles y explica cada exclusión; las terminadas nunca comunicadas quedan en revisión obligatoria.',
    warning: '“Actualizar” solo recarga la pantalla. “Preparar reservas” vuelve a enriquecer y validar los datos.',
  },
  {
    number: 3,
    title: 'Revisa la bandeja',
    action: 'Usa los contadores del filtro aplicado, la barra de completitud, la búsqueda exacta por reserva o matrícula, las fechas y el estado para localizar excepciones.',
    result: 'Puedes priorizar los faltantes más repetidos y trabajar solo sobre las excepciones reales.',
  },
  {
    number: 4,
    title: 'Completa únicamente los faltantes',
    action: 'Abre una reserva y revisa las pestañas Contrato, Personas y Lugares. PlanMint señala los campos obligatorios pendientes; al guardarlos manualmente quedan protegidos frente a futuras sincronizaciones de Rently.',
    result: 'El contrato solo pasa a “Listo” si está completo, es elegible, no existe en el inventario oficial y supera todas las validaciones.',
    warning: 'No inventes datos legales. Si Rently no ofrece pago, categoría del permiso, domicilio o municipio fiable, confírmalo con la documentación real.',
  },
  {
    number: 5,
    title: 'Selecciona y genera el XML',
    action: 'Marca exclusivamente contratos “Listos” y pulsa “Generar XML”. El servidor revalida las cuatro puertas, comprueba referencias únicas, valida contra el XSD oficial y bloquea XML idénticos.',
    result: 'El XML se descarga y el lote conserva SHA-256, versión documental, versión XSD y snapshots históricos inmutables.',
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
];

export const SES_MANUAL_STATUSES: SesManualStatus[] = [
  { status: 'Incompleto', meaning: 'Falta al menos un dato obligatorio.', nextAction: 'Abrir y completar los campos señalados.', tone: 'amber' },
  { status: 'Listo', meaning: 'Supera todas las validaciones locales.', nextAction: 'Seleccionar para generar XML.', tone: 'emerald' },
  { status: 'En lote', meaning: 'Ya forma parte de un XML generado.', nextAction: 'Subir ese archivo al portal.', tone: 'slate' },
  { status: 'Subido · pendiente', meaning: 'El portal recibió el XML y sigue procesándolo.', nextAction: 'Esperar el resultado definitivo.', tone: 'blue' },
  { status: 'Aceptado', meaning: 'El portal confirmó la comunicación.', nextAction: 'No requiere ninguna acción adicional.', tone: 'emerald' },
  { status: 'Error', meaning: 'El portal rechazó la comunicación.', nextAction: 'Copiar el error, corregir y volver a preparar.', tone: 'red' },
  { status: 'Requiere revisión', meaning: 'Cambió un dato después de generar o aceptar.', nextAction: 'Revisar antes de crear una nueva comunicación.', tone: 'orange' },
  { status: 'Revisión obligatoria', meaning: 'La reserva no cumple la elegibilidad automática o está terminada sin prueba oficial.', nextAction: 'Resolver la causa indicada; no generar XML.', tone: 'red' },
];

export const SES_GOLDEN_RULES = [
  'Rently completa datos; PlanMint valida; una persona revisa; el portal oficial acepta o rechaza.',
  'Una corrección manual prevalece siempre sobre una sincronización posterior.',
  '“Listo” significa: completo, elegible, libre de duplicado oficial y preparado para XML.',
  'Cada lote conserva snapshots; cambios posteriores en perfiles o lugares no alteran lo que se generó.',
  'Sin XSD oficial vigente e inventario confirmado no se puede generar XML.',
  'PlanMint nunca envía automáticamente datos al Gobierno.',
  'El acuse de subida no equivale a una aceptación: hay que consultar el resultado del lote.',
];
