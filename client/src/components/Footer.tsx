/*
 * PlanMint Footer — Mint Fresh Design
 * Clean, minimal footer with links and copyright.
 */
import { Link } from "wouter";
import { Leaf } from "lucide-react";

const footerLinks = {
  Producto: [
    { href: "/features", label: "Funcionalidades" },
    { href: "/pricing", label: "Precios" },
    { href: "#", label: "Casos de uso" },
    { href: "#", label: "Alternativas" },
  ],
  Recursos: [
    { href: "#", label: "Blog" },
    { href: "#", label: "Documentación" },
    { href: "#", label: "Changelog" },
  ],
  Legal: [
    { href: "#", label: "Privacidad" },
    { href: "#", label: "Términos" },
    { href: "/security", label: "Seguridad" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-white">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Plan<span className="text-primary">Mint</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Organiza tareas, objetivos y equipos en un solo lugar.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} PlanMint. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/register" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
