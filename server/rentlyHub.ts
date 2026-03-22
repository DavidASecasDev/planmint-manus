/**
 * POST /api/rently-hub
 * Migrated from Supabase Edge Function rently-hub.
 * Generic proxy for the Rently API with domain registry.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

const REQUEST_TIMEOUT_MS = 30000;

// ─── Domain Registry ─────────────────────────────────────────────────────────

const DOMAIN_REGISTRY = [
  {
    name: "bookings",
    label: "Reservas",
    description: "Gestión de reservas y alquileres",
    syncStrategy: "incremental",
    endpoints: [
      { method: "list", path: "/api/bookings", description: "Listar reservas", type: "GET" },
      { method: "get", path: "/api/booking/{id}", description: "Detalle de reserva", type: "GET" },
      { method: "drivers", path: "/api/booking/{id}/drivers", description: "Conductores de reserva", type: "GET" },
    ],
  },
  {
    name: "vehicles",
    label: "Vehículos",
    description: "Gestión de flota de vehículos",
    syncStrategy: "full",
    endpoints: [
      { method: "list", path: "/api/cars", description: "Listar vehículos", type: "GET" },
      { method: "get", path: "/api/car/{id}", description: "Detalle de vehículo", type: "GET" },
    ],
  },
  {
    name: "customers",
    label: "Clientes",
    description: "Gestión de clientes",
    syncStrategy: "incremental",
    endpoints: [
      { method: "list", path: "/api/customers", description: "Listar clientes", type: "GET" },
      { method: "get", path: "/api/customer/{id}", description: "Detalle de cliente", type: "GET" },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getRentlyCredentials(organizationId: string) {
  const serviceClient = getServiceClient();
  const { data: settings, error } = await serviceClient
    .from("integration_settings")
    .select("rently_api_host, rently_client_id, rently_client_secret")
    .eq("organization_id", organizationId)
    .single();

  if (error || !settings?.rently_client_id || !settings?.rently_client_secret) {
    throw new Error("Rently no está configurado");
  }

  return {
    host: settings.rently_api_host || "azul.rently.com.ar",
    clientId: settings.rently_client_id,
    clientSecret: settings.rently_client_secret,
  };
}

async function getRentlyToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auth failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout obteniendo token de Rently");
    throw error;
  }
}

async function callRentlyApi(host: string, token: string, endpoint: string, method: string = "GET"): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Rently API Error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") throw new Error("Timeout calling Rently API");
    throw error;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function handleRentlyHub(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { action, domain, method, params, endpoint, httpMethod } = req.body || {};

    switch (action) {
      case "registry":
        return res.json({
          success: true,
          domains: DOMAIN_REGISTRY,
          totalDomains: DOMAIN_REGISTRY.length,
          totalEndpoints: DOMAIN_REGISTRY.reduce((sum, d) => sum + d.endpoints.length, 0),
        });

      case "test": {
        const creds = await getRentlyCredentials(organizationId);
        await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        return res.json({ success: true, message: "Conexión exitosa" });
      }

      case "query": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);

        const domainInfo = DOMAIN_REGISTRY.find((d) => d.name === domain);
        if (!domainInfo) return res.json({ success: false, error: `Dominio no encontrado: ${domain}` });

        const endpointInfo = domainInfo.endpoints.find((e) => e.method === method);
        if (!endpointInfo) return res.json({ success: false, error: `Método no encontrado: ${method}` });

        let path = endpointInfo.path;
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            path = path.replace(`{${key}}`, String(value));
          });
          // Add query params
          const queryParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (!endpointInfo.path.includes(`{${key}}`)) {
              queryParams.set(key, String(value));
            }
          });
          const qs = queryParams.toString();
          if (qs) path += `?${qs}`;
        }

        const startTime = Date.now();
        const data = await callRentlyApi(creds.host, token, path, endpointInfo.type);
        const elapsed = Date.now() - startTime;

        return res.json({ success: true, data, domain, method, elapsed });
      }

      case "explore": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);

        let path = endpoint || "/api/bookings";
        if (params) {
          const queryParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => queryParams.set(key, String(value)));
          const qs = queryParams.toString();
          if (qs) path += `?${qs}`;
        }

        const startTime = Date.now();
        const data = await callRentlyApi(creds.host, token, path, httpMethod || "GET");
        const elapsed = Date.now() - startTime;

        return res.json({ success: true, data, raw: data, elapsed });
      }

      default:
        return res.json({ success: false, error: `Acción no reconocida: ${action}` });
    }
  } catch (error: any) {
    console.error("[rently-hub] Error:", error);
    const status = error instanceof AuthError ? error.status : 500;
    return res.status(status).json({ success: false, error: error?.message || "Error desconocido" });
  }
}
