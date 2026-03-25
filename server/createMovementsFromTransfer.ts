/**
 * POST /api/create-movements-from-transfer
 * Creates vehicle_movements in batch from parsed transfer document items.
 * Also creates/updates transfer_items if they don't exist yet.
 * 
 * This endpoint is called from the internal app only (not broker portal).
 * It receives reviewed/confirmed items from the PDF parsing review UI.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

interface ReviewedItem {
  // Transfer item fields
  transfer_date: string | null;
  pickup_time: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  dropoff_time: string | null;
  vehicle_type: string | null;
  pax_count: number | null;
  amount: number | null;
  notes: string | null;
  // Return trip
  has_return: boolean;
  return_pickup_location: string | null;
  return_dropoff_location: string | null;
  return_pickup_time: string | null;
  return_date: string | null;
  // Movement-specific
  matricula: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  // Whether to create a movement for this item
  create_movement: boolean;
  movement_type: 'entrega' | 'recogida' | 'escoba' | 'limpieza';
  // Existing transfer_item id (if updating rather than creating)
  existing_item_id?: string;
}

interface RequestBody {
  request_id: string;
  document_id: string;
  items: ReviewedItem[];
  provider_cost: number | null;
}

export async function handleCreateMovementsFromTransfer(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const user = await authenticateSupabaseRequest(req.headers.authorization);
    const { request_id, document_id, items, provider_cost } = (req.body || {}) as RequestBody;

    if (!request_id || !document_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "request_id, document_id, and items[] are required" });
    }

    const serviceClient = getServiceClient();

    // Verify the request exists and get organization_id
    const { data: transferRequest, error: reqError } = await serviceClient
      .from("transfer_requests")
      .select("id, organization_id")
      .eq("id", request_id)
      .single();

    if (reqError || !transferRequest) {
      return res.status(404).json({ error: "Transfer request not found" });
    }

    const orgId = transferRequest.organization_id;

    // Get existing items count for position numbering
    const { data: existingItems } = await serviceClient
      .from("transfer_items")
      .select("id, position")
      .eq("request_id", request_id)
      .order("position", { ascending: false })
      .limit(1);

    let nextPosition = (existingItems?.[0]?.position ?? 0) + 1;
    const userId = user.userId;

    const createdItemIds: string[] = [];
    const createdMovementIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // ── Step 1: Create or update transfer_item ──
        let itemId: string | undefined = item.existing_item_id;

        if (!itemId) {
          // Create new transfer_item
          const { data: newItem, error: itemError } = await serviceClient
            .from("transfer_items")
            .insert({
              request_id,
              organization_id: orgId,
              position: nextPosition++,
              transfer_date: item.transfer_date,
              pickup_enabled: true,
              pickup_location: item.pickup_location,
              pickup_time: item.pickup_time,
              dropoff_enabled: true,
              dropoff_location: item.dropoff_location,
              dropoff_time: item.dropoff_time,
              has_return: item.has_return ?? false,
              return_pickup_enabled: item.has_return ?? false,
              return_pickup_location: item.return_pickup_location,
              return_dropoff_location: item.return_dropoff_location,
              return_pickup_time: item.return_pickup_time,
              return_dropoff_enabled: item.has_return ?? false,
              pax_count: item.pax_count ?? 1,
              driver_name: item.driver_name,
              driver_phone: item.driver_phone,
              driver_pending: !item.driver_name,
              notes: item.notes,
              vehicle_type: item.vehicle_type ?? "v_class",
              provider_cost: item.amount,
              price_manually_set: false,
            })
            .select("id")
            .single();

          if (itemError || !newItem) {
            errors.push(`Item ${i + 1}: Error creando transfer item - ${itemError?.message}`);
            continue;
          }
          itemId = newItem.id;
          createdItemIds.push(itemId!);
        } else {
          // Update existing item with parsed data
          const updateData: Record<string, unknown> = {};
          if (item.transfer_date) updateData.transfer_date = item.transfer_date;
          if (item.pickup_location) updateData.pickup_location = item.pickup_location;
          if (item.pickup_time) updateData.pickup_time = item.pickup_time;
          if (item.dropoff_location) updateData.dropoff_location = item.dropoff_location;
          if (item.dropoff_time) updateData.dropoff_time = item.dropoff_time;
          if (item.pax_count) updateData.pax_count = item.pax_count;
          if (item.vehicle_type) updateData.vehicle_type = item.vehicle_type;
          if (item.amount !== null && item.amount !== undefined) updateData.provider_cost = item.amount;
          if (item.driver_name) {
            updateData.driver_name = item.driver_name;
            updateData.driver_pending = false;
          }
          if (item.driver_phone) updateData.driver_phone = item.driver_phone;
          if (item.notes) updateData.notes = item.notes;
          if (item.has_return !== undefined) {
            updateData.has_return = item.has_return;
            updateData.return_pickup_enabled = item.has_return;
            updateData.return_dropoff_enabled = item.has_return;
          }
          if (item.return_pickup_location) updateData.return_pickup_location = item.return_pickup_location;
          if (item.return_dropoff_location) updateData.return_dropoff_location = item.return_dropoff_location;
          if (item.return_pickup_time) updateData.return_pickup_time = item.return_pickup_time;

          if (Object.keys(updateData).length > 0) {
            await serviceClient
              .from("transfer_items")
              .update(updateData)
              .eq("id", itemId);
          }
          createdItemIds.push(itemId!);
        }

        // ── Step 2: Create movement if requested and matricula is provided ──
        if (item.create_movement && item.matricula) {
          // Build started_at from date + time
          let startedAt: string;
          if (item.transfer_date && item.pickup_time) {
            startedAt = `${item.transfer_date}T${item.pickup_time}:00`;
          } else if (item.transfer_date) {
            startedAt = `${item.transfer_date}T08:00:00`;
          } else {
            startedAt = new Date().toISOString();
          }

          const { data: movement, error: movError } = await serviceClient
            .from("vehicle_movements")
            .insert({
              organization_id: orgId,
              matricula: item.matricula.toUpperCase().replace(/\s/g, ""),
              movement_type: item.movement_type || "entrega",
              driver_id: userId,
              started_at: startedAt,
              status: "en_curso",
              notes: [
                item.notes,
                item.pickup_location ? `Recogida: ${item.pickup_location}` : null,
                item.dropoff_location ? `Destino: ${item.dropoff_location}` : null,
                item.pax_count ? `${item.pax_count} PAX` : null,
                `Generado desde presupuesto (doc: ${document_id?.slice(0, 8) ?? ''})`,
              ].filter(Boolean).join(" | "),
            })
            .select("id")
            .single();

          if (movError || !movement) {
            errors.push(`Item ${i + 1}: Error creando movimiento - ${movError?.message}`);
          } else {
            createdMovementIds.push(movement.id);
          }

          // If has_return, create a second movement for the return trip
          if (item.has_return && item.return_pickup_location) {
            let returnStartedAt: string;
            const returnDate = item.return_date || item.transfer_date;
            if (returnDate && item.return_pickup_time) {
              returnStartedAt = `${returnDate}T${item.return_pickup_time}:00`;
            } else if (returnDate) {
              returnStartedAt = `${returnDate}T18:00:00`;
            } else {
              returnStartedAt = new Date().toISOString();
            }

            const { data: returnMovement, error: returnMovError } = await serviceClient
              .from("vehicle_movements")
              .insert({
                organization_id: orgId,
                matricula: item.matricula.toUpperCase().replace(/\s/g, ""),
                movement_type: "recogida",
              driver_id: userId,
              started_at: returnStartedAt,
                status: "en_curso",
                notes: [
                  `VUELTA: ${item.return_pickup_location} → ${item.return_dropoff_location || item.pickup_location}`,
                  item.pax_count ? `${item.pax_count} PAX` : null,
                  `Generado desde presupuesto (doc: ${document_id?.slice(0, 8) ?? ''})`,
                ].filter(Boolean).join(" | "),
              })
              .select("id")
              .single();

            if (returnMovError || !returnMovement) {
              errors.push(`Item ${i + 1} (vuelta): Error creando movimiento - ${returnMovError?.message}`);
            } else {
              createdMovementIds.push(returnMovement.id);
            }
          }
        }
      } catch (itemError: any) {
        errors.push(`Item ${i + 1}: ${itemError?.message || "Error desconocido"}`);
      }
    }

    // ── Step 3: Update request provider_cost if provided ──
    if (provider_cost !== null && provider_cost !== undefined) {
      // Get current client_total to compute margin
      const { data: currentReq } = await serviceClient
        .from("transfer_requests")
        .select("client_total")
        .eq("id", request_id)
        .single();

      const clientTotal = currentReq?.client_total ?? 0;
      const margin = clientTotal - provider_cost;

      await serviceClient
        .from("transfer_requests")
        .update({
          provider_cost: provider_cost,
          internal_margin: margin,
        })
        .eq("id", request_id);
    }

    // ── Step 4: Sync request totals ──
    // Sum all item provider_costs to update request
    const { data: allItems } = await serviceClient
      .from("transfer_items")
      .select("provider_cost, price_with_commission")
      .eq("request_id", request_id);

    if (allItems) {
      const totalProviderCost = allItems.reduce((sum, it) => sum + (it.provider_cost || 0), 0);
      const totalClientPrice = allItems.reduce((sum, it) => sum + (it.price_with_commission || 0), 0);

      const updateFields: Record<string, unknown> = {};
      if (totalProviderCost > 0) {
        updateFields.provider_cost = totalProviderCost;
        updateFields.internal_margin = totalClientPrice - totalProviderCost;
      }

      if (Object.keys(updateFields).length > 0) {
        await serviceClient
          .from("transfer_requests")
          .update(updateFields)
          .eq("id", request_id);
      }
    }

    return res.json({
      success: true,
      created_items: createdItemIds.length,
      created_movements: createdMovementIds.length,
      item_ids: createdItemIds,
      movement_ids: createdMovementIds,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[create-movements-from-transfer] Error:", error);
    const status = error instanceof AuthError ? error.status : 500;
    return res.status(status).json({ error: error?.message || "Error desconocido" });
  }
}
