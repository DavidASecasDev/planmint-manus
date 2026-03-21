import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Download, X, Share, ChevronRight, Zap, WifiOff, Sparkles } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────
 * Detect platform for tailored messaging
 * ───────────────────────────────────────────────────────── */
type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/* ─────────────────────────────────────────────────────────
 * Feature pills shown inside the banner
 * ───────────────────────────────────────────────────────── */
const features = [
  { icon: Zap, label: "Acceso instantáneo" },
  { icon: WifiOff, label: "Funciona offline" },
  { icon: Sparkles, label: "Pantalla completa" },
];

/* ─────────────────────────────────────────────────────────
 * Main component
 *
 * Behavior:
 * - Chromium (desktop/Android): waits for `beforeinstallprompt` to fire
 *   (Chrome requires 30 s + 1 click engagement). Once the hook sets
 *   `isInstallable = true` the banner slides up after a short delay.
 * - iOS Safari: `beforeinstallprompt` never fires. We show the banner
 *   after 5 seconds with manual "Add to Home Screen" instructions.
 * ───────────────────────────────────────────────────────── */
export function InstallPrompt() {
  const { installApp, isInstallable, isInstalled, shouldShowInstallPrompt, dismissInstallPrompt } =
    usePWA();
  const [phase, setPhase] = useState<"hidden" | "entering" | "visible" | "leaving">("hidden");
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const shownRef = useRef(false);

  const platform = useMemo(() => detectPlatform(), []);

  /* ── Chromium path: react to isInstallable becoming true ── */
  useEffect(() => {
    if (shownRef.current) return;
    if (isInstalled) return;

    if (isInstallable && shouldShowInstallPrompt()) {
      // Small delay so the page doesn't feel jarring
      const timer = setTimeout(() => {
        shownRef.current = true;
        setPhase("entering");
        setTimeout(() => setPhase("visible"), 500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, shouldShowInstallPrompt]);

  /* ── iOS path: show after 5 seconds (no beforeinstallprompt) ── */
  useEffect(() => {
    if (shownRef.current) return;
    if (platform !== "ios") return;
    if (isInstalled) return;

    // Check dismiss state
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 3) return;
    }

    const timer = setTimeout(() => {
      shownRef.current = true;
      setPhase("entering");
      setTimeout(() => setPhase("visible"), 500);
    }, 5000);

    return () => clearTimeout(timer);
  }, [platform, isInstalled]);

  /* Dismiss with exit animation */
  const handleDismiss = useCallback(() => {
    setPhase("leaving");
    dismissInstallPrompt();
    setTimeout(() => setPhase("hidden"), 350);
  }, [dismissInstallPrompt]);

  /* Install (Chromium browsers) */
  const handleInstall = useCallback(async () => {
    const success = await installApp();
    if (success) {
      setPhase("leaving");
      setTimeout(() => setPhase("hidden"), 350);
    }
  }, [installApp]);

  /* iOS: show inline guide */
  const handleIOSGuide = useCallback(() => {
    setShowIOSGuide((prev) => !prev);
  }, []);

  if (phase === "hidden" || isInstalled) return null;

  /* ── Platform-specific CTA ── */
  const renderCTA = () => {
    if (platform === "ios") {
      return (
        <button
          onClick={handleIOSGuide}
          className={cn(
            "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl",
            "bg-[hsl(200,100%,6%)] text-white",
            "font-heading font-semibold text-sm tracking-wide",
            "transition-all duration-200",
            "hover:bg-[hsl(200,100%,9%)] active:scale-[0.98]"
          )}
        >
          <span className="flex items-center gap-2.5">
            <Share className="h-4 w-4 text-[hsl(37,45%,61%)]" />
            Cómo instalar en iOS
          </span>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-[hsl(37,45%,61%)] transition-transform duration-200",
              showIOSGuide && "rotate-90"
            )}
          />
        </button>
      );
    }

    return (
      <button
        onClick={handleInstall}
        className={cn(
          "w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl",
          "bg-[hsl(200,100%,6%)] text-white",
          "font-heading font-semibold text-sm tracking-wide",
          "transition-all duration-200",
          "hover:bg-[hsl(200,100%,9%)] active:scale-[0.98]",
          "shadow-lg shadow-[hsl(200,100%,6%)]/20"
        )}
      >
        <Download className="h-4 w-4 text-[hsl(37,45%,61%)]" />
        Instalar aplicación
      </button>
    );
  };

  return (
    <div
      className={cn(
        "fixed z-50",
        /* Mobile: full-width bottom sheet */
        "bottom-0 left-0 right-0",
        /* Desktop: card in bottom-right corner */
        "md:bottom-6 md:left-auto md:right-6 md:max-w-[380px]",
        /* Animations */
        phase === "entering" && "animate-banner-enter",
        phase === "leaving" && "animate-banner-leave",
        phase === "visible" && "translate-y-0 opacity-100"
      )}
      role="dialog"
      aria-label="Instalar aplicación"
    >
      {/* ── Backdrop glow (desktop only) ── */}
      <div className="hidden md:block absolute -inset-3 bg-[hsl(37,45%,61%)]/5 rounded-3xl blur-xl pointer-events-none" />

      {/* ── Card ── */}
      <div
        className={cn(
          "relative overflow-hidden",
          /* Mobile: bottom sheet with top rounded corners */
          "rounded-t-2xl md:rounded-2xl",
          "bg-white dark:bg-[hsl(207,55%,9%)]",
          "border border-[hsl(37,45%,61%)]/15 dark:border-[hsl(37,45%,61%)]/10",
          "shadow-2xl"
        )}
      >
        {/* ── Top gold accent line ── */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(37,45%,61%)] to-transparent" />

        {/* ── Mobile drag handle ── */}
        <div className="flex justify-center pt-2 pb-0 md:hidden">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* ── Close button ── */}
        <button
          onClick={handleDismiss}
          className={cn(
            "absolute top-3 right-3 z-10",
            "w-7 h-7 rounded-full flex items-center justify-center",
            "bg-muted/60 hover:bg-muted",
            "text-muted-foreground hover:text-foreground",
            "transition-colors duration-150"
          )}
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* ── Content ── */}
        <div className="px-5 pt-4 pb-5 md:px-6 md:pt-5 md:pb-6">
          {/* Header row */}
          <div className="flex items-center gap-3.5 pr-6">
            {/* App icon */}
            <div className="flex-shrink-0">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl overflow-hidden",
                  "ring-2 ring-[hsl(37,45%,61%)]/20",
                  "shadow-md"
                )}
              >
                <img
                  src="/icon-192.png"
                  alt="Azul Cars"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            </div>

            {/* Title & subtitle */}
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-base text-foreground leading-tight">
                Azul Cars
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                Gestión integral del grupo empresarial
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                  "bg-[hsl(37,45%,61%)]/8 dark:bg-[hsl(37,45%,61%)]/10",
                  "text-[11px] font-medium text-foreground/75"
                )}
              >
                <Icon className="h-3 w-3 text-[hsl(37,45%,61%)]" />
                {label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-4">
            {renderCTA()}
          </div>

          {/* iOS Guide (expandable) */}
          {platform === "ios" && showIOSGuide && (
            <div className="mt-3 space-y-2.5 animate-in">
              <IOSStep number={1}>
                Toca el botón <Share className="inline h-3.5 w-3.5 text-[hsl(37,45%,61%)] -mt-0.5" /> en la barra de Safari
              </IOSStep>
              <IOSStep number={2}>
                Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong>
              </IOSStep>
              <IOSStep number={3}>
                Toca <strong>"Añadir"</strong> para confirmar
              </IOSStep>
            </div>
          )}

          {/* Dismiss text link */}
          <button
            onClick={handleDismiss}
            className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-muted-foreground mt-3 transition-colors"
          >
            Ahora no, gracias
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * iOS step sub-component
 * ───────────────────────────────────────────────────────── */
function IOSStep({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
          "bg-[hsl(37,45%,61%)]/15 text-[hsl(37,45%,61%)]",
          "text-[10px] font-heading font-bold"
        )}
      >
        {number}
      </span>
      <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
        {children}
      </p>
    </div>
  );
}
