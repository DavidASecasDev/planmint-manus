export interface UseCase {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroDescription: string;
  problemTitle: string;
  problemDescription: string;
  benefits: {
    title: string;
    description: string;
  }[];
  features: string[];
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
}

export const useCases: UseCase[] = [
  {
    slug: 'personal-task-manager',
    title: 'Gestor de tareas personal',
    metaTitle: 'Gestor de tareas personal | PlanMint',
    metaDescription: 'Organiza tus tareas personales, hábitos y objetivos en un solo lugar. Kanban, calendario y recordatorios para tu productividad diaria.',
    heroTitle: 'Tu productividad personal, organizada',
    heroDescription: 'Deja de perder tiempo buscando qué hacer. Ten todas tus tareas, objetivos y recordatorios en un solo lugar.',
    problemTitle: '¿Te suena esto?',
    problemDescription: 'Notas adhesivas por todas partes. Apps de tareas abandonadas. Objetivos de año nuevo olvidados en febrero. La sensación de que siempre se te escapa algo importante.',
    benefits: [
      {
        title: 'Todo en un lugar',
        description: 'Tareas, objetivos, hábitos y recordatorios unificados. Sin saltar entre apps.',
      },
      {
        title: 'Visualiza tu día',
        description: 'Vista de calendario y Kanban para ver qué toca hoy y qué viene después.',
      },
      {
        title: 'Nunca olvides nada',
        description: 'Recordatorios push y email que te avisan en el momento justo.',
      },
      {
        title: 'Mide tu progreso',
        description: 'Objetivos con métricas y seguimiento visual de tu avance.',
      },
    ],
    features: [
      'Tareas con prioridades y fechas',
      'Objetivos numéricos (ej: "Leer 50 libros")',
      'Objetivos por hitos (ej: "Renovar casa")',
      'Kanban personal',
      'Vista de calendario',
      'Recordatorios recurrentes',
      'Búsqueda global ⌘K',
      'App instalable (PWA)',
    ],
    testimonial: {
      quote: 'Por fin tengo un sistema que realmente uso. Simple pero completo.',
      author: 'Usuario de PlanMint',
      role: 'Profesional freelance',
    },
  },
  {
    slug: 'team-task-management',
    title: 'Gestión de tareas en equipo',
    metaTitle: 'Gestión de tareas en equipo | PlanMint',
    metaDescription: 'Coordina tareas y proyectos de tu equipo con asignaciones claras, seguimiento y notificaciones. Kanban colaborativo.',
    heroTitle: 'Tu equipo, sincronizado',
    heroDescription: 'Asigna tareas, da seguimiento al progreso y mantén a todos en la misma página. Sin reuniones interminables.',
    problemTitle: 'El caos de la colaboración',
    problemDescription: 'Emails perdidos, tareas sin responsable, nadie sabe quién hace qué. Las reuniones de seguimiento duran más que el trabajo real.',
    benefits: [
      {
        title: 'Asignaciones claras',
        description: 'Cada tarea tiene un responsable único. Sin ambigüedades.',
      },
      {
        title: 'Visibilidad total',
        description: 'Kanban compartido donde todos ven el estado del trabajo.',
      },
      {
        title: 'Notificaciones inteligentes',
        description: 'Menciones, asignaciones y recordatorios automáticos.',
      },
      {
        title: 'Historial de cambios',
        description: 'Timeline de cada tarea con quién hizo qué y cuándo.',
      },
    ],
    features: [
      'Usuarios con roles (admin, manager, miembro)',
      'Asignación de tareas',
      'Menciones @usuario',
      'Kanban por equipo',
      'Notificaciones push y email',
      'Slack y WhatsApp (plan Team)',
      'Resúmenes semanales con IA',
      'Alertas de bloqueos',
    ],
    testimonial: {
      quote: 'Redujimos las reuniones de seguimiento a 15 minutos. Todo está visible.',
      author: 'Equipo de marketing',
      role: '5 personas',
    },
  },
  {
    slug: 'goal-tracking',
    title: 'Seguimiento de objetivos',
    metaTitle: 'Seguimiento de objetivos y metas | PlanMint',
    metaDescription: 'Define objetivos medibles y haz seguimiento real de tu progreso. Objetivos numéricos, por hitos y con métricas visuales.',
    heroTitle: 'Objetivos que realmente cumples',
    heroDescription: 'Define metas claras, mide tu progreso y celebra cuando las alcanzas. Sin perder el foco.',
    problemTitle: 'Objetivos que se quedan en intenciones',
    problemDescription: 'Defines objetivos de año nuevo que olvidas en febrero. No tienes forma de medir si avanzas o retrocedes. El progreso es invisible.',
    benefits: [
      {
        title: 'Objetivos medibles',
        description: 'Numéricos (€, km, libros) o por hitos (fases de proyecto).',
      },
      {
        title: 'Progreso visual',
        description: 'Barras de progreso y porcentajes que muestran tu avance.',
      },
      {
        title: 'Actualizaciones fáciles',
        description: 'Registra avances con un clic y notas opcionales.',
      },
      {
        title: 'Recordatorios de revisión',
        description: 'No pierdas de vista tus metas con avisos periódicos.',
      },
    ],
    features: [
      'Objetivos numéricos con unidad personalizada',
      'Objetivos por hitos y sub-hitos',
      'Barra de progreso visual',
      'Timeline de actualizaciones',
      'Recordatorios de revisión',
      'Organización por áreas',
      'Resúmenes con IA',
      'Alertas de objetivos estancados',
    ],
    testimonial: {
      quote: 'Por primera vez cumplí mi objetivo de ahorro anual. Verlo en números ayuda.',
      author: 'Usuario de PlanMint',
      role: 'Objetivo: ahorrar 10.000€',
    },
  },
  {
    slug: 'project-planning',
    title: 'Planificación de proyectos',
    metaTitle: 'Planificación de proyectos por hitos | PlanMint',
    metaDescription: 'Planifica proyectos dividiéndolos en hitos manejables. Seguimiento visual, asignaciones y fechas de entrega.',
    heroTitle: 'Proyectos grandes, pasos pequeños',
    heroDescription: 'Divide proyectos complejos en hitos claros. Visualiza el progreso y mantén todo bajo control.',
    problemTitle: 'Proyectos que abruman',
    problemDescription: 'El proyecto parece enorme e inabarcable. No sabes por dónde empezar. Las fechas pasan y no ves avance real.',
    benefits: [
      {
        title: 'Divide y vencerás',
        description: 'Hitos y sub-hitos que hacen cualquier proyecto manejable.',
      },
      {
        title: 'Fechas de entrega',
        description: 'Cada hito tiene su fecha. Ve el timeline completo.',
      },
      {
        title: 'Progreso real',
        description: 'Porcentaje de avance basado en hitos completados.',
      },
      {
        title: 'Colaboración clara',
        description: 'Asigna hitos a miembros del equipo.',
      },
    ],
    features: [
      'Proyectos con hitos y sub-hitos',
      'Fechas de entrega por hito',
      'Estados: pendiente, en progreso, hecho',
      'Reordenación drag & drop',
      'Asignación de responsables',
      'Timeline de actualizaciones',
      'Vista Kanban y calendario',
      'Resúmenes de proyecto con IA',
    ],
    testimonial: {
      quote: 'Lanzamos el producto a tiempo por primera vez. Los hitos nos mantuvieron enfocados.',
      author: 'Startup de tecnología',
      role: 'Equipo de 8 personas',
    },
  },
  {
    slug: 'operations-management',
    title: 'Gestión de operaciones',
    metaTitle: 'Gestión de operaciones y tareas recurrentes | PlanMint',
    metaDescription: 'Gestiona operaciones diarias con tareas recurrentes, seguimiento y notificaciones. Para agencias, talleres y equipos operativos.',
    heroTitle: 'Operaciones bajo control',
    heroDescription: 'Gestiona tareas recurrentes, procesos y operaciones diarias. Todo visible, nada se escapa.',
    problemTitle: 'El día a día que desborda',
    problemDescription: 'Tareas que se repiten cada día, semana o mes. Procesos que dependen de que alguien se acuerde. Clientes que esperan y nadie sabe el estado.',
    benefits: [
      {
        title: 'Tareas recurrentes',
        description: 'Programa tareas diarias, semanales o mensuales.',
      },
      {
        title: 'Visibilidad operativa',
        description: 'Kanban con el estado de cada operación.',
      },
      {
        title: 'Alertas de bloqueos',
        description: 'Detecta y resuelve problemas antes de que escalen.',
      },
      {
        title: 'Historial completo',
        description: 'Registro de quién hizo qué y cuándo.',
      },
    ],
    features: [
      'Recordatorios recurrentes',
      'Kanban operativo',
      'Asignación por rol',
      'Estados personalizables',
      'Notificaciones de vencimiento',
      'Timeline de operaciones',
      'Búsqueda rápida',
      'App móvil (PWA)',
    ],
    testimonial: {
      quote: 'Pasamos de Excel a PlanMint y dejamos de perder trabajos.',
      author: 'Agencia de servicios',
      role: '12 empleados',
    },
  },
  {
    slug: 'fleet-management',
    title: 'Gestión de flotas',
    metaTitle: 'Gestión de flotas y vehículos | PlanMint',
    metaDescription: 'Organiza tareas de mantenimiento, seguimiento de vehículos y operaciones de flota. Para empresas de transporte y logística.',
    heroTitle: 'Tu flota, organizada',
    heroDescription: 'Gestiona mantenimientos, seguimientos y operaciones de flota en un solo lugar.',
    problemTitle: 'El caos de gestionar vehículos',
    problemDescription: 'ITV que se pasan, mantenimientos olvidados, conductores sin saber qué toca. Hojas de Excel que nadie actualiza.',
    benefits: [
      {
        title: 'Recordatorios automáticos',
        description: 'ITV, seguros, mantenimientos programados con alertas.',
      },
      {
        title: 'Un vehículo = Un área',
        description: 'Organiza por vehículo todas sus tareas y objetivos.',
      },
      {
        title: 'Historial completo',
        description: 'Registro de cada intervención, gasto y fecha.',
      },
      {
        title: 'Acceso móvil',
        description: 'Conductores actualizan desde el móvil.',
      },
    ],
    features: [
      'Áreas por vehículo/unidad',
      'Tareas de mantenimiento',
      'Recordatorios de vencimientos',
      'Objetivos de kilometraje',
      'Timeline de intervenciones',
      'Asignación a conductores',
      'PWA instalable',
      'Notificaciones push',
    ],
    testimonial: {
      quote: 'Ya no se nos pasa ninguna ITV ni revisión. Todo está en el calendario.',
      author: 'Empresa de transporte',
      role: '15 vehículos',
    },
  },
];

export const getUseCase = (slug: string): UseCase | undefined => {
  return useCases.find((uc) => uc.slug === slug);
};
