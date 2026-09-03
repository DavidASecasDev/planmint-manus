import { z } from 'zod';

const bookingId = z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(Number);
const lastname = z.string().trim().min(1, 'Lastname es obligatorio');

export function normalizeRentlyActionBody(action: string, raw: unknown): Record<string, unknown> | undefined {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  if (action === 'booking.confirm' || action === 'booking.cancel') {
    return z.object({ BookingId: bookingId, Lastname: lastname }).parse(data);
  }
  if (action === 'booking.add_payment') {
    const source = data.payload && typeof data.payload === 'object'
      ? { ...data.payload, BookingId: data.payload.BookingId ?? data.reservationId }
      : data;
    return z.object({
      BookingId: bookingId,
      GatewayId: z.union([z.number().int().positive(), z.string().min(1)]),
      Amount: z.coerce.number().min(0.01),
      Notes: z.string().trim().max(500).optional(),
    }).passthrough().parse(source);
  }
  if (action === 'booking.create') {
    const normalized: Record<string, any> = { ...data, Extra: data.Extra ?? data.Notes };
    delete normalized.Notes;
    return z.object({
      From: z.string().min(1),
      To: z.string().min(1),
      CategoryId: z.union([z.number().int().positive(), z.string().min(1)]),
      CustomerId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
      Extra: z.string().max(2000).optional(),
    }).passthrough().parse(normalized);
  }
  return raw && typeof raw === 'object' ? data : undefined;
}
