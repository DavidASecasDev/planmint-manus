import { Link, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicLayout } from '@/components/public/PublicLayout';
import { WaitlistForm } from '@/components/growth/WaitlistForm';
import { SEOHead } from '@/components/seo/SEOHead';
import { AnimatedHeroBg } from '@/components/ui/animated-hero-bg';
import { DashboardMockup } from '@/components/public/DashboardMockup';
import { ParticleTextEffect } from '@/components/ui/particle-text-effect';
import {
  Target,
  Calendar,
  Bell,
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Kanban,
  Users,
  Briefcase,
  User,
  Truck,
} from 'lucide-react';

const features = [
  {
    icon: Kanban,
    title: 'Kanban + Calendario',
    description: 'Visualiza tus tareas como quieras. Arrastra y organiza con facilidad.',
  },
  {
    icon: Target,
    title: 'Objetivos numéricos y por hitos',
    description: 'Define metas medibles y alcánzalas paso a paso.',
  },
  {
    icon: Bell,
    title: 'Recordatorios y notificaciones',
    description: 'Nunca olvides una fecha límite. Push, email y más.',
  },
  {
    icon: Search,
    title: 'Búsqueda global ⌘K',
    description: 'Encuentra cualquier cosa al instante.',
  },
  {
    icon: Sparkles,
    title: 'IA útil (Team)',
    description: 'Resúmenes, insights y alertas inteligentes.',
  },
];

const steps = [
  {
    number: '1',
    title: 'Crea tu tarea u objetivo',
    description: 'Simple, numérico o por hitos. Tú eliges.',
  },
  {
    number: '2',
    title: 'Organiza por áreas y tags',
    description: 'Trabajo, personal, finanzas... lo que necesites.',
  },
  {
    number: '3',
    title: 'Avanza con recordatorios y updates',
    description: 'Registra progreso y mantente al día.',
  },
];

const audiences = [
  { icon: User, title: 'Personal', description: 'Organiza tu vida diaria' },
  { icon: Briefcase, title: 'Freelancers', description: 'Gestiona proyectos y clientes' },
  { icon: Users, title: 'Equipos pequeños', description: 'Colabora con tu equipo' },
  { icon: Truck, title: 'Operaciones', description: 'Flotas, agencias, talleres...' },
];

import { fadeInUp, staggerContainer } from '@/lib/animations';

export const Landing = () => {
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || localStorage.getItem('ref_code');

  useEffect(() => {
    const urlRef = searchParams.get('ref');
    if (urlRef) {
      localStorage.setItem('ref_code', urlRef);
    }
  }, [searchParams]);

  return (
    <PublicLayout>
      <SEOHead
        title="PlanMint | Organiza tareas, objetivos y equipos"
        description="Gestiona tareas, objetivos, proyectos y equipos desde un solo lugar. Kanban, calendario, recordatorios, notificaciones e IA."
        canonical="/"
      />

      {/* Hero Section */}
      <AnimatedHeroBg className="min-h-[90vh] flex items-center -mt-16 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32 w-full relative z-10">
          <div className="text-center">
            <motion.h1
              className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl text-foreground"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              Organiza{' '}
              <ParticleTextEffect
                words={["tareas", "objetivos", "proyectos"]}
                inline
                fontSize={72}
                className="hidden lg:inline-block"
              />
              <ParticleTextEffect
                words={["tareas", "objetivos", "proyectos"]}
                inline
                fontSize={48}
                className="hidden sm:inline-block lg:hidden"
              />
              <ParticleTextEffect
                words={["tareas", "objetivos", "proyectos"]}
                inline
                fontSize={36}
                className="inline-block sm:hidden"
              />
              <br />
              <span className="text-primary">con claridad</span>
            </motion.h1>
            <motion.p
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            >
              Kanban, calendario, recordatorios, notificaciones y resúmenes con IA.
              Todo en un solo lugar.
            </motion.p>
            <motion.div
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
            >
              <Link to="/register">
                <Button size="lg" className="text-lg px-8">
                  Empezar gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="text-lg px-8 bg-background/10 border-border/30 backdrop-blur-sm hover:bg-background/20">
                  Ver precios
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Product Mockup */}
          <DashboardMockup />
        </div>
      </AnimatedHeroBg>

      {/* Social Proof */}
      <motion.section
        className="border-y bg-muted/30 py-12"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={staggerContainer}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
              Diseñado para uso personal y equipos
            </motion.p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
              {['Productividad', 'Gestión de proyectos', 'Objetivos', 'Equipos'].map((item) => (
                <motion.div
                  key={item}
                  variants={fadeInUp}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Features */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold sm:text-4xl">
              Todo lo que necesitas para avanzar
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Herramientas diseñadas para que te centres en lo importante.
            </p>
          </motion.div>
          <motion.div
            className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeInUp}>
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                  <CardContent className="p-6">
                    <feature.icon className="h-10 w-10 text-primary" />
                    <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works - Timeline */}
      <section className="border-y bg-muted/30 py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold sm:text-4xl">Cómo funciona</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Tres pasos para empezar a ser más productivo.
            </p>
          </motion.div>
          <motion.div
            className="mt-16 grid gap-8 sm:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {steps.map((step, index) => (
              <motion.div key={step.number} variants={fadeInUp} className="text-center relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-[60%] w-[80%] h-px bg-border" />
                )}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25 relative z-10">
                  {step.number}
                </div>
                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* For whom */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold sm:text-4xl">¿Para quién es?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Diseñado para adaptarse a diferentes necesidades.
            </p>
          </motion.div>
          <motion.div
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {audiences.map((audience) => (
              <motion.div key={audience.title} variants={fadeInUp}>
                <Card className="text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30">
                  <CardContent className="p-6">
                    <audience.icon className="mx-auto h-12 w-12 text-primary" />
                    <h3 className="mt-4 text-lg font-semibold">{audience.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {audience.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <motion.section
        className="border-t bg-gradient-to-b from-background to-muted/30 py-20 sm:py-32"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        transition={{ duration: 0.7 }}
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Empieza gratis en 30 segundos
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sin tarjeta de crédito. Cancela cuando quieras.
          </p>
          <div className="mt-10">
            <Link to="/register">
              <Button size="lg" className="text-lg px-8">
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <div className="mt-8">
            <p className="text-sm text-muted-foreground mb-4">
              O déjanos tu email y te avisamos de novedades:
            </p>
            <WaitlistForm
              source="landing"
              referralCode={refCode}
              className="max-w-md mx-auto"
              buttonText="Avisarme"
            />
          </div>
        </div>
      </motion.section>
    </PublicLayout>
  );
};
