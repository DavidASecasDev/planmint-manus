import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { PageCTA } from '@/components/public/PageCTA';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getUseCase } from '@/data/useCases';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { ArrowRight, Check, Quote } from 'lucide-react';

export const UseCaseDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const useCase = slug ? getUseCase(slug) : undefined;

  if (!useCase) {
    return <Navigate to="/use-cases" replace />;
  }

  return (
    <PublicLayout>
      <SEOHead
        title={useCase.metaTitle}
        description={useCase.metaDescription}
        canonical={`/use-cases/${useCase.slug}`}
      />

      {/* Hero */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-3xl"
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {useCase.heroTitle}
            </h1>
            <p className="mt-6 text-xl text-muted-foreground">
              {useCase.heroDescription}
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link to="/register">
                <Button size="lg">
                  Empezar gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">
                  Ver precios
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <motion.section
        className="py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold">{useCase.problemTitle}</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {useCase.problemDescription}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Benefits */}
      <section className="py-16 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-2xl font-bold text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            Cómo te ayuda PlanMint
          </motion.h2>
          <motion.div
            className="grid gap-8 sm:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {useCase.benefits.map((benefit, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold">{benefit.title}</h3>
                    <p className="mt-2 text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <motion.section
        className="py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-12">
            Funcionalidades incluidas
          </h2>
          <div className="max-w-2xl mx-auto">
            <ul className="grid gap-3 sm:grid-cols-2">
              {useCase.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.section>

      {/* Testimonial */}
      {useCase.testimonial && (
        <motion.section
          className="py-16 bg-muted/30"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <Quote className="h-10 w-10 text-primary mx-auto mb-6" />
            <blockquote className="text-xl italic">
              "{useCase.testimonial.quote}"
            </blockquote>
            <div className="mt-6">
              <p className="font-semibold">{useCase.testimonial.author}</p>
              <p className="text-sm text-muted-foreground">{useCase.testimonial.role}</p>
            </div>
          </div>
        </motion.section>
      )}

      <PageCTA
        title="Empieza gratis con PlanMint"
        subtitle="Sin tarjeta de crédito. Configura en 30 segundos."
        buttonText="Crear cuenta gratis"
      />
    </PublicLayout>
  );
};
