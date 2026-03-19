import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageCTA } from '@/components/public/PageCTA';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAlternative } from '@/data/alternatives';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { ArrowRight, Check, X, Minus } from 'lucide-react';

export const AlternativeDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const alternative = slug ? getAlternative(slug) : undefined;

  if (!alternative) {
    return <Navigate to="/alternatives" replace />;
  }

  const renderComparisonValue = (value: string | boolean) => {
    if (value === true) {
      return <Check className="h-5 w-5 text-primary" />;
    }
    if (value === false) {
      return <X className="h-5 w-5 text-muted-foreground" />;
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <PublicLayout>
      <SEOHead
        title={alternative.metaTitle}
        description={alternative.metaDescription}
        canonical={`/alternatives/${alternative.slug}`}
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
              {alternative.heroTitle}
            </h1>
            <p className="mt-6 text-xl text-muted-foreground">
              {alternative.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* For Who */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid gap-8 md:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp}>
              <Card className="h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                <CardHeader>
                  <CardTitle>{alternative.name} es para ti si...</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {alternative.forWho.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Minus className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-primary">PlanMint es para ti si...</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {alternative.planmintForWho.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <motion.section
        className="py-16 bg-muted/30"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeInUp}
        transition={{ duration: 0.6 }}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8">
            Comparativa de funcionalidades
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-background rounded-lg overflow-hidden">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold">Funcionalidad</th>
                  <th className="text-center p-4 font-semibold">{alternative.name}</th>
                  <th className="text-center p-4 font-semibold text-primary">PlanMint</th>
                </tr>
              </thead>
              <tbody>
                {alternative.comparison.map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="p-4">{row.feature}</td>
                    <td className="p-4 text-center">
                      {renderComparisonValue(row.competitor)}
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      {renderComparisonValue(row.planmint)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      <PageCTA
        title="Prueba PlanMint gratis"
        subtitle="La mejor forma de comparar es probarlo. Sin tarjeta, sin compromiso."
      />
    </PublicLayout>
  );
};
