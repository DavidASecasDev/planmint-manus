import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { PageCTA } from '@/components/public/PageCTA';
import { SEOHead } from '@/components/seo/SEOHead';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { Shield, Lock, Eye, Server, Key, FileCheck } from 'lucide-react';

const securityFeatures = [
  {
    icon: Lock,
    title: 'Cifrado en tránsito',
    description:
      'Todas las comunicaciones están protegidas con TLS 1.3. Tus datos viajan cifrados entre tu dispositivo y nuestros servidores.',
  },
  {
    icon: Server,
    title: 'Infraestructura segura',
    description:
      'Utilizamos proveedores cloud de primer nivel con certificaciones de seguridad ISO 27001 y SOC 2.',
  },
  {
    icon: Key,
    title: 'Autenticación robusta',
    description:
      'Contraseñas hasheadas con bcrypt. Soporte para autenticación de dos factores próximamente.',
  },
  {
    icon: Eye,
    title: 'Políticas de acceso',
    description:
      'Row Level Security (RLS) en base de datos. Cada usuario solo accede a los datos de su organización.',
  },
  {
    icon: FileCheck,
    title: 'Auditoría',
    description:
      'Registro de eventos para trazabilidad. Historial de cambios en tareas y configuraciones.',
  },
  {
    icon: Shield,
    title: 'Privacidad',
    description:
      'No vendemos ni compartimos tus datos. Cumplimiento con RGPD para usuarios en Europa.',
  },
];

export const Security = () => {
  return (
    <PublicLayout>
      <SEOHead
        title="Seguridad | PlanMint"
        description="Conoce cómo PlanMint protege tus datos con cifrado, políticas de acceso y cumplimiento RGPD."
        canonical="/security"
      />

      <PageHero
        title="Seguridad y privacidad"
        subtitle="Tus datos están protegidos. Nos tomamos la seguridad muy en serio."
        icon={Shield}
      />

      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {securityFeatures.map((feature) => (
              <motion.div key={feature.title} variants={fadeInUp}>
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                  <CardHeader>
                    <feature.icon className="h-10 w-10 text-primary" />
                    <CardTitle className="mt-4">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-16 rounded-2xl bg-muted/50 p-8 sm:p-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold">Nuestro compromiso</h2>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>
                En PlanMint, la seguridad no es una funcionalidad más, es
                un principio fundamental. Diseñamos nuestra arquitectura pensando
                primero en la protección de tus datos.
              </p>
              <p>
                Nunca vendemos, compartimos ni utilizamos tus datos para
                publicidad. Tu información es tuya y solo tuya.
              </p>
              <p>
                Si tienes preguntas sobre seguridad o quieres reportar una
                vulnerabilidad, escríbenos a{' '}
                <a
                  href="mailto:seguridad@planmint.app"
                  className="text-primary hover:underline"
                >
                  seguridad@planmint.app
                </a>
                .
              </p>
            </div>
          </motion.div>

          <motion.div
            className="mt-16 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <Link to="/privacy">
              <Button variant="outline" className="mr-4">
                Política de privacidad
              </Button>
            </Link>
            <Link to="/terms">
              <Button variant="outline">Términos de servicio</Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
};
