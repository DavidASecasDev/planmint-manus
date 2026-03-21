/*
 * Azul Cars Brand — 404 Not Found Page
 * Split layout matching Login: navy left panel with particle logo animation | warm right panel with error info
 * Gold accent: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ParticleLogos } from "@/components/effects/ParticleLogos";
import {
  LayoutDashboard,
  ClipboardList,
  Car,
  CalendarDays,
  ArrowLeft,
  Search,
  Ship,
  Wrench,
  Users,
  Bell,
} from "lucide-react";

/* ── Brand tokens ── */
const brand = {
  navy: "#001321",
  gold: "oklch(0.72 0.10 80)",
  warmBg: "#F5F3EF",
  textDark: "#0F1216",
  textMuted: "#52555B",
  textWhite: "#FFFFFF",
  textWhiteMuted: "rgba(255,255,255,0.55)",
  borderLight: "rgba(0,19,33,0.08)",
};

/* ── Quick-nav suggestions ── */
const quickLinks = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, description: "Panel principal" },
  { label: "Tareas", path: "/tasks", icon: ClipboardList, description: "Gestión de tareas" },
  { label: "Vehículos", path: "/vehicles", icon: Car, description: "Flota de vehículos" },
  { label: "Calendario", path: "/calendar", icon: CalendarDays, description: "Agenda y eventos" },
  { label: "Transfers", path: "/transfers", icon: Ship, description: "Solicitudes de transfer" },
  { label: "Taller", path: "/garatech", icon: Wrench, description: "Reparaciones y daños" },
  { label: "Equipos", path: "/teams", icon: Users, description: "Gestión de equipos" },
  { label: "Notificaciones", path: "/notifications", icon: Bell, description: "Centro de avisos" },
];

/* ── Contextual suggestion based on URL ── */
function getSuggestion(pathname: string): string {
  if (pathname.startsWith("/transfers")) {
    return "Parece que buscabas algo en Transfers. La solicitud puede haber sido eliminada o el enlace es incorrecto.";
  }
  if (pathname.startsWith("/garatech")) {
    return "Parece que buscabas algo en el módulo de Taller. El registro puede haber sido eliminado o movido.";
  }
  if (pathname.startsWith("/tasks")) {
    return "Parece que buscabas una tarea. Puede que haya sido archivada o eliminada.";
  }
  if (pathname.startsWith("/fleet") || pathname.startsWith("/vehicles")) {
    return "Parece que buscabas un vehículo. Puede que haya sido dado de baja o el enlace sea incorrecto.";
  }
  if (pathname.startsWith("/teams")) {
    return "Parece que buscabas un equipo. Puede que haya sido reorganizado o eliminado.";
  }
  return "La página que buscas no existe o fue movida. Usa los enlaces de abajo para navegar.";
}

