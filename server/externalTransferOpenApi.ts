import type { Request, Response } from "express";

export const externalTransferOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "PlanMint Transfers API",
    version: "1.0.0",
    description: "API bidireccional para crear, consultar y cancelar solicitudes de Transfers de Azul Cars, y recibir cambios mediante webhooks.",
  },
  servers: [{ url: "https://plan-mint.com/api/external/v1" }],
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/transfers": {
      post: {
        summary: "Crear una solicitud",
        operationId: "createTransfer",
        parameters: [
          { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8, maxLength: 200 } },
          { name: "X-Request-ID", in: "header", required: false, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTransfer" } } } },
        responses: {
          "201": { description: "Solicitud creada" },
          "200": { description: "Reintento idempotente; devuelve la solicitud ya creada" },
          "400": { $ref: "#/components/responses/ValidationError" },
          "409": { description: "Conflicto de idempotencia" },
          "429": { description: "Límite de peticiones superado" },
        },
      },
      get: {
        summary: "Listar todas las solicitudes de la organización",
        operationId: "listTransfers",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/TransferStatus" } },
          { name: "from_date", in: "query", schema: { type: "string", format: "date" } },
          { name: "to_date", in: "query", schema: { type: "string", format: "date" } },
          { name: "search", in: "query", schema: { type: "string", maxLength: 120 } },
        ],
        responses: { "200": { description: "Página de solicitudes, incluidas las creadas por portal, API o internamente" } },
      },
    },
    "/transfers/{id}": {
      get: {
        summary: "Consultar una solicitud completa",
        operationId: "getTransfer",
        parameters: [{ $ref: "#/components/parameters/TransferId" }],
        responses: { "200": { description: "Solicitud e items" }, "404": { description: "No encontrada en la organización" } },
      },
    },
    "/transfers/{id}/status": {
      get: {
        summary: "Consultar el estado actual",
        operationId: "getTransferStatus",
        parameters: [{ $ref: "#/components/parameters/TransferId" }],
        responses: { "200": { description: "Estado actual" }, "404": { description: "No encontrada en la organización" } },
      },
    },
    "/transfers/{id}/cancel": {
      post: {
        summary: "Cancelar una solicitud pendiente o aceptada",
        operationId: "cancelTransfer",
        parameters: [{ $ref: "#/components/parameters/TransferId" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 5, maxLength: 500 } } } } } },
        responses: { "200": { description: "Cancelada o reintento idempotente" }, "409": { description: "El estado actual no admite cancelación externa" } },
      },
    },
    "/webhooks": {
      get: { summary: "Listar webhooks", operationId: "listWebhooks", responses: { "200": { description: "Webhooks sin exponer secretos" } } },
      post: {
        summary: "Registrar un webhook HTTPS",
        operationId: "createWebhook",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookInput" } } } },
        responses: { "201": { description: "Webhook creado; signing_secret se muestra una sola vez" }, "400": { description: "Destino inseguro o configuración inválida" } },
      },
    },
    "/webhooks/{id}": {
      patch: { summary: "Actualizar un webhook", operationId: "updateWebhook", parameters: [{ $ref: "#/components/parameters/WebhookId" }], responses: { "200": { description: "Webhook actualizado" } } },
      delete: { summary: "Desactivar un webhook", operationId: "deactivateWebhook", parameters: [{ $ref: "#/components/parameters/WebhookId" }], responses: { "200": { description: "Webhook desactivado" } } },
    },
    "/webhooks/{id}/rotate-secret": {
      post: { summary: "Rotar el secreto de firma", operationId: "rotateWebhookSecret", parameters: [{ $ref: "#/components/parameters/WebhookId" }], responses: { "200": { description: "Nuevo secreto mostrado una sola vez" } } },
    },
    "/webhooks/{id}/test": {
      post: { summary: "Enviar un evento sintético de prueba", operationId: "testWebhook", parameters: [{ $ref: "#/components/parameters/WebhookId" }], responses: { "200": { description: "Entrega de prueba aceptada por el receptor" }, "502": { description: "El receptor rechazó o no recibió la prueba" } } },
    },
    "/webhooks/{id}/deliveries": {
      get: { summary: "Consultar las últimas entregas", operationId: "listWebhookDeliveries", parameters: [{ $ref: "#/components/parameters/WebhookId" }], responses: { "200": { description: "Hasta 100 entregas recientes, sin payloads ni secretos" } } },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key", description: "Clave compartida revocable de Azul Cars" },
    },
    parameters: {
      TransferId: { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      WebhookId: { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
    },
    responses: {
      ValidationError: { description: "Error de validación con rutas exactas de campos" },
    },
    schemas: {
      TransferStatus: { type: "string", enum: ["pendiente", "aceptado", "conductor_asignado", "en_curso", "completado", "rechazado", "cancelado"] },
      TransferItem: {
        type: "object",
        required: ["transfer_date", "transfer_time", "pickup_location", "dropoff_location", "vehicle_type", "pax_count"],
        properties: {
          direction: { type: "string", enum: ["ida", "vuelta"], default: "ida" },
          transfer_date: { type: "string", format: "date" },
          transfer_time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          pickup_location: { type: "string", maxLength: 500 },
          pickup_lat: { type: ["number", "null"], minimum: -90, maximum: 90 },
          pickup_lng: { type: ["number", "null"], minimum: -180, maximum: 180 },
          pickup_place_id: { type: "string", maxLength: 255 },
          dropoff_location: { type: "string", maxLength: 500 },
          dropoff_lat: { type: ["number", "null"], minimum: -90, maximum: 90 },
          dropoff_lng: { type: ["number", "null"], minimum: -180, maximum: 180 },
          dropoff_place_id: { type: "string", maxLength: 255 },
          vehicle_type: { type: "string", enum: ["mercedes_vito", "mercedes_v_class"] },
          pax_count: { type: "integer", minimum: 1, maximum: 50 },
          flight_number: { type: "string", maxLength: 40 },
          notes: { type: "string", maxLength: 2000 },
          baby_seats_count: { type: "integer", minimum: 0, maximum: 10, default: 0 },
          baby_seats: { type: "array", maxItems: 10, items: { type: "object", required: ["age", "weight"], properties: { age: { type: "number", minimum: 0, maximum: 15 }, weight: { type: "number", minimum: 1, maximum: 80 } } } },
          luggage_count: { type: "integer", minimum: 0, maximum: 100, default: 0 },
          vans_needed: { type: "integer", minimum: 1, maximum: 4, default: 1 },
          linked_item_position: { type: "integer", minimum: 1, maximum: 20 },
        },
      },
      CreateTransfer: {
        type: "object",
        required: ["client_type", "client_name", "client_phone", "items"],
        properties: {
          client_type: { type: "string", enum: ["villa", "charter"] },
          client_name: { type: "string", maxLength: 200 },
          client_phone: { type: "string", maxLength: 50 },
          client_email: { type: "string", format: "email", maxLength: 320 },
          villa_name: { type: "string", maxLength: 200 },
          boat_name: { type: "string", maxLength: 200 },
          berth_number: { type: "string", maxLength: 100 },
          captain_name: { type: "string", maxLength: 200 },
          captain_phone: { type: "string", maxLength: 50 },
          service_type: { type: "string", enum: ["point_to_point", "hourly", "daily", "airport", "port"], default: "point_to_point" },
          notes: { type: "string", maxLength: 4000 },
          external_reference: { type: "string", maxLength: 120 },
          items: { type: "array", minItems: 1, maxItems: 20, items: { $ref: "#/components/schemas/TransferItem" } },
        },
      },
      WebhookInput: {
        type: "object",
        required: ["name", "url", "events"],
        properties: {
          name: { type: "string", maxLength: 120 },
          url: { type: "string", format: "uri", pattern: "^https://" },
          events: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", enum: ["transfer.created", "transfer.status_changed", "transfer.cancelled"] } },
        },
      },
    },
  },
} as const;

export function handleExternalTransferOpenApi(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json(externalTransferOpenApi);
}

export function handleExternalTransferRoot(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.redirect(302, "/api/external/v1/docs");
}

export function handleExternalTransferDocs(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PlanMint Transfers API</title><style>body{font-family:system-ui,sans-serif;max-width:920px;margin:0 auto;padding:40px 20px;color:#17211a;background:#f7faf7}code,pre{background:#e8f0e9;border-radius:8px;padding:2px 6px}pre{padding:16px;overflow:auto}h1,h2{color:#123d2c}a{color:#16734b}</style></head><body><h1>PlanMint Transfers API v1</h1><p>API bidireccional autenticada mediante <code>X-API-Key</code>. La creación exige también <code>Idempotency-Key</code>.</p><h2>Rutas principales</h2><pre>POST /api/external/v1/transfers
GET  /api/external/v1/transfers
GET  /api/external/v1/transfers/{id}
POST /api/external/v1/transfers/{id}/cancel
GET/POST /api/external/v1/webhooks</pre><p><a href="/api/external/v1/openapi.json">Descargar especificación OpenAPI 3.1</a></p><p>Los secretos de clave y firma se muestran una sola vez. No los envíes por correo ni los incluyas en logs.</p></body></html>`);
}
