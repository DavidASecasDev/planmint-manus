/*
 * PlanMint Features Page — Mint Fresh Design
 * Detailed feature showcase with mockup images.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  Target,
  Bell,
  Search,
  Sparkles,
  Calendar,
  Users,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

const KANBAN_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/planmint-kanban-view-DLP7Vkqv5MXSVpxziqNrg5.webp";
const CALENDAR_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/planmint-calendar-view-ANcvboL85YVgdjUKRW8JZB.webp";
const DASHBOARD_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/planmint-dashboard-mockup-Uj6jd3NcCjnNcjkvoVnsrW.webp";

const allFeatures = [
  { icon: LayoutGrid, title: "Kanban Board", desc: "Visualiza tus tareas en columnas personalizables. Arrastra y suelta para cambiar estados." },
  { icon: Calendar, title: "Calendario", desc: "Vista mensual y semanal de todas tus tareas y deadlines." },
  { icon: Target, title: "Objetivos", desc: "Define metas numéricas y por hitos. Mide tu progreso en tiempo real." },
  { icon: Bell, title: "Recordatorios", desc: "Notificaciones push, email y recurrentes para no olvidar nada." },
  { icon: Search, title: "Búsqueda global ⌘K", desc: "Encuentra cualquier tarea, área o etiqueta al instante." },
  { icon: Sparkles, title: "IA integrada", desc: "Resúmenes automáticos, insights de productividad y alertas inteligentes." },
  { icon: Users, title: "Equipos", desc: "Invita a tu equipo, asigna tareas y colabora en tiempo real." },
  { icon: Shield, title: "Seguridad", desc: "Cifrado end-to-end, RLS por tenant, backups automáticos." },
  { icon: Zap, title: "Integraciones", desc: "Conecta con Slack, WhatsApp, Google Calendar y más." },
];

export default function Features() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-4">
              Todo lo que necesitas para avanzar
            </h1>
            <p className="text-lg text-muted-foreground">
              Herramientas potentes, diseño simple. Cada funcionalidad pensada para que te centres en lo importante.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {allFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
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

      {/* Showcase: Kanban */}
      <section className="bg-mint-50/50 py-20 md:py-28">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Kanban</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-4">
                Gestión visual de tareas
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Organiza tu trabajo en columnas que representan cada etapa del proceso. Mueve tareas con drag & drop y mantén la visibilidad total del estado de cada proyecto.
              </p>
              <ul className="space-y-2.5">
                {["Columnas personalizables", "Etiquetas de color", "Asignación de miembros", "Filtros avanzados"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border/60 shadow-xl shadow-black/5 overflow-hidden">
              <img src={KANBAN_IMG} alt="Vista Kanban" className="w-full" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Showcase: Calendar */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-xl border border-border/60 shadow-xl shadow-black/5 overflow-hidden order-2 lg:order-1">
              <img src={CALENDAR_IMG} alt="Vista Calendario" className="w-full" loading="lazy" />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Calendario</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-4">
                Planifica con claridad
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Visualiza todas tus tareas y deadlines en una vista mensual o semanal. Identifica conflictos y redistribuye tu carga de trabajo.
              </p>
              <ul className="space-y-2.5">
                {["Vista mensual y semanal", "Códigos de color por área", "Recordatorios integrados", "Sincronización externa"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase: Dashboard */}
      <section className="bg-mint-50/50 py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Dashboard</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-4">
              Todo de un vistazo
            </h2>
            <p className="text-muted-foreground">
              Tu panel de control con estadísticas, accesos rápidos y el estado de tu equipo.
            </p>
          </div>
          <div className="max-w-5xl mx-auto rounded-xl border border-border/60 shadow-xl shadow-black/5 overflow-hidden">
            <img src={DASHBOARD_IMG} alt="Dashboard de PlanMint" className="w-full" loading="lazy" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mb-4">
            Empieza a organizar hoy
          </h2>
          <p className="text-muted-foreground mb-8">
            Gratis para siempre. Sin tarjeta de crédito.
          </p>
          <Link href="/register">
            <Button size="lg" className="text-base font-semibold px-10 bg-primary hover:bg-primary/90 h-12">
              Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
