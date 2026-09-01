import { createRoot } from "react-dom/client";
import { Copy, ExternalLink, KeyRound, RotateCcw, ShieldCheck, Trash2, Webhook } from "lucide-react";
import "../index.css";

function Fixture() {
  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <section className="mx-auto max-w-3xl rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Ajustes · Transfers</p>
            <h1 className="mt-1 text-2xl font-semibold">API bidireccional para comerciales</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Una clave compartida permite crear solicitudes, consultar todas las de Azul Cars, cancelar y configurar webhooks.</p>
          </div>
          <button className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium"><ExternalLink className="mr-2 h-4 w-4" />Documentación</button>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><span className="font-medium">Comerciales · Clave compartida</span><span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">Activa</span></div>
            <code className="text-xs text-muted-foreground">pmk_a1b2c3d4_********************************</code>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['transfers.create', 'transfers.read', 'transfers.cancel', 'webhooks.manage'].map((scope) => <span key={scope} className="rounded-full border bg-white px-2.5 py-1 text-xs">{scope}</span>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Límite: 60 peticiones/min · Último uso: hace 4 minutos</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm"><RotateCcw className="mr-2 h-4 w-4" />Rotar</button>
            <button className="inline-flex h-9 items-center rounded-md bg-destructive px-3 text-sm text-destructive-foreground"><Trash2 className="mr-2 h-4 w-4" />Revocar</button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-4"><KeyRound className="h-5 w-5 text-emerald-700" /><h2 className="mt-3 font-medium">Clave mostrada una sola vez</h2><p className="mt-1 text-sm text-muted-foreground">La clave completa no se almacena ni vuelve a aparecer en PlanMint.</p><button className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"><Copy className="mr-2 h-4 w-4" />Copiar clave</button></div>
          <div className="rounded-xl border p-4"><Webhook className="h-5 w-5 text-emerald-700" /><h2 className="mt-3 font-medium">Webhooks firmados</h2><p className="mt-1 text-sm text-muted-foreground">Cambios de estado con firma HMAC, reintentos persistentes y prueba sintética.</p></div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("external-transfer-api-fixture-root")!).render(<Fixture />);
