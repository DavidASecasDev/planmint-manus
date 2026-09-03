/**
 * POST /api/rently-hub
 * Migrated from Supabase Edge Function rently-hub.
 * Generic proxy for the Rently API with domain registry.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { getCachedRentlyToken, getRentlyCredentialsForOrganization } from './rentlyClient';

const REQUEST_TIMEOUT_MS = 30000;

// ─── Domain Registry ─────────────────────────────────────────────────────────

const DOMAIN_REGISTRY = [
  {
    name: "bookings",
    label: "Reservas",
    description: "Gestión de reservas y alquileres",
    syncStrategy: "incremental",
    endpoints: [
      { method: "list", path: "/api/bookings/list", description: "Listar reservas", type: "GET" },
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
      { method: "get", path: "/api/cars/{id}", description: "Detalle de vehículo", type: "GET" },
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

export async function getRentlyCredentials(organizationId: string) {
  return getRentlyCredentialsForOrganization(organizationId);
}

export async function getRentlyToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  return getCachedRentlyToken({ host, clientId, clientSecret });
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
        const queryParams = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            path = path.replace(`{${key}}`, String(value));
          });
          // Add query params
          Object.entries(params).forEach(([key, value]) => {
            if (!endpointInfo.path.includes(`{${key}}`)) {
              queryParams.set(key, String(value));
            }
          });
        }

        // For list endpoints, follow the official cursor and report any safety truncation.
        const isListEndpoint = method === "list";
        const MAX_PAGES = 100;
        const PAGE_SIZE = 100;

        if (isListEndpoint) {
          queryParams.set("limit", String(PAGE_SIZE));
          let allResults: unknown[] = [];
          let offset = 0;
          let total = 0;
          const startTime = Date.now();

          for (let page = 0; page < MAX_PAGES; page++) {
            queryParams.set("offset", String(offset));
            const qs = queryParams.toString();
            const fullPath = qs ? `${path}?${qs}` : path;
            const pageData = await callRentlyApi(creds.host, token, fullPath, endpointInfo.type) as any;

            if (pageData?.Results && Array.isArray(pageData.Results)) {
              allResults = allResults.concat(pageData.Results);
              total = pageData.Total || allResults.length;
              // If no more pages, stop
              if (!pageData.NextOffset || pageData.Results.length < PAGE_SIZE) break;
              offset = pageData.NextOffset;
            } else if (Array.isArray(pageData)) {
              allResults = pageData;
              total = pageData.length;
              break;
            } else {
              // Unknown format, return as-is
              const elapsed = Date.now() - startTime;
              return res.json({ success: true, data: pageData, domain, method, elapsed });
            }
          }

          const elapsed = Date.now() - startTime;
          const truncated = allResults.length < total;
          return res.json({
            success: true,
            data: { Results: allResults, Total: total, Limit: allResults.length, Offset: 0, truncated },
            domain,
            method,
            elapsed,
          });
        }

        // Non-list endpoints: single request
        const qs = queryParams.toString();
        if (qs) path += `?${qs}`;
        const startTime = Date.now();
        const data = await callRentlyApi(creds.host, token, path, endpointInfo.type);
        const elapsed = Date.now() - startTime;

        return res.json({ success: true, data, domain, method, elapsed });
      }

      case "places": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        const places = await callRentlyApi(creds.host, token, "/api/places");
        return res.json({ success: true, data: places });
      }

      case "categories": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        const categories = await callRentlyApi(creds.host, token, "/api/categories");
        return res.json({ success: true, data: categories });
      }

      case "payment_gateways": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        const gateways = await callRentlyApi(creds.host, token, "/api/configurations/gateways");
        return res.json({ success: true, data: gateways });
      }

      case "search_availability": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        const { fromDate, toDate, categoryId, deliveryPlaceId, returnPlaceId } = params || {};
        if (!fromDate || !toDate) return res.json({ success: false, error: "fromDate y toDate son requeridos" });
        const qp = new URLSearchParams({
          From: String(fromDate),
          To: String(toDate),
          ...(categoryId ? { CategoryId: String(categoryId) } : {}),
          ...(deliveryPlaceId ? { FromPlace: String(deliveryPlaceId) } : {}),
          ...(returnPlaceId ? { ToPlace: String(returnPlaceId) } : {}),
        });
        // If no ToPlace, default to FromPlace
        if (!returnPlaceId && deliveryPlaceId) qp.set("ToPlace", String(deliveryPlaceId));
        const data = await callRentlyApi(creds.host, token, `/api/search?${qp.toString()}`);
        return res.json({ success: true, data });
      }

      case "search_customers": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        const { query: searchQuery } = params || {};
        if (!searchQuery) return res.json({ success: false, error: "query es requerido" });
        const data = await callRentlyApi(creds.host, token, `/api/customers?filter=${encodeURIComponent(String(searchQuery))}&offset=0&limit=100`);
        return res.json({ success: true, data });
      }

      case "booking_price": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        const { fromDate, toDate, categoryId, deliveryPlaceId, returnPlaceId, carId } = params || {};
        if (!fromDate || !toDate || !categoryId) return res.json({ success: false, error: "fromDate, toDate y categoryId son requeridos" });
        const qp = new URLSearchParams({
          From: String(fromDate),
          To: String(toDate),
          CategoryId: String(categoryId),
          ...(deliveryPlaceId ? { FromPlace: String(deliveryPlaceId) } : {}),
          ...(returnPlaceId ? { ToPlace: String(returnPlaceId) } : {}),
          ...(carId ? { CarId: String(carId) } : {}),
        });
        if (!returnPlaceId && deliveryPlaceId) qp.set("ToPlace", String(deliveryPlaceId));
        const data = await callRentlyApi(creds.host, token, `/api/booking/price?${qp.toString()}`);
        return res.json({ success: true, data });
      }

      case "additionals_price": {
        const creds = await getRentlyCredentials(organizationId);
        const token = await getRentlyToken(creds.host, creds.clientId, creds.clientSecret);
        const { fromDate, toDate, categoryId, deliveryPlaceId, returnPlaceId } = params || {};
        if (!fromDate || !toDate || !categoryId) return res.json({ success: false, error: "fromDate, toDate y categoryId son requeridos" });
        const qp = new URLSearchParams({
          "request.From": String(fromDate),
          "request.To": String(toDate),
          "request.CategoryId": String(categoryId),
          ...(deliveryPlaceId ? { "request.FromPlace": String(deliveryPlaceId) } : {}),
          ...(returnPlaceId ? { "request.ToPlace": String(returnPlaceId) } : {}),
        });
        if (!returnPlaceId && deliveryPlaceId) qp.set("request.ToPlace", String(deliveryPlaceId));
        const data = await callRentlyApi(creds.host, token, `/api/booking/additionals-price?${qp.toString()}`);
        return res.json({ success: true, data });
      }

      case "explore": {
        return res.status(403).json({
          success: false,
          error: "El explorador HTTP arbitrario de Rently está deshabilitado por seguridad",
        });
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
