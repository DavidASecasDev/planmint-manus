/*
 * PlanMint Pricing Page — Mint Fresh Design
 * Three-column pricing cards, mint accent on popular plan.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  desc: string;
  price: string;
  period: string;
  popular: boolean;
  features: PlanFeature[];
  cta: string;
}

const plans: Plan[] = [
  {
    name: "Free",
    desc: "Para uso personal o probar la app",
    price: "0€",
    period: "",
    popular: false,
    features: [
      { text: "1 usuario", included: true },
      { text: "20 tareas", included: true },
      { text: "2 áreas", included: true },
      { text: "5 etiquetas", included: true },
      { text: "Kanban y Calendario", included: true },
      { text: "Recordatorios puntuales", included: true },
      { text: "Recordatorios recurrentes", included: false },
      { text: "IA (resúmenes)", included: false },
      { text: "Notificaciones externas", included: false },
    ],
    cta: "Crear cuenta",
  },
  {
    name: "Pro",
    desc: "Para profesionales y pequeños equipos",
    price: "9€",
    period: "/mes",
    popular: true,
    features: [
      { text: "Hasta 5 usuarios", included: true },
      { text: "Tareas ilimitadas", included: true },
      { text: "Áreas ilimitadas", included: true },
      { text: "Etiquetas ilimitadas", included: true },
      { text: "Kanban y Calendario", included: true },
      { text: "Recordatorios recurrentes", included: true },
      { text: "IA (resúmenes manuales)", included: true },
      { text: "Push y Email", included: true },
      { text: "Soporte prioritario", included: false },
    ],
    cta: "Empezar Pro",
  },
  {
    name: "Team",
    desc: "Para equipos grandes con necesidades avanzadas",
    price: "29€",
    period: "/mes",
    popular: false,
    features: [
      { text: "Usuarios ilimitados", included: true },
      { text: "Todo ilimitado", included: true },
      { text: "IA completa (insights y alertas)", included: true },
      { text: "Slack y WhatsApp", included: true },
      { text: "Soporte prioritario", included: true },
      { text: "Todo de Pro", included: true },
    ],
    cta: "Empezar Team",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-4">
              Precios simples y transparentes
            </h1>
            <p className="text-lg text-muted-foreground">
              Elige el plan que mejor se adapte a tus necesidades.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className={`relative rounded-xl border p-7 ${
                  plan.popular
                    ? "border-primary shadow-xl shadow-primary/10 bg-white"
                    : "border-border/60 bg-white"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                    Más popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-black text-foreground">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2.5 text-sm">
                      {f.included ? (
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                      )}
                      <span className={f.included ? "text-foreground" : "text-muted-foreground/60"}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href="/register">
                  <Button
                    className={`w-full h-11 text-sm font-semibold ${
                      plan.popular
                        ? "bg-primary hover:bg-primary/90"
                        : "bg-transparent border border-border hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-10">
            ¿Tienes preguntas? Escríbenos a{" "}
            <a href="mailto:soporte@planmint.app" className="text-primary hover:underline">
              soporte@planmint.app
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
