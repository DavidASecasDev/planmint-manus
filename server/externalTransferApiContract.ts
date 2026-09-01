import crypto from "node:crypto";
import { z } from "zod";

export const EXTERNAL_TRANSFER_API_VERSION = "1.0.0";
export const EXTERNAL_TRANSFER_BASE_PATH = "/api/external/v1";

export const TRANSFER_REQUEST_STATUSES = [
  "pendiente",
  "aceptado",
  "conductor_asignado",
  "en_curso",
  "completado",
  "rechazado",
  "cancelado",
] as const;

export const WEBHOOK_EVENT_TYPES = [
  "transfer.created",
  "transfer.status_changed",
  "transfer.cancelled",
] as const;

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const nullableCoordinate = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable().optional();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Debe usar el formato YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "La fecha no existe");

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Debe usar el formato HH:MM de 24 horas");

const babySeatSchema = z.object({
  age: z.number().finite().min(0).max(15),
  weight: z.number().finite().min(1).max(80),
});

export const externalTransferItemSchema = z
  .object({
    direction: z.enum(["ida", "vuelta"]).default("ida"),
    transfer_date: dateSchema,
    transfer_time: timeSchema,
    pickup_location: nonEmptyText(500),
    pickup_lat: nullableCoordinate(-90, 90),
    pickup_lng: nullableCoordinate(-180, 180),
    pickup_place_id: optionalText(255),
    dropoff_location: nonEmptyText(500),
    dropoff_lat: nullableCoordinate(-90, 90),
    dropoff_lng: nullableCoordinate(-180, 180),
    dropoff_place_id: optionalText(255),
    vehicle_type: z.enum(["mercedes_vito", "mercedes_v_class"]),
    pax_count: z.number().int().min(1).max(50),
    flight_number: optionalText(40),
    notes: optionalText(2000),
    baby_seats_count: z.number().int().min(0).max(10).default(0),
    baby_seats: z.array(babySeatSchema).max(10).default([]),
    luggage_count: z.number().int().min(0).max(100).default(0),
    vans_needed: z.number().int().min(1).max(4).default(1),
    linked_item_position: z.number().int().min(1).max(20).optional(),
  })
  .superRefine((item, ctx) => {
    if (item.baby_seats.length > 0 && item.baby_seats.length !== item.baby_seats_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baby_seats"],
        message: "Debe contener exactamente baby_seats_count elementos",
      });
    }
  });

export const createExternalTransferSchema = z
  .object({
    client_type: z.enum(["villa", "charter"]),
    client_name: nonEmptyText(200),
    client_phone: nonEmptyText(50),
    client_email: z.string().trim().email().max(320).optional(),
    villa_name: optionalText(200),
    boat_name: optionalText(200),
    berth_number: optionalText(100),
    captain_name: optionalText(200),
    captain_phone: optionalText(50),
    service_type: z.enum(["point_to_point", "hourly", "daily", "airport", "port"]).default("point_to_point"),
    notes: optionalText(4000),
    external_reference: optionalText(120),
    items: z.array(externalTransferItemSchema).min(1).max(20),
  })
  .superRefine((payload, ctx) => {
    if (payload.client_type === "villa" && !payload.villa_name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["villa_name"], message: "Es obligatorio para client_type villa" });
    }
    if (payload.client_type === "charter" && !payload.boat_name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["boat_name"], message: "Es obligatorio para client_type charter" });
    }

    payload.items.forEach((item, index) => {
      if (item.linked_item_position === undefined) return;
      if (item.linked_item_position > payload.items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "linked_item_position"],
          message: "Debe referenciar la posición de otro servicio incluido",
        });
      }
      if (item.linked_item_position === index + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "linked_item_position"],
          message: "Un servicio no puede enlazarse consigo mismo",
        });
      }
    });
  });

export const cancelExternalTransferSchema = z.object({
  reason: nonEmptyText(500).refine((value) => value.length >= 5, "Debe explicar el motivo con al menos 5 caracteres"),
});

export const createWebhookSchema = z.object({
  name: nonEmptyText(120),
  url: z.string().url().max(2000).refine((value) => value.startsWith("https://"), "La URL debe usar HTTPS"),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).max(WEBHOOK_EVENT_TYPES.length),
});

export const updateWebhookSchema = z.object({
  name: nonEmptyText(120).optional(),
  url: z.string().url().max(2000).refine((value) => value.startsWith("https://"), "La URL debe usar HTTPS").optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).max(WEBHOOK_EVENT_TYPES.length).optional(),
  is_active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Debe indicar al menos un cambio");

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/, "Solo puede contener letras, números, punto, guion, dos puntos o guion bajo");

export type CreateExternalTransferInput = z.infer<typeof createExternalTransferSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildExternalRequestHash(input: CreateExternalTransferInput): string {
  return sha256(stableJson(input));
}

export function formatZodIssues(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
