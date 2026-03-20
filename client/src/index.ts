/**
 * rently-hub — Edge Function: API interna unificada del Rently Integration Hub
 *
 * Esta función actúa como proxy seguro entre el frontend de PlanMint y la API de Rently.
 * El frontend NUNCA accede a Rently directamente; siempre pasa por esta función.
 *
 * Soporta dos modos:
 * 1. Consulta de dominio: { action: "query", domain: "cars", method: "list", params: {...} }
 * 2. Explorador: { action: "explore", endpoint: "/api/cars", method: "GET", params: {...} }
 * 3. Metadata: { action: "registry" } — devuelve el catálogo de dominios
 * 4. Test: { action: "test" } — prueba la conexión con Rently
 * 5. Logs: { action: "logs" } — devuelve los logs de la sesión actual
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RentlyHub } from "../_shared/rently/mod.ts";
import { RENTLY_DOMAIN_REGISTRY } from "../_shared/rently/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HubRequest {
  action: "query" | "explore" | "registry" | "test" | "logs";
  domain?: string;
  method?: string;
  params?: Record<string, unknown>;
  endpoint?: string;
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── Parse request body early for registry action ──────────
    const body: HubRequest = await req.json().catch(() => ({ action: "registry" }));

    // ─── Action: Registry (no auth needed) ─────────────────────
    if (body.action === "registry") {
      return jsonResponse({
        success: true,
        domains: RENTLY_DOMAIN_REGISTRY,
        totalDomains: RENTLY_DOMAIN_REGISTRY.length,
        totalEndpoints: RENTLY_DOMAIN_REGISTRY.reduce((sum, d) => sum + d.endpoints.length, 0),
      });
    }

    // ─── Auth: Validate user JWT ───────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const userId = userData.user.id;

    // Get user's organization
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("organization_id, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.organization_id) {
      return jsonResponse({ error: "User has no organization" }, 400);
    }

    const organizationId = profile.organization_id;

    // ─── Get Rently credentials ────────────────────────────────
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await serviceClient
      .from("integration_settings")
      .select("rently_api_host, rently_client_id, rently_client_secret")
      .eq("organization_id", organizationId)
      .single();

    // body was already parsed above

    // For all other actions, credentials are required
    if (settingsError || !settings?.rently_client_id || !settings?.rently_client_secret) {
      return jsonResponse({
        success: false,
        error: "Rently no está configurado. Configura tus credenciales en Ajustes → Integraciones.",
      }, 400);
    }

    const hub = new RentlyHub({
      host: settings.rently_api_host || "azul.rently.com.ar",
      clientId: settings.rently_client_id,
      clientSecret: settings.rently_client_secret,
    });

    // ─── Action: Test Connection ───────────────────────────────
    if (body.action === "test") {
      const result = await hub.client.testConnection();
      // Also try to get profile to validate full access
      if (result.success) {
        try {
          const profileResult = await hub.profile.get();
          return jsonResponse({
            success: true,
            profile: profileResult.data,
            message: "Conexión exitosa con Rently",
          });
        } catch (e) {
          return jsonResponse({
            success: true,
            message: "Token obtenido pero el perfil no es accesible",
            warning: e instanceof Error ? e.message : "Unknown",
          });
        }
      }
      return jsonResponse({ success: false, error: result.error });
    }

    // ─── Action: Explore (raw endpoint call) ───────────────────
    if (body.action === "explore") {
      if (!body.endpoint) {
        return jsonResponse({ error: "Missing 'endpoint' parameter" }, 400);
      }

      const httpMethod = body.httpMethod || "GET";
      const startTime = Date.now();

      try {
        const result = await hub.client.request(body.endpoint, {
          method: httpMethod,
          query: httpMethod === "GET" ? (body.params as Record<string, string | number | boolean | undefined>) : undefined,
          body: httpMethod !== "GET" ? (body.params as Record<string, unknown>) : undefined,
        });

        return jsonResponse({
          success: true,
          endpoint: body.endpoint,
          method: httpMethod,
          status: result.status,
          elapsed: result.elapsed,
          data: result.data,
          raw: result.raw,
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        return jsonResponse({
          success: false,
          endpoint: body.endpoint,
          method: httpMethod,
          elapsed,
          error: error instanceof Error ? error.message : "Unknown error",
          errorType: error?.constructor?.name || "Error",
        });
      }
    }

    // ─── Action: Query (domain-based) ──────────────────────────
    if (body.action === "query") {
      if (!body.domain || !body.method) {
        return jsonResponse({ error: "Missing 'domain' and/or 'method' parameters" }, 400);
      }

      const startTime = Date.now();
      try {
        const result = await executeDomainQuery(hub, body.domain, body.method, body.params || {});
        const elapsed = Date.now() - startTime;

        return jsonResponse({
          success: true,
          domain: body.domain,
          method: body.method,
          elapsed,
          data: result.data,
          raw: result.raw,
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        return jsonResponse({
          success: false,
          domain: body.domain,
          method: body.method,
          elapsed,
          error: error instanceof Error ? error.message : "Unknown error",
          errorType: error?.constructor?.name || "Error",
        });
      }
    }

    // ─── Action: Logs ──────────────────────────────────────────
    if (body.action === "logs") {
      return jsonResponse({
        success: true,
        logs: hub.client.getLogs(),
      });
    }

    return jsonResponse({ error: `Unknown action: ${body.action}` }, 400);
  } catch (error) {
    console.error("rently-hub error:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500
    );
  }
});

// ─── Domain Query Router ─────────────────────────────────────────

async function executeDomainQuery(
  hub: RentlyHub,
  domain: string,
  method: string,
  params: Record<string, unknown>
): Promise<{ data: unknown; raw: unknown }> {
  switch (domain) {
    // ── Bookings ──
    case "bookings": {
      switch (method) {
        case "list":
          const bookingsPage = await hub.bookings.list(
            (params.offset as number) || 0,
            (params.limit as number) || 100,
            params.filters as Record<string, unknown> | undefined
          );
          return { data: bookingsPage.results, raw: bookingsPage.raw };
        case "listAll":
          const allBookings = await hub.bookings.listAll(params.filters as Record<string, unknown> | undefined);
          return { data: allBookings.results, raw: allBookings };
        case "get":
          const booking = await hub.bookings.get(params.bookingId as number);
          return { data: booking.data, raw: booking.raw };
        case "getComments":
          const comments = await hub.bookings.getComments(params.bookingId as number);
          return { data: comments.data, raw: comments.raw };
        case "getOrigins":
          const origins = await hub.bookings.getOrigins();
          return { data: origins.data, raw: origins.raw };
        case "getBrands":
          const brands = await hub.bookings.getBrands();
          return { data: brands.data, raw: brands.raw };
        case "getFiles":
          const files = await hub.bookings.getFiles(params.bookingId as number);
          return { data: files.data, raw: files.raw };
        case "getPromotions":
          const promos = await hub.bookings.getPromotions(params.bookingId as number);
          return { data: promos.data, raw: promos.raw };
        case "getLinks":
          const links = await hub.bookings.getLinks(params.bookingId as number);
          return { data: links.data, raw: links.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'bookings'`);
      }
    }

    // ── Cars ──
    case "cars": {
      switch (method) {
        case "list":
          const cars = await hub.cars.list(params as Record<string, unknown>);
          return { data: cars.data, raw: cars.raw };
        case "get":
          const car = await hub.cars.get(params.carId as number);
          return { data: car.data, raw: car.raw };
        case "getBookings":
          const carBookings = await hub.cars.getBookings(params.carId as number);
          return { data: carBookings.data, raw: carBookings.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'cars'`);
      }
    }

    // ── Customers ──
    case "customers": {
      switch (method) {
        case "list":
          const customers = await hub.customers.list(params.filter as string);
          return { data: customers.data, raw: customers.raw };
        case "getBookings":
          const custBookings = await hub.customers.getBookings(params.customerId as number);
          return { data: custBookings.data, raw: custBookings.raw };
        case "getPaymentMethods":
          const pm = await hub.customers.getPaymentMethods(params.customerId as number);
          return { data: pm.data, raw: pm.raw };
        case "getInfractions":
          const infractions = await hub.customers.getInfractions(params.customerId as number);
          return { data: infractions.data, raw: infractions.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'customers'`);
      }
    }

    // ── Availability ──
    case "availability": {
      switch (method) {
        case "search":
          const avail = await hub.availability.search(params as {
            from: string; to: string; fromPlace: number;
            toPlace?: number; driverAge?: number; promotion?: string;
            commercialAgreementCode?: string; currencyCode?: string;
            availabilityByModel?: boolean;
          });
          return { data: avail.data, raw: avail.raw };
        case "getPrice":
          const price = await hub.availability.getPrice(params as Record<string, string | number | boolean | undefined>);
          return { data: price.data, raw: price.raw };
        case "getAdditionalsPrices":
          const addPrices = await hub.availability.getAdditionalsPrices(params as Record<string, string | number | boolean | undefined>);
          return { data: addPrices.data, raw: addPrices.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'availability'`);
      }
    }

    // ── General ──
    case "general": {
      switch (method) {
        case "getBranchOffices":
          const branches = await hub.general.getBranchOffices();
          return { data: branches.data, raw: branches.raw };
        case "getPlaces":
          const places = await hub.general.getPlaces();
          return { data: places.data, raw: places.raw };
        case "getPlaceTypes":
          const placeTypes = await hub.general.getPlaceTypes();
          return { data: placeTypes.data, raw: placeTypes.raw };
        case "getCategories":
          const cats = await hub.general.getCategories();
          return { data: cats.data, raw: cats.raw };
        case "getModels":
          const models = await hub.general.getModels();
          return { data: models.data, raw: models.raw };
        case "getAdditionals":
          const adds = await hub.general.getAdditionals();
          return { data: adds.data, raw: adds.raw };
        case "getAdditionalsWithStock":
          const addStock = await hub.general.getAdditionalsWithStock();
          return { data: addStock.data, raw: addStock.raw };
        case "getAgencies":
          const agencies = await hub.general.getAgencies();
          return { data: agencies.data, raw: agencies.raw };
        case "getPromotions":
          const promotions = await hub.general.getPromotions();
          return { data: promotions.data, raw: promotions.raw };
        case "getBookingBrands":
          const bookingBrands = await hub.general.getBookingBrands();
          return { data: bookingBrands.data, raw: bookingBrands.raw };
        case "getPaymentGateways":
          const gateways = await hub.general.getPaymentGateways();
          return { data: gateways.data, raw: gateways.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'general'`);
      }
    }

    // ── Operations ──
    case "operations": {
      switch (method) {
        case "getDeliveries":
          const deliveries = await hub.operations.getDeliveries(params as Record<string, unknown>);
          return { data: deliveries.data, raw: deliveries.raw };
        case "getReturns":
          const returns = await hub.operations.getReturns(params as Record<string, unknown>);
          return { data: returns.data, raw: returns.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'operations'`);
      }
    }

    // ── Incidents ──
    case "incidents": {
      switch (method) {
        case "getTypes":
          const incTypes = await hub.incidents.getTypes();
          return { data: incTypes.data, raw: incTypes.raw };
        case "get":
          const incident = await hub.incidents.get(params.incidentId as number);
          return { data: incident.data, raw: incident.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'incidents'`);
      }
    }

    // ── Services ──
    case "services": {
      switch (method) {
        case "get":
          const service = await hub.services.get(params.serviceId as number);
          return { data: service.data, raw: service.raw };
        case "getTypes":
          const svcTypes = await hub.services.getTypes();
          return { data: svcTypes.data, raw: svcTypes.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'services'`);
      }
    }

    // ── Booking Payments ──
    case "booking_payments": {
      switch (method) {
        case "getByBooking":
          const payments = await hub.bookingPayments.getByBooking(params.bookingId as number);
          return { data: payments.data, raw: payments.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'booking_payments'`);
      }
    }

    // ── Configurations ──
    case "configurations": {
      switch (method) {
        case "getBookingConfig":
          const bkConfig = await hub.configurations.getBookingConfig();
          return { data: bkConfig.data, raw: bkConfig.raw };
        case "getDocumentTypes":
          const docTypes = await hub.configurations.getDocumentTypes();
          return { data: docTypes.data, raw: docTypes.raw };
        case "getTaxPayerTypes":
          const taxTypes = await hub.configurations.getTaxPayerTypes();
          return { data: taxTypes.data, raw: taxTypes.raw };
        case "getAttachments":
          const attachConfig = await hub.configurations.getAttachments();
          return { data: attachConfig.data, raw: attachConfig.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'configurations'`);
      }
    }

    // ── Commercial Agreements ──
    case "commercial_agreements": {
      switch (method) {
        case "list":
          const agreements = await hub.commercialAgreements.list();
          return { data: agreements.data, raw: agreements.raw };
        case "get":
          const agreement = await hub.commercialAgreements.get(params.code as string);
          return { data: agreement.data, raw: agreement.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'commercial_agreements'`);
      }
    }

    // ── Notifications ──
    case "notifications": {
      switch (method) {
        case "listMails":
          const mails = await hub.notifications.listMails();
          return { data: mails.data, raw: mails.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'notifications'`);
      }
    }

    // ── Tolls ──
    case "tolls": {
      switch (method) {
        case "findByPlates":
          const plates = await hub.tolls.findByPlates(params as { from?: string; to?: string });
          return { data: plates.data, raw: plates.raw };
        case "findByTransponders":
          const transponders = await hub.tolls.findByTransponders(params as { from?: string; to?: string });
          return { data: transponders.data, raw: transponders.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'tolls'`);
      }
    }

    // ── InAndOut ──
    case "in_and_out": {
      switch (method) {
        case "getFeatureFlags":
          const flags = await hub.inAndOut.getFeatureFlags();
          return { data: flags.data, raw: flags.raw };
        case "getBranchOffices":
          const ioBranches = await hub.inAndOut.getBranchOffices();
          return { data: ioBranches.data, raw: ioBranches.raw };
        case "getBookings":
          const ioBookings = await hub.inAndOut.getBookings();
          return { data: ioBookings.data, raw: ioBookings.raw };
        case "getBooking":
          const ioBooking = await hub.inAndOut.getBooking(params.bookingId as number);
          return { data: ioBooking.data, raw: ioBooking.raw };
        case "getAvailableCars":
          const ioCars = await hub.inAndOut.getAvailableCars(params.bookingId as number);
          return { data: ioCars.data, raw: ioCars.raw };
        case "getProtocol":
          const protocol = await hub.inAndOut.getProtocol(params.bookingId as number);
          return { data: protocol.data, raw: protocol.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'in_and_out'`);
      }
    }

    // ── Profile ──
    case "profile": {
      switch (method) {
        case "get":
          const prof = await hub.profile.get();
          return { data: prof.data, raw: prof.raw };
        default:
          throw new Error(`Unknown method '${method}' for domain 'profile'`);
      }
    }

    default:
      throw new Error(`Unknown domain: '${domain}'`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
