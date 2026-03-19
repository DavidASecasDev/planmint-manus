/*
 * PlanMint Landing Page — "Mint Fresh" Design
 * Full-width sections, Geist typography as hero element,
 * mint accent only on CTAs, fast fade-in animations.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Target,
  Bell,
  Search,
  Sparkles,
  User,
  Briefcase,
  Users,
  Building2,
  CheckCircle2,
  ArrowRight,
  Calendar,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const DASHBOARD_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/planmint-dashboard-mockup-Uj6jd3NcCjnNcjkvoVnsrW.webp";
const KANBAN_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/planmint-kanban-view-DLP7Vkqv5MXSVpxziqNrg5.webp";
const CALENDAR_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/planmint-calendar-view-ANcvboL85YVgdjUKRW8JZB.webp";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

const features = [
  { icon: LayoutGrid, title: "Kanban + Calendario", desc: "Visualiza tus tareas como quieras. Arrastra y organiza con facilidad." },
  { icon: Target, title: "Objetivos medibles", desc: "Define metas numéricas y por hitos. Alcánzalas paso a paso." },
  { icon: Bell, title: "Recordatorios", desc: "Nunca olvides una fecha límite. Push, email y más." },
  { icon: Search, title: "Búsqueda global", desc: "Encuentra cualquier cosa al instante con ⌘K." },
  { icon: Sparkles, title: "IA útil", desc: "Resúmenes, insights y alertas inteligentes para tu equipo." },
  { icon: Calendar, title: "Vista calendario", desc: "Planifica tu semana con una vista clara de todas tus tareas." },
];

const steps = [
  { num: "1", title: "Crea tu tarea u objetivo", desc: "Simple, numérico o por hitos. Tú eliges." },
  { num: "2", title: "Organiza por áreas y tags", desc: "Trabajo, personal, finanzas... lo que necesites." },
  { num: "3", title: "Avanza con recordatorios", desc: "Registra progreso y mantente al día." },
];

const personas = [
  { icon: User, title: "Personal", desc: "Organiza tu vida diaria" },
  { icon: Briefcase, title: "Freelancers", desc: "Gestiona proyectos y clientes" },
  { icon: Users, title: "Equipos pequeños", desc: "Colabora con tu equipo" },
  { icon: Building2, title: "Operaciones", desc: "Flotas, agencias, talleres..." },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="container pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0}
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-mint-50 border border-mint-200 text-mint-600 text-xs font-medium mb-6"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Diseñado para uso personal y equipos
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              custom={1}
              variants={fadeUp}
              className="text-5xl md:text-7xl font-black tracking-tight text-foreground leading-[1.05]"
            >
              Organiza{" "}
              <span className="text-primary">con claridad</span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              custom={2}
              variants={fadeUp}
              className="mt-5 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              Kanban, calendario, recordatorios, notificaciones y resúmenes con IA.
              Todo en un solo lugar.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              custom={3}
              variants={fadeUp}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link href="/register">
                <Button size="lg" className="text-base font-semibold px-8 bg-primary hover:bg-primary/90 h-12">
                  Empezar gratis <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="text-base font-medium px-8 h-12">
                  Ver precios
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <div className="rounded-xl border border-border/60 shadow-2xl shadow-black/5 overflow-hidden bg-white">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
                <span className="ml-3 text-xs text-muted-foreground font-medium">PlanMint — Dashboard</span>
              </div>
              <img
                src={DASHBOARD_IMG}
                alt="PlanMint Dashboard"
                className="w-full"
                loading="eager"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="bg-mint-50/50 py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              Todo lo que necesitas
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Herramientas diseñadas para que te centres en lo importante
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                custom={i}
                variants={fadeUp}
                className="bg-white rounded-lg border border-border/50 p-6 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-mint-100 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── KANBAN SHOWCASE ─── */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                Vista Kanban
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4">
                Arrastra, organiza y avanza
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Visualiza el estado de cada tarea con columnas personalizables. Mueve tareas entre estados con un simple drag & drop. Filtra por etiquetas, asignados o fechas.
              </p>
              <ul className="space-y-3">
                {["Columnas personalizables", "Drag & drop intuitivo", "Filtros avanzados", "Etiquetas de color"].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-xl border border-border/60 shadow-xl shadow-black/5 overflow-hidden"
            >
              <img src={KANBAN_IMG} alt="Vista Kanban de PlanMint" className="w-full" loading="lazy" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── CALENDAR SHOWCASE ─── */}
      <section className="bg-mint-50/50 py-20 md:py-28">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-xl border border-border/60 shadow-xl shadow-black/5 overflow-hidden order-2 lg:order-1"
            >
              <img src={CALENDAR_IMG} alt="Vista Calendario de PlanMint" className="w-full" loading="lazy" />
            </motion.div>
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                Vista Calendario
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4">
                Planifica tu semana de un vistazo
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Ve todas tus tareas y deadlines en una vista mensual o semanal. Identifica conflictos de agenda y redistribuye tu carga de trabajo fácilmente.
              </p>
              <ul className="space-y-3">
                {["Vista mensual y semanal", "Tareas con colores por área", "Recordatorios integrados", "Sincronización con Google Calendar"].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              Cómo funciona
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Tres pasos para empezar
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary text-white text-lg font-bold flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PERSONAS ─── */}
      <section className="bg-mint-50/50 py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              Para quién es
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Diseñado para adaptarse a diferentes necesidades
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {personas.map((p, i) => (
              <motion.div
                key={p.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="bg-white rounded-lg border border-border/50 p-6 text-center hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-full bg-mint-100 flex items-center justify-center mx-auto mb-4">
                  <p.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4">
              Empieza gratis en 30 segundos
            </h2>
            <p className="text-muted-foreground mb-8">
              Sin tarjeta de crédito. Cancela cuando quieras.
            </p>
            <Link href="/register">
              <Button size="lg" className="text-base font-semibold px-10 bg-primary hover:bg-primary/90 h-12">
                Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
