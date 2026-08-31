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
    title: 'Sincroniza Rently',
    action: 'Pulsa “Sincronizar Rently”. PlanMint recorre todas las páginas disponibles, importa las reservas nuevas y actualiza las existentes sin crear duplicados.',
    result: 'Cada reserva queda visible una sola vez en SES.HOSPEDAJES. Los campos manuales prevalecen y cualquier diferencia con Rently se muestra como aviso.',
    warning: 'La sincronización no envía información al Gobierno ni genera XML.',
  },
  {
    number: 2,
    title: 'Completa solo lo que falta',
    action: 'Abre una reserva “Incompleta”. El editor muestra por nombre los campos ausentes y los formatos o incoherencias que debes corregir.',
    result: 'Al guardar se valida de inmediato. Cuando no queda ningún campo pendiente o inválido, el contrato pasa a “Listo”.',
    warning: 'No inventes datos legales. Confirma cualquier dato que Rently no aporte de forma fiable.',
  },
  {
    number: 3,
    title: 'Revisa la procedencia',
    action: 'En el editor puedes ver qué valores proceden de Rently, cuáles se derivaron de la configuración y cuáles fueron corregidos manualmente.',
    result: 'Una corrección manual nunca se sustituye en una sincronización posterior; si Rently propone otro valor se conserva el manual y aparece un conflicto informativo.',
  },
  {
    number: 4,
    title: 'Selecciona contratos listos',
    action: 'Marca uno o varios contratos con estado “Listo”. “Comprobar SES” es opcional y solo añade un aviso si encuentra una comunicación previa.',
    result: 'Un aviso SES no desmarca el contrato ni bloquea la descarga. El operador decide si continúa.',
  },
  {
    number: 5,
    title: 'Descarga el XML',
    action: 'Pulsa “Descargar XML”. El servidor vuelve a validar los campos, genera la estructura local oficial y descarga un único archivo con la selección.',
    result: 'El historial conserva el lote y sus snapshots. La descarga no realiza ningún envío automático al portal oficial.',
  },
];

export const SES_AUTOMATIC_DATA = [
  'Número, fechas y horas del contrato',
  'Titular y conductores disponibles en Rently',
  'Vehículo, matrícula, bastidor, marca, modelo, color y kilómetros disponibles',
  'Lugares de recogida y devolución disponibles',
  'Datos personales, domicilio y permiso cuando Rently los contiene',
  'Valores derivados seguros de la configuración de PlanMint',
];

export const SES_MANUAL_DATA = [
  'Campos obligatorios que Rently no aporta',
  'Formatos o incoherencias detectados por la validación local',
  'Datos legales confirmados por una persona responsable',
  'Segundo conductor cuando no consta en la sincronización',
  'Categoría del permiso de conducir si Rently no la informa',
  'Tipo de pago real si no puede derivarse con seguridad',
];

export const SES_MANUAL_STATUSES: SesManualStatus[] = [
  { status: 'Incompleta', meaning: 'Falta un campo obligatorio o existe un formato/incoherencia.', nextAction: 'Abrir y completar únicamente los campos señalados.', tone: 'amber' },
  { status: 'Listo', meaning: 'No quedan campos pendientes ni inválidos.', nextAction: 'Seleccionar para descargar XML.', tone: 'emerald' },
  { status: 'XML generado', meaning: 'Ya forma parte del historial de un XML descargado.', nextAction: 'Consultar el historial si necesitas trazabilidad.', tone: 'blue' },
];

export const SES_GOLDEN_RULES = [
  'Rently sincroniza; PlanMint valida; una persona completa; PlanMint descarga el XML.',
  'Una corrección manual prevalece siempre sobre una sincronización posterior.',
  '“Listo” depende únicamente de que no existan campos ausentes, inválidos o incoherentes.',
  '“Comprobar SES” es una ayuda opcional y nunca bloquea la selección o descarga.',
  'Cada XML conserva snapshots históricos; cambios posteriores no alteran lo ya generado.',
  'PlanMint nunca envía automáticamente datos al Gobierno.',
];