/* ── Navy Panel (reused from Login) ── */
function NavyPanel() {
  const [currentLogo, setCurrentLogo] = useState("Azul Cars");
  const [fadeKey, setFadeKey] = useState(0);

  const handleLogoChange = useCallback((logoName: string) => {
    setCurrentLogo(logoName);
    setFadeKey((prev) => prev + 1);
  }, []);

  return (
    <div
      className="hidden lg:flex lg:w-[45%] flex-col relative overflow-hidden"
      style={{ backgroundColor: brand.navy }}
    >
      <ParticleLogos onLogoChange={handleLogoChange} />

      <div className="relative z-10 flex flex-col justify-between h-full p-12">
        {/* Top: Brand mark */}
        <div>
          <span
            className="text-3xl"
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color: brand.textWhite,
            }}
          >
            AZUL<span style={{ color: brand.gold }}>.</span>
          </span>
        </div>

        {/* Center: 404 large number */}
        <div className="flex flex-col items-center justify-center flex-1">
          <span
            className="text-[10rem] leading-none font-black select-none"
            style={{
              fontFamily: "Montserrat, sans-serif",
              color: "rgba(255,255,255,0.04)",
              letterSpacing: "-0.05em",
            }}
          >
            404
          </span>
        </div>

        {/* Bottom: Current logo name */}
        <div>
          <p
            key={fadeKey}
            className="text-sm tracking-widest uppercase mb-3"
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 600,
              color: brand.textWhiteMuted,
              letterSpacing: "0.15em",
              animation: "fadeInUp 0.6s ease-out",
            }}
          >
            {currentLogo}
          </p>
          <div
            style={{
              height: "2px",
              width: "60px",
              background: brand.gold,
              marginBottom: "12px",
            }}
          />
          <p
            style={{
              fontFamily: "Barlow, sans-serif",
              fontSize: "0.85rem",
              color: brand.textWhiteMuted,
              maxWidth: "280px",
              lineHeight: 1.6,
            }}
          >
            Plataforma de gestión integral para las empresas del grupo.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const suggestion = useMemo(() => getSuggestion(location.pathname), [location.pathname]);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
      {/* Left: Navy panel with particle animation */}
      <NavyPanel />

      {/* Right: Error content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-lg">
          {/* Mobile-only brand */}
          <div className="lg:hidden mb-10 text-center">
            <span
              className="text-2xl"
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                color: brand.textDark,
              }}
            >
              AZUL<span style={{ color: brand.gold }}>.</span>
            </span>
          </div>

          {/* Error header */}
          <div className="text-center lg:text-left mb-8">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{
                backgroundColor: "rgba(209,178,118,0.12)",
                border: "1px solid rgba(209,178,118,0.25)",
              }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: brand.gold }} />
              <span
                className="text-xs font-medium tracking-wide uppercase"
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  color: brand.gold,
                }}
              >
                Página no encontrada
              </span>
            </div>

            <h1
              className="text-4xl lg:text-5xl font-black mb-4"
              style={{
                fontFamily: "Montserrat, sans-serif",
                color: brand.textDark,
                lineHeight: 1.1,
              }}
            >
              Error <span style={{ color: brand.gold }}>404</span>
            </h1>

            <p
              className="text-base leading-relaxed"
              style={{
                fontFamily: "Barlow, sans-serif",
                color: brand.textMuted,
                maxWidth: "420px",
              }}
            >
              {suggestion}
            </p>
          </div>

          {/* URL attempted */}
          <div
            className="rounded-lg px-4 py-3 mb-8"
            style={{
              backgroundColor: "rgba(0,19,33,0.04)",
              border: `1px solid ${brand.borderLight}`,
            }}
          >
            <p
              className="text-xs uppercase tracking-wider mb-1"
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 600,
                color: brand.textMuted,
              }}
            >
              URL solicitada
            </p>
            <p
              className="text-sm font-mono break-all"
              style={{ color: brand.textDark }}
            >
              {location.pathname}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:opacity-90"
              style={{
                fontFamily: "Montserrat, sans-serif",
                backgroundColor: brand.navy,
                color: brand.textWhite,
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver atrás
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:opacity-90"
              style={{
                fontFamily: "Montserrat, sans-serif",
                backgroundColor: brand.gold,
                color: brand.navy,
              }}
            >
              <LayoutDashboard className="w-4 h-4" />
              Ir al Dashboard
            </button>
          </div>

          {/* Quick navigation grid */}
          <div>
            <p
              className="text-xs uppercase tracking-wider mb-4"
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 600,
                color: brand.textMuted,
              }}
            >
              Accesos rápidos
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="group flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all duration-200 hover:shadow-md"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: `1px solid ${brand.borderLight}`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 group-hover:scale-105"
                      style={{
                        backgroundColor: "rgba(209,178,118,0.10)",
                      }}
                    >
                      <Icon
                        className="w-5 h-5 transition-colors duration-200"
                        style={{ color: brand.gold }}
                      />
                    </div>
                    <span
                      className="text-xs font-semibold"
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        color: brand.textDark,
                      }}
                    >
                      {link.label}
                    </span>
                    <span
                      className="text-[10px] leading-tight hidden sm:block"
                      style={{
                        fontFamily: "Barlow, sans-serif",
                        color: brand.textMuted,
                      }}
                    >
                      {link.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
