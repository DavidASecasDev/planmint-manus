import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { SEOHead } from '@/components/seo/SEOHead';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Check,
  X,
  Zap,
  Crown,
  Building2,
} from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Para uso personal o probar la app',
    price: '0',
    icon: Zap,
    features: [
      { text: '1 usuario', included: true },
      { text: '20 tareas', included: true },
      { text: '2 áreas', included: true },
      { text: '5 etiquetas', included: true },
      { text: 'Kanban y Calendario', included: true },
      { text: 'Recordatorios puntuales', included: true },
      { text: 'Recordatorios recurrentes', included: false },
      { text: 'IA (resúmenes)', included: false },
      { text: 'Notificaciones externas', included: false },
    ],
    cta: 'Crear cuenta',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Para profesionales y pequeños equipos',
    price: '9',
    icon: Crown,
    features: [
      { text: 'Hasta 5 usuarios', included: true },
      { text: 'Tareas ilimitadas', included: true },
      { text: 'Áreas ilimitadas', included: true },
      { text: 'Etiquetas ilimitadas', included: true },
      { text: 'Kanban y Calendario', included: true },
      { text: 'Recordatorios recurrentes', included: true },
      { text: 'IA (resúmenes manuales)', included: true },
      { text: 'Push y Email', included: true },
      { text: 'Soporte prioritario', included: false },
    ],
    cta: 'Empezar Pro',
    highlighted: true,
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Para equipos grandes con necesidades avanzadas',
    price: '29',
    icon: Building2,
    features: [
      { text: 'Usuarios ilimitados', included: true },
      { text: 'Todo ilimitado', included: true },
      { text: 'IA completa (insights y alertas)', included: true },
      { text: 'Slack y WhatsApp', included: true },
      { text: 'Soporte prioritario', included: true },
      { text: 'Todo de Pro', included: true },
    ],
    cta: 'Empezar Team',
    highlighted: false,
  },
];

export const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePlanClick = async (planId: string) => {
    if (planId === 'free') {
      navigate('/register');
      return;
    }

    if (!user) {
      localStorage.setItem('intended_plan', planId);
      navigate('/register');
      return;
    }

    setLoadingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: planId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Error al iniciar el proceso de pago');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <PublicLayout>
      <SEOHead
        title="Planes y precios | PlanMint"
        description="Elige el plan ideal para gestionar tareas, objetivos y equipos con PlanMint. Free, Pro y Team."
        canonical="/pricing"
      />

      <PageHero
        title="Precios simples y transparentes"
        subtitle="Elige el plan que mejor se adapte a tus necesidades."
      />

      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid gap-8 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {plans.map((plan) => (
              <motion.div key={plan.id} variants={fadeInUp}>
                <Card
                  className={`relative flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30 ${
                    plan.highlighted
                      ? 'border-primary shadow-lg scale-105'
                      : ''
                  }`}
                >
                  {plan.highlighted && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Más popular
                    </Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <plan.icon className="h-6 w-6 text-primary" />
                      <CardTitle>{plan.name}</CardTitle>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">{plan.price}€</span>
                      {plan.price !== '0' && (
                        <span className="text-muted-foreground">/mes</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          {feature.included ? (
                            <Check className="h-5 w-5 text-primary" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span
                            className={
                              feature.included ? '' : 'text-muted-foreground'
                            }
                          >
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-8 w-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                      onClick={() => handlePlanClick(plan.id)}
                      disabled={loadingPlan === plan.id}
                    >
                      {loadingPlan === plan.id ? 'Cargando...' : plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-16 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="text-muted-foreground">
              ¿Tienes preguntas? Escríbenos a{' '}
              <a
                href="mailto:soporte@planmint.app"
                className="text-primary hover:underline"
              >
                soporte@planmint.app
              </a>
            </p>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
};
