export interface BlogPost {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  content: string;
  category: 'productividad' | 'gestion-tareas' | 'objetivos' | 'gestion-proyectos' | 'equipos' | 'operaciones';
  categoryLabel: string;
  author: string;
  publishedAt: string;
  readTime: number;
}

export const blogCategories = [
  { slug: 'productividad', label: 'Productividad' },
  { slug: 'gestion-tareas', label: 'Gestión de tareas' },
  { slug: 'objetivos', label: 'Objetivos' },
  { slug: 'gestion-proyectos', label: 'Gestión de proyectos' },
  { slug: 'equipos', label: 'Gestión de equipos' },
  { slug: 'operaciones', label: 'Operaciones' },
];

export const blogPosts: BlogPost[] = [
  {
    slug: 'como-organizar-tareas-y-objetivos-en-un-solo-sistema',
    title: 'Cómo organizar tareas y objetivos en un solo sistema (sin volverte loco)',
    metaTitle: 'Cómo organizar tareas y objetivos en un solo sistema | PlanMint',
    metaDescription: 'Aprende a gestionar tareas diarias y objetivos a largo plazo en un único sistema sin perder la cordura. Guía práctica con PlanMint.',
    excerpt: 'Descubre cómo unificar la gestión de tareas y objetivos sin caer en la parálisis por análisis ni perder de vista lo importante.',
    category: 'productividad',
    categoryLabel: 'Productividad',
    author: 'Equipo PlanMint',
    publishedAt: '2024-12-01',
    readTime: 6,
    content: `
## El problema de tener todo separado

Muchos profesionales usan una app para tareas, otra para objetivos, una hoja de cálculo para proyectos y notas adhesivas para recordatorios. El resultado: caos, duplicidad y pérdida de contexto.

## La solución: un sistema unificado

La clave está en tener un único lugar donde veas:
- **Tareas diarias**: las acciones concretas que debes hacer hoy
- **Objetivos**: metas medibles con progreso visible
- **Proyectos**: conjuntos de tareas y hitos organizados

### Cómo estructurar tu sistema

1. **Define áreas de vida/trabajo**: Trabajo, Personal, Salud, Finanzas, etc.
2. **Crea objetivos por área**: Metas claras con métricas o hitos
3. **Desglosa en tareas**: Acciones pequeñas y ejecutables
4. **Revisa semanalmente**: Ajusta prioridades según el contexto

## Errores comunes a evitar

- **Sobrecarga de herramientas**: Más apps no significa más productividad
- **No revisar regularmente**: El sistema se vuelve obsoleto
- **Objetivos vagos**: "Ser más productivo" no es un objetivo medible

## Empieza hoy

No necesitas un sistema perfecto desde el primer día. Empieza con lo básico y ve ajustando.

---

**¿Quieres probarlo?** [Crea tu cuenta gratis en PlanMint](/register) y organiza tareas y objetivos en un solo lugar.
    `,
  },
  {
    slug: 'kanban-vs-listas-cual-usar-y-cuando',
    title: 'Kanban vs listas: cuál usar y cuándo',
    metaTitle: 'Kanban vs listas de tareas: cuándo usar cada uno | PlanMint',
    metaDescription: 'Descubre cuándo usar tableros Kanban y cuándo listas de tareas tradicionales. Guía práctica para elegir el método correcto.',
    excerpt: 'No todas las tareas se gestionan igual. Aprende cuándo un Kanban es mejor que una lista y viceversa.',
    category: 'gestion-tareas',
    categoryLabel: 'Gestión de tareas',
    author: 'Equipo PlanMint',
    publishedAt: '2024-12-05',
    readTime: 5,
    content: `
## Dos enfoques, un mismo objetivo

Tanto Kanban como las listas buscan ayudarte a completar tareas. La diferencia está en cómo visualizas el flujo de trabajo.

## Cuándo usar Kanban

El tablero Kanban brilla cuando:
- Tienes **flujos con etapas definidas**: Por hacer → En progreso → Hecho
- Necesitas ver el **estado global** de un golpe de vista
- Trabajas en **equipo** y cada uno tiene asignaciones distintas
- Quieres **limitar el trabajo en progreso** (WIP)

### Ejemplo práctico
Un equipo de marketing con campañas en distintas fases: Ideación → Diseño → Revisión → Publicado.

## Cuándo usar listas

Las listas funcionan mejor cuando:
- Tienes **tareas independientes** sin un flujo específico
- Priorizas por **fecha de vencimiento** o urgencia
- Prefieres una vista **compacta** con menos distracción
- Trabajas **solo** o con pocas tareas activas

### Ejemplo práctico
Tu lista de tareas personales: Llamar al dentista, Renovar DNI, Comprar regalo.

## ¿Por qué no ambos?

La realidad es que puedes usar los dos según el contexto. Un buen sistema te permite alternar entre vistas sin perder información.

---

**En PlanMint puedes cambiar entre Kanban, lista y calendario con un clic.** [Pruébalo gratis](/register).
    `,
  },
  {
    slug: 'como-hacer-seguimiento-de-objetivos-y-cumplirlos',
    title: 'Cómo hacer seguimiento de objetivos (y cumplirlos)',
    metaTitle: 'Cómo hacer seguimiento de objetivos y cumplirlos | PlanMint',
    metaDescription: 'Aprende técnicas efectivas para dar seguimiento a tus objetivos y realmente cumplirlos. Guía con ejemplos prácticos.',
    excerpt: 'Definir objetivos es fácil. Cumplirlos es otra historia. Aquí te explicamos cómo dar seguimiento de verdad.',
    category: 'objetivos',
    categoryLabel: 'Objetivos',
    author: 'Equipo PlanMint',
    publishedAt: '2024-12-10',
    readTime: 7,
    content: `
## Por qué fallamos con los objetivos

El 92% de las personas abandonan sus objetivos de año nuevo antes de febrero. ¿Por qué?

- **Objetivos vagos**: "Ganar más dinero" no es un objetivo
- **Sin sistema de seguimiento**: Lo que no se mide no se gestiona
- **Sin revisión periódica**: Olvidamos qué queríamos lograr

## Cómo definir objetivos que funcionen

### 1. Hazlos específicos y medibles

❌ "Mejorar mi salud"
✅ "Hacer ejercicio 3 veces por semana durante 3 meses"

❌ "Ahorrar dinero"
✅ "Ahorrar 500€ al mes hasta llegar a 6.000€"

### 2. Elige métricas claras

- **Objetivos numéricos**: 10.000 pasos diarios, 50 libros al año, 1.000€ ahorrados
- **Objetivos por hitos**: Proyecto web → Diseño → Desarrollo → Testing → Lanzamiento

### 3. Registra progreso frecuentemente

No esperes a fin de mes para revisar. Actualiza tu progreso:
- Diariamente para hábitos
- Semanalmente para proyectos
- Mensualmente para objetivos a largo plazo

## Herramientas que ayudan

Un buen sistema debe permitirte:
- Ver progreso en porcentaje o valor absoluto
- Registrar avances con notas
- Recibir recordatorios de actualización
- Visualizar tendencias

## El poder de la revisión semanal

Dedica 15 minutos cada domingo a revisar:
1. ¿Qué avancé esta semana?
2. ¿Qué me bloqueó?
3. ¿Qué haré la próxima semana?

---

**PlanMint te permite crear objetivos numéricos y por hitos con seguimiento visual.** [Empieza gratis](/register).
    `,
  },
  {
    slug: 'errores-tipicos-al-gestionar-tareas-en-equipo',
    title: 'Errores típicos al gestionar tareas en equipo',
    metaTitle: '7 errores típicos al gestionar tareas en equipo | PlanMint',
    metaDescription: 'Descubre los errores más comunes en la gestión de tareas de equipo y cómo evitarlos para mejorar la productividad.',
    excerpt: 'Gestionar tareas en equipo parece simple hasta que todo se descontrola. Estos son los errores más comunes y cómo evitarlos.',
    category: 'equipos',
    categoryLabel: 'Gestión de equipos',
    author: 'Equipo PlanMint',
    publishedAt: '2024-12-15',
    readTime: 6,
    content: `
## Los 7 pecados capitales de la gestión de tareas en equipo

### 1. No asignar responsables claros

"Alguien debería hacerlo" es la mejor forma de que nadie lo haga. Cada tarea necesita un responsable único.

### 2. Fechas de vencimiento vagas

"Lo necesitamos pronto" no es una fecha. Pon fechas concretas y realistas.

### 3. Demasiadas herramientas

El equipo usa Slack, email, WhatsApp, Trello, Excel y notas adhesivas. Resultado: información dispersa y duplicada.

### 4. No documentar decisiones

Las reuniones terminan y nadie recuerda qué se acordó. Registra las decisiones como tareas o notas.

### 5. Reuniones de seguimiento infinitas

Si necesitas reuniones diarias de 1 hora para saber qué hace cada uno, tu sistema de tareas no funciona.

### 6. Ignorar los bloqueos

Cuando alguien dice "estoy bloqueado", debe haber un proceso claro para desbloquear. No es opcional.

### 7. No celebrar los logros

Completar un proyecto merece reconocimiento. Motiva al equipo y refuerza buenos hábitos.

## Cómo corregir estos errores

1. **Centraliza**: Una herramienta principal para tareas
2. **Estandariza**: Todos usan el mismo proceso
3. **Automatiza**: Recordatorios y notificaciones automáticos
4. **Revisa**: Reuniones breves de sincronización (15 min máx)

---

**PlanMint ayuda a equipos a gestionar tareas con asignaciones claras, fechas y notificaciones.** [Pruébalo gratis](/register).
    `,
  },
  {
    slug: 'como-planificar-proyectos-por-hitos-paso-a-paso',
    title: 'Cómo planificar proyectos por hitos paso a paso',
    metaTitle: 'Cómo planificar proyectos por hitos: guía paso a paso | PlanMint',
    metaDescription: 'Aprende a dividir proyectos grandes en hitos manejables. Guía práctica con ejemplos para planificación efectiva.',
    excerpt: 'Los proyectos grandes abruman. Dividirlos en hitos los hace manejables. Así es como se hace.',
    category: 'gestion-proyectos',
    categoryLabel: 'Gestión de proyectos',
    author: 'Equipo PlanMint',
    publishedAt: '2024-12-20',
    readTime: 8,
    content: `
## Por qué los hitos funcionan

Un proyecto de 6 meses parece inabarcable. Pero dividido en hitos de 2-4 semanas, se vuelve manejable.

Los hitos:
- Dan **sensación de progreso** constante
- Permiten **detectar problemas** antes
- Facilitan la **comunicación** con stakeholders
- Ayudan a **priorizar** lo importante

## Cómo definir buenos hitos

### 1. Identifica las fases naturales

Casi todo proyecto tiene fases: Investigación → Diseño → Desarrollo → Testing → Lanzamiento.

### 2. Haz cada hito un "entregable"

Un hito debe tener un resultado concreto:
- ❌ "Avanzar en el diseño"
- ✅ "Entregar wireframes aprobados"

### 3. Asigna fechas realistas

Usa la técnica de "buffer": si crees que tardará 2 semanas, planifica 2.5.

### 4. Define criterios de "hecho"

¿Cuándo está realmente completo un hito? Define qué significa "terminado".

## Ejemplo práctico: Lanzar un producto

**Proyecto**: Lanzar nueva funcionalidad de la app

**Hitos**:
1. **Investigación** (1 semana): Documentar requisitos y casos de uso
2. **Diseño** (2 semanas): Wireframes y prototipos aprobados
3. **Desarrollo MVP** (3 semanas): Funcionalidad básica operativa
4. **Testing interno** (1 semana): Bugs críticos corregidos
5. **Beta con usuarios** (2 semanas): Feedback recopilado y aplicado
6. **Lanzamiento** (1 semana): Disponible para todos los usuarios

## Cómo dar seguimiento

- Revisa el estado de cada hito semanalmente
- Actualiza el progreso cuando se complete algo
- Comunica desviaciones cuanto antes
- Celebra cuando se completa un hito

---

**Con PlanMint puedes crear proyectos con hitos, sub-hitos y seguimiento visual del progreso.** [Empieza gratis](/register).
    `,
  },
];

export const getBlogPost = (slug: string): BlogPost | undefined => {
  return blogPosts.find((post) => post.slug === slug);
};

export const getBlogPostsByCategory = (category: string): BlogPost[] => {
  return blogPosts.filter((post) => post.category === category);
};
