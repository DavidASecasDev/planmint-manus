import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { PageCTA } from '@/components/public/PageCTA';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { useCases } from '@/data/useCases';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { ArrowRight, User, Users, Target, Briefcase, Truck, Settings } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  'personal-task-manager': User,
  'team-task-management': Users,
  'goal-tracking': Target,
  'project-planning': Briefcase,
  'operations-management': Settings,
  'fleet-management': Truck,
};

export const UseCases = () => {
  return (
    <PublicLayout>
      <SEOHead
        title="Casos de uso | PlanMint"
        description="Descubre cómo PlanMint ayuda a gestionar tareas personales, equipos, objetivos, proyectos y operaciones. Soluciones para cada necesidad."
        canonical="/use-cases"
      />

      <PageHero
        title="Casos de uso"
        subtitle="PlanMint se adapta a diferentes necesidades. Descubre cómo puede ayudarte."
      />

      {/* Use Cases Grid */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {useCases.map((useCase) => {
              const Icon = iconMap[useCase.slug] || Target;
              return (
                <motion.div key={useCase.slug} variants={fadeInUp}>
                  <Card className="group h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                    <CardContent className="p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <Link to={`/use-cases/${useCase.slug}`}>
                        <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                          {useCase.title}
                        </h2>
                      </Link>
                      <p className="mt-3 text-muted-foreground">
                        {useCase.heroDescription}
                      </p>
                      <Link 
                        to={`/use-cases/${useCase.slug}`}
                        className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
                      >
                        Ver más
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <PageCTA
        title="¿No ves tu caso de uso?"
        subtitle="PlanMint es flexible y se adapta a muchas situaciones. Pruébalo gratis y descubre cómo puede ayudarte."
      />
    </PublicLayout>
  );
};
