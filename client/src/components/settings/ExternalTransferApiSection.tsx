import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, KeyRound, Loader2, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type ApiKeyRecord = {
  id: string;
  name: string;
  key_preview: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  rate_limit_per_minute: number;
};

async function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token || ""}`,
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "La operación no pudo completarse");
  return body as T;
}

export function ExternalTransferApiSection() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const result = await authenticatedRequest<{ success: true; data: ApiKeyRecord[] }>("/api/external/v1/keys");
      setKeys(result.data);
    } catch (error) {
      toast({ title: "No se pudieron cargar las claves", description: error instanceof Error ? error.message : "Error desconocido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const activeKey = keys.find((key) => key.is_active);

  const createKey = async () => {
    setWorking(true);
    try {
      const result = await authenticatedRequest<{ success: true; data: { api_key: string } }>("/api/external/v1/keys", {
        method: "POST",
        body: JSON.stringify({
          name: "Comerciales · Clave compartida",
          permissions: ["transfers.create", "transfers.read", "transfers.cancel", "webhooks.manage"],
          rate_limit_per_minute: 60,
        }),
      });
      setRevealedKey(result.data.api_key);
      await loadKeys();
    } catch (error) {
      toast({ title: "No se pudo crear la clave", description: error instanceof Error ? error.message : "Error desconocido", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const rotateKey = async () => {
    if (!activeKey || !window.confirm("La clave actual dejará de funcionar inmediatamente. ¿Continuar?")) return;
    setWorking(true);
    try {
      const result = await authenticatedRequest<{ success: true; data: { api_key: string } }>(`/api/external/v1/keys/${activeKey.id}/rotate`, { method: "POST" });
      setRevealedKey(result.data.api_key);
      await loadKeys();
    } catch (error) {
      toast({ title: "No se pudo rotar la clave", description: error instanceof Error ? error.message : "Error desconocido", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const revokeKey = async () => {
    if (!activeKey || !window.confirm("La integración dejará de funcionar. ¿Revocar la clave compartida?")) return;
    setWorking(true);
    try {
      await authenticatedRequest(`/api/external/v1/keys/${activeKey.id}`, { method: "DELETE" });
      setRevealedKey(null);
      await loadKeys();
    } catch (error) {
      toast({ title: "No se pudo revocar la clave", description: error instanceof Error ? error.message : "Error desconocido", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    toast({ title: "Clave copiada", description: "Guárdala en el gestor de secretos del software comercial." });
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando API…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">API bidireccional para comerciales</p>
          <p className="text-sm text-muted-foreground">Una clave compartida permite crear solicitudes, consultar todas las de Azul Cars, cancelar y configurar webhooks.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/external/v1/docs" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Documentación</a>
        </Button>
      </div>

      {revealedKey && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <KeyRound className="h-4 w-4" />
          <AlertTitle>Copia esta clave ahora</AlertTitle>
          <AlertDescription className="space-y-3">
            <code className="block break-all rounded bg-white p-3 text-xs">{revealedKey}</code>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copyKey}><Copy className="mr-2 h-4 w-4" />Copiar clave</Button>
              <Button size="sm" variant="outline" onClick={() => setRevealedKey(null)}>Ya la he guardado</Button>
            </div>
            <p className="text-xs">No volverá a mostrarse. No la envíes por correo ni la incluyas en código fuente.</p>
          </AlertDescription>
        </Alert>
      )}

      {activeKey ? (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><span className="font-medium">{activeKey.name}</span><Badge>Activa</Badge></div>
            <code className="text-xs text-muted-foreground">{activeKey.key_preview}</code>
          </div>
          <div className="flex flex-wrap gap-1.5">{activeKey.permissions.map((scope) => <Badge key={scope} variant="secondary">{scope}</Badge>)}</div>
          <p className="text-xs text-muted-foreground">Límite: {activeKey.rate_limit_per_minute} peticiones/min · Último uso: {activeKey.last_used_at ? new Date(activeKey.last_used_at).toLocaleString() : "Nunca"}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={rotateKey} disabled={working}><RotateCcw className="mr-2 h-4 w-4" />Rotar</Button>
            <Button variant="destructive" size="sm" onClick={revokeKey} disabled={working}><Trash2 className="mr-2 h-4 w-4" />Revocar</Button>
            <Button variant="ghost" size="sm" onClick={loadKeys} disabled={working}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-5 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Todavía no existe una clave compartida activa.</p>
          <Button onClick={createKey} disabled={working}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Crear clave compartida</Button>
        </div>
      )}
    </div>
  );
}
