export interface Alternative {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  description: string;
  forWho: string[];
  planmintForWho: string[];
  comparison: {
    feature: string;
    competitor: string | boolean;
    planmint: string | boolean;
  }[];
}

export const alternatives: Alternative[] = [
  {
    slug: 'trello',
    name: 'Trello',
    metaTitle: 'PlanMint vs Trello: comparativa honesta | PlanMint',
    metaDescription: 'Compara PlanMint y Trello. Descubre cuál es mejor para gestionar tareas, proyectos y equipos según tus necesidades.',
    heroTitle: 'PlanMint vs Trello',
    description: 'Trello es una herramienta popular de Kanban visual, ideal para organizar tareas en tableros. PlanMint va más allá con objetivos medibles, hitos y múltiples vistas.',
    forWho: [
      'Equipos que solo necesitan Kanban básico',
      'Usuarios que prefieren integraciones con muchas apps',
      'Quienes ya tienen flujos establecidos en Trello',
    ],
    planmintForWho: [
      'Quienes necesitan objetivos con seguimiento numérico',
      'Equipos que quieren Kanban + calendario + listas',
      'Usuarios que prefieren una solución todo-en-uno',
    ],
    comparison: [
      { feature: 'Tableros Kanban', competitor: true, planmint: true },
      { feature: 'Vista de calendario', competitor: 'Power-Up', planmint: true },
      { feature: 'Vista de lista', competitor: 'Limitada', planmint: true },
      { feature: 'Objetivos numéricos', competitor: false, planmint: true },
      { feature: 'Objetivos por hitos', competitor: false, planmint: true },
      { feature: 'Recordatorios recurrentes', competitor: 'Power-Up', planmint: true },
      { feature: 'IA (resúmenes)', competitor: false, planmint: 'Plan Team' },
      { feature: 'App instalable (PWA)', competitor: false, planmint: true },
      { feature: 'Precio plan gratuito', competitor: '10 tableros', planmint: '20 tareas' },
    ],
  },
  {
    slug: 'asana',
    name: 'Asana',
    metaTitle: 'PlanMint vs Asana: comparativa honesta | PlanMint',
    metaDescription: 'Compara PlanMint y Asana. Descubre cuál se adapta mejor a tu forma de gestionar tareas y proyectos.',
    heroTitle: 'PlanMint vs Asana',
    description: 'Asana es una plataforma robusta de gestión de proyectos para equipos medianos y grandes. PlanMint ofrece una experiencia más simple y directa.',
    forWho: [
      'Empresas medianas/grandes con procesos complejos',
      'Equipos que necesitan portfolios y dependencias',
      'Organizaciones con presupuesto para plan Business',
    ],
    planmintForWho: [
      'Equipos pequeños que buscan simplicidad',
      'Freelancers y profesionales individuales',
      'Quienes quieren empezar rápido sin configuración compleja',
    ],
    comparison: [
      { feature: 'Gestión de tareas', competitor: true, planmint: true },
      { feature: 'Kanban', competitor: true, planmint: true },
      { feature: 'Calendario', competitor: true, planmint: true },
      { feature: 'Objetivos numéricos', competitor: 'OKRs separados', planmint: true },
      { feature: 'Hitos de proyecto', competitor: true, planmint: true },
      { feature: 'Curva de aprendizaje', competitor: 'Alta', planmint: 'Baja' },
      { feature: 'Precio inicial', competitor: '10.99€/usuario', planmint: '9€/5 usuarios' },
      { feature: 'Plan gratuito', competitor: 'Limitado', planmint: '20 tareas' },
    ],
  },
  {
    slug: 'notion',
    name: 'Notion',
    metaTitle: 'PlanMint vs Notion: comparativa honesta | PlanMint',
    metaDescription: 'Compara PlanMint y Notion. Descubre cuál es mejor para gestionar tareas vs documentación.',
    heroTitle: 'PlanMint vs Notion',
    description: 'Notion es una herramienta todo-en-uno para notas, documentación y bases de datos. PlanMint está especializado en gestión de tareas y objetivos.',
    forWho: [
      'Equipos que necesitan wiki + tareas en un lugar',
      'Quienes crean mucha documentación',
      'Usuarios técnicos cómodos con bases de datos',
    ],
    planmintForWho: [
      'Quienes quieren una app de tareas lista para usar',
      'Usuarios que prefieren estructura sobre flexibilidad',
      'Equipos que priorizan la ejecución sobre la documentación',
    ],
    comparison: [
      { feature: 'Gestión de tareas', competitor: 'Flexible', planmint: 'Especializada' },
      { feature: 'Kanban', competitor: true, planmint: true },
      { feature: 'Documentación/Wiki', competitor: 'Excelente', planmint: 'Notas básicas' },
      { feature: 'Objetivos medibles', competitor: 'Manual', planmint: 'Nativo' },
      { feature: 'Recordatorios', competitor: 'Limitados', planmint: 'Completos' },
      { feature: 'Curva de aprendizaje', competitor: 'Media-Alta', planmint: 'Baja' },
      { feature: 'Configuración inicial', competitor: 'Alta', planmint: 'Mínima' },
      { feature: 'App móvil', competitor: 'Lenta', planmint: 'PWA rápida' },
    ],
  },
  {
    slug: 'monday',
    name: 'Monday.com',
    metaTitle: 'PlanMint vs Monday.com: comparativa honesta | PlanMint',
    metaDescription: 'Compara PlanMint y Monday.com. Descubre cuál se adapta mejor a tu equipo y presupuesto.',
    heroTitle: 'PlanMint vs Monday.com',
    description: 'Monday.com es una plataforma de Work OS altamente personalizable para equipos empresariales. PlanMint ofrece una solución más directa y asequible.',
    forWho: [
      'Empresas con presupuesto para herramientas premium',
      'Equipos que necesitan automatizaciones complejas',
      'Organizaciones con muchas integraciones',
    ],
    planmintForWho: [
      'Equipos pequeños y medianos',
      'Startups y freelancers conscientes del coste',
      'Quienes prefieren simplicidad sobre personalización',
    ],
    comparison: [
      { feature: 'Gestión de tareas', competitor: true, planmint: true },
      { feature: 'Kanban', competitor: true, planmint: true },
      { feature: 'Calendario', competitor: true, planmint: true },
      { feature: 'Automatizaciones', competitor: 'Extensas', planmint: 'Recordatorios' },
      { feature: 'Integraciones', competitor: 'Muchas', planmint: 'Slack, WhatsApp' },
      { feature: 'Precio por usuario', competitor: 'Desde 9€', planmint: '9€/5 usuarios' },
      { feature: 'Plan gratuito', competitor: '2 usuarios', planmint: '1 usuario' },
      { feature: 'Complejidad', competitor: 'Alta', planmint: 'Baja' },
    ],
  },
];

export const getAlternative = (slug: string): Alternative | undefined => {
  return alternatives.find((alt) => alt.slug === slug);
};
