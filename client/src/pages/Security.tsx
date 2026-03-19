/*
 * PlanMint Security Page — Mint Fresh Design
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Server, Eye, Database, Key, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

const securityFeatures = [
  { icon: Lock, title: "Cifrado en tránsito y reposo", desc: "Toda la comunicación usa TLS 1.3. Los datos se cifran con AES-256 en reposo." },
  { icon: Shield, title: "Row Level Security (RLS)", desc: "Cada tenant solo puede acceder a sus propios datos. Aislamiento total a nivel de base de datos." },
  { icon: Server, title: "Infraestructura en la nube", desc: "Alojado en Supabase (AWS eu-central-1). Backups automáticos cada 24h." },
  { icon: Eye, title: "Auditoría de accesos", desc: "Registro completo de quién accede a qué y cuándo. Trazabilidad total." },
  { icon: Database, title: "Backups automáticos", desc: "Copias de seguridad diarias con retención de 30 días. Restauración en minutos." },
  { icon: Key, title: "Autenticación segura", desc: "Contraseñas hasheadas con bcrypt. Soporte para 2FA y OAuth (Google, GitHub)." },
];

export default function Security() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="w-14 h-14 rounded-2xl bg-mint-100 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-4">
              Tu seguridad es nuestra prioridad
            </h1>
            <p className="text-lg text-muted-foreground">
              PlanMint está diseñado con seguridad desde el primer día. Tus datos están protegidos con las mejores prácticas de la industria.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {securityFeatures.map((f, i) => (
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

          <div className="text-center mt-16">
            <p className="text-muted-foreground mb-6">
              ¿Tienes preguntas sobre seguridad? Estamos aquí para ayudarte.
            </p>
            <Link href="/register">
              <Button size="lg" className="text-base font-semibold px-10 bg-primary hover:bg-primary/90 h-12">
                Empezar gratis <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
