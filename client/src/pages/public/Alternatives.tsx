import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { PageCTA } from '@/components/public/PageCTA';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { alternatives } from '@/data/alternatives';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { ArrowRight, Scale } from 'lucide-react';

export const Alternatives = () => {
  return (
    <PublicLayout>
      <SEOHead
        title="Alternativas | PlanMint"
        description="Compara PlanMint con Trello, Asana, Notion y Monday. Comparativas honestas para elegir la herramienta que mejor se adapte a ti."
        canonical="/alternatives"
      />

      <PageHero
        title="PlanMint vs alternativas"
        subtitle="Comparativas honestas para ayudarte a elegir la herramienta correcta."
      />

      {/* Alternatives Grid */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid gap-8 md:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {alternatives.map((alt) => (
              <motion.div key={alt.slug} variants={fadeInUp}>
                <Card className="group h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Scale className="h-6 w-6 text-primary" />
                      <h2 className="text-xl font-semibold">
                        PlanMint vs {alt.name}
                      </h2>
                    </div>
                    <p className="text-muted-foreground line-clamp-3">
                      {alt.description}
                    </p>
                    <Link 
                      to={`/alternatives/${alt.slug}`}
                      className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
                    >
                      Ver comparativa completa
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <PageCTA
        title="Prueba PlanMint gratis"
        subtitle="La mejor forma de comparar es probarlo. Sin compromiso."
      />
    </PublicLayout>
  );
};
