import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageCTA } from '@/components/public/PageCTA';
import { PageHero } from '@/components/public/PageHero';
import { SEOHead } from '@/components/seo/SEOHead';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Target,
  Calendar,
  Bell,
  Search,
  Sparkles,
  ArrowRight,
  Kanban,
  ListTodo,
  BarChart3,
  Users,
  Flag,
  Folder,
  Tag,
  Clock,
  Globe,
  Shield,
} from 'lucide-react';

const mainFeatures = [
  {
    icon: ListTodo,
    title: 'Tareas inteligentes',
    description:
      'Crea tareas simples, objetivos numéricos o proyectos con hitos. Cada tipo tiene su propio sistema de progreso.',
    details: [
      'Tareas simples con subtareas',
      'Objetivos numéricos con seguimiento',
      'Proyectos con hitos y sub-hitos',
    ],
  },
  {
    icon: Kanban,
    title: 'Vista Kanban',
    description:
      'Arrastra y suelta tareas entre columnas personalizables. Configura colores, etiquetas y visibilidad.',
    details: [
      'Columnas personalizables',
      'Drag & drop intuitivo',
      'Filtros avanzados',
    ],
  },
  {
    icon: Calendar,
    title: 'Calendario integrado',
    description:
      'Visualiza tareas por día, semana o mes. Cambia fechas arrastrando directamente en el calendario.',
    details: [
      'Vistas día, semana y mes',
      'Actualización por drag & drop',
      'Sincronización en tiempo real',
    ],
  },
  {
    icon: Bell,
    title: 'Recordatorios avanzados',
    description:
      'Configura recordatorios puntuales o recurrentes. Recibe notificaciones push, email, Slack o WhatsApp.',
    details: [
      'Recordatorios recurrentes',
      'Múltiples canales de notificación',
      'Horas de silencio configurables',
    ],
  },
  {
    icon: Search,
    title: 'Búsqueda global ⌘K',
    description:
      'Encuentra cualquier tarea, área, etiqueta o actualización al instante con el atajo de teclado.',
    details: [
      'Búsqueda en tiempo real',
      'Resultados agrupados',
      'Navegación con teclado',
    ],
  },
  {
    icon: Sparkles,
    title: 'IA integrada',
    description:
      'Resúmenes automáticos de tareas, digests semanales e insights sobre bloqueos y riesgos.',
    details: [
      'Resúmenes de tareas',
      'Digest semanal del equipo',
      'Alertas inteligentes',
    ],
  },
];

const additionalFeatures = [
  { icon: Folder, title: 'Áreas de vida', description: 'Organiza por contextos' },
  { icon: Tag, title: 'Etiquetas', description: 'Clasifica con flexibilidad' },
  { icon: Flag, title: 'Prioridades', description: 'Urgente, alta, media, baja' },
  { icon: Users, title: 'Equipos', description: 'Colaboración en tiempo real' },
  { icon: BarChart3, title: 'Timeline', description: 'Historial de actividad' },
  { icon: Clock, title: 'Subtareas', description: 'Divide en pasos' },
  { icon: Globe, title: 'PWA', description: 'Instala como app' },
  { icon: Shield, title: 'Seguridad', description: 'Datos protegidos' },
];

export const Features = () => {
  return (
    <PublicLayout>
      <SEOHead
        title="Funciones | PlanMint"
        description="Kanban, calendario, objetivos, recordatorios, notificaciones y resúmenes con IA. Todo en PlanMint."
        canonical="/features"
      />

      <PageHero
        title="Funcionalidades pensadas para ti"
        subtitle="Herramientas que se adaptan a tu forma de trabajar, no al revés."
      />

      {/* Main Features */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid gap-12 lg:gap-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {mainFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className={`flex flex-col gap-8 lg:flex-row lg:items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">{feature.title}</h2>
                  </div>
                  <p className="text-lg text-muted-foreground mb-6">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1">
                  <Card className="aspect-video bg-muted/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                    <CardContent className="flex h-full items-center justify-center p-6">
                      <feature.icon className="h-24 w-24 text-primary/20" />
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="border-y bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-2xl font-bold text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            Y mucho más...
          </motion.h2>
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {additionalFeatures.map((feature) => (
              <motion.div key={feature.title} variants={fadeInUp}>
                <Card className="bg-background transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                  <CardContent className="flex items-center gap-3 p-4">
                    <feature.icon className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <PageCTA
        title="¿Listo para empezar?"
        subtitle="Prueba gratis todas las funcionalidades básicas."
      >
        <Link to="/pricing">
          <Button size="lg" variant="outline" className="mt-3 ml-4">
            Ver precios
          </Button>
        </Link>
      </PageCTA>
    </PublicLayout>
  );
};
