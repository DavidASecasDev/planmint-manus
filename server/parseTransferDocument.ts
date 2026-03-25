/**
 * POST /api/parse-transfer-document
 * Parses transport transfer quotes/invoices using Manus LLM with vision.
 * Extracts: routes, dates, prices, pax count, vehicle types, provider info,
 * return trips, flight numbers, and confidence scores for automation.
 * 
 * Now integrates provider-specific parsing templates to improve accuracy
 * for recurring providers.
 */
import type { Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

const BASE_SYSTEM_PROMPT = `Eres un experto en documentos de transporte y transfers turísticos. Tu tarea es analizar presupuestos y facturas de servicios de transporte (transfers de pasajeros, excursiones, traslados aeropuerto-hotel, etc.) y extraer la información relevante con la mayor precisión posible.

Responde SOLO con un JSON válido según este esquema:
{
  "document_type": "presupuesto | factura | proforma | otro",
  "total_amount": <número total en euros, sin símbolo>,
  "date": "YYYY-MM-DD o null si no se detecta",
  "provider_name": "nombre de la empresa proveedora del servicio",
  "provider_phone": "teléfono del proveedor o null",
  "provider_email": "email del proveedor o null",
  "currency": "EUR",
  "client_reference": "referencia del cliente mencionada en el documento o null",
  "confidence": <0.0 a 1.0, confianza global en la extracción>,
  "items": [
    {
      "date": "YYYY-MM-DD o null",
      "pickup_time": "HH:MM o null",
      "pickup_location": "lugar de recogida completo",
      "dropoff_location": "lugar de destino completo",
      "dropoff_time": "HH:MM o null (hora estimada de llegada si se indica)",
      "vehicle_type": "sedan | minivan | minibus | bus | van | v_class | sprinter | null",
      "pax_count": <número de pasajeros o null>,
      "amount": <precio del trayecto en euros o null>,
      "notes": "observaciones del trayecto o null",
      "flight_number": "número de vuelo si se menciona o null",
      "has_return": <true si este trayecto incluye vuelta, false si no>,
      "return_pickup_location": "lugar de recogida de la vuelta o null",
      "return_dropoff_location": "lugar de destino de la vuelta o null",
      "return_pickup_time": "HH:MM de la vuelta o null",
      "return_date": "YYYY-MM-DD de la vuelta o null (si es diferente a la ida)",
      "driver_name": "nombre del conductor asignado si aparece o null",
      "driver_phone": "teléfono del conductor si aparece o null",
      "confidence": <0.0 a 1.0, confianza en la extracción de este item>
    }
  ]
}

Reglas IMPORTANTES:
- Si el documento tiene varios trayectos/servicios, crea un item por cada uno.
- Si un trayecto tiene ida y vuelta en la misma línea, usa has_return=true y rellena los campos return_*.
- Si ida y vuelta están en líneas separadas, crea items separados (has_return=false para cada uno).
- Si solo hay un importe total sin desglose por trayecto, pon un solo item con el total.
- Extrae el nombre del proveedor del encabezado, logo o datos fiscales del documento.
- Para vehicle_type, mapea: "Mercedes V-Class" → "v_class", "Mercedes Sprinter" → "sprinter", "Minivan" → "minivan", "Minibús" → "minibus", "Autobús" → "bus", "Berlina/Sedán" → "sedan", "Furgoneta" → "van".
- Si no puedes extraer un campo con certeza, usa null.
- El campo confidence (0.0-1.0) indica tu nivel de certeza: 1.0 = datos claros y legibles, 0.5 = datos parcialmente legibles, <0.3 = datos muy inciertos.
- Responde SOLO con el JSON, sin texto adicional ni bloques de código markdown.`;

/**
 * Build provider-specific hints to append to the system prompt.
 * Returns null if no matching template is found.
 */
function buildProviderHints(template: {
  provider_name: string;
  parsing_hints: string;
  field_mappings?: Record<string, unknown>;
  sample_fields?: Record<string, unknown>;
  default_vehicle_type?: string | null;
}): string {
  const parts: string[] = [];
  
  parts.push(`\n\n--- INSTRUCCIONES ESPECÍFICAS DEL PROVEEDOR: ${template.provider_name} ---`);
  parts.push(template.parsing_hints);

  // Add field mappings if present
  const mappings = template.field_mappings || {};
  const mappingEntries = Object.entries(mappings).filter(([, v]) => v);
  if (mappingEntries.length > 0) {
    parts.push('\nMapeo de campos del proveedor:');
    for (const [field, label] of mappingEntries) {
      parts.push(`- "${label}" en el PDF → campo "${field}" en el JSON`);
    }
  }

  // Add vehicle type mappings from sample_fields
  const sampleFields = template.sample_fields || {};
  const vehicleMappings = (sampleFields as Record<string, unknown>).vehicle_type_mappings as Record<string, string> | undefined;
  if (vehicleMappings && Object.keys(vehicleMappings).length > 0) {
    parts.push('\nMapeo de tipos de vehículo del proveedor:');
    for (const [providerName, systemType] of Object.entries(vehicleMappings)) {
      parts.push(`- "${providerName}" → "${systemType}"`);
    }
  }

  // Add default vehicle type
  if (template.default_vehicle_type) {
    parts.push(`\nSi no se especifica tipo de vehículo, usar por defecto: "${template.default_vehicle_type}"`);
  }

  // Add common locations
  const commonPickups = (sampleFields as Record<string, unknown>).common_pickup_locations as string[] | undefined;
  const commonDropoffs = (sampleFields as Record<string, unknown>).common_dropoff_locations as string[] | undefined;
  if (commonPickups && commonPickups.length > 0) {
    parts.push(`\nUbicaciones de recogida habituales: ${commonPickups.join(', ')}`);
  }
  if (commonDropoffs && commonDropoffs.length > 0) {
    parts.push(`\nUbicaciones de destino habituales: ${commonDropoffs.join(', ')}`);
  }

  parts.push('\n--- FIN INSTRUCCIONES PROVEEDOR ---');
  return parts.join('\n');
}

/**
 * Find matching provider template from the organization's templates.
 * First tries to match by the transfer request's external_provider_name,
 * then falls back to checking all active templates.
 */
async function findProviderTemplate(
  serviceClient: ReturnType<typeof getServiceClient>,
  orgId: string,
  requestId: string | null,
): Promise<{ id: string; provider_name: string; parsing_hints: string; field_mappings: Record<string, unknown>; sample_fields: Record<string, unknown>; default_vehicle_type: string | null } | null> {
  // Get all active templates for this org
  const { data: templates, error } = await serviceClient
    .from('provider_parsing_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('usage_count', { ascending: false });

  if (error || !templates || templates.length === 0) return null;

  // If we have a request_id, try to match by the request's external_provider_name
  if (requestId) {
    const { data: request } = await serviceClient
      .from('transfer_requests')
      .select('external_provider_name')
      .eq('id', requestId)
      .single();

    if (request?.external_provider_name) {
      const providerName = request.external_provider_name.toLowerCase().trim();
      
      for (const t of templates) {
        const tName = (t.provider_name as string).toLowerCase().trim();
        const aliases = (t.provider_aliases as string[] || []).map((a: string) => a.toLowerCase().trim());
        
        if (tName === providerName || aliases.includes(providerName) ||
            providerName.includes(tName) || tName.includes(providerName) ||
            aliases.some((a: string) => providerName.includes(a) || a.includes(providerName))) {
          return {
            id: t.id as string,
            provider_name: t.provider_name as string,
            parsing_hints: t.parsing_hints as string,
            field_mappings: (t.field_mappings || {}) as Record<string, unknown>,
            sample_fields: (t.sample_fields || {}) as Record<string, unknown>,
            default_vehicle_type: t.default_vehicle_type as string | null,
          };
        }
      }
    }
  }

  // No match found by request provider name - the LLM will extract the provider name
  // and we can try to match after parsing (for future use)
  return null;
}

export async function handleParseTransferDocument(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const authResult = await authenticateSupabaseRequest(req.headers.authorization);
    const { documentId } = req.body || {};

    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" });
    }

    const serviceClient = getServiceClient();

    // Get the document with its request_id
    const { data: document, error: docError } = await serviceClient
      .from("transfer_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const orgId = document.organization_id as string;
    const requestId = document.request_id as string | null;

    // Update status to processing
    await serviceClient
      .from("transfer_documents")
      .update({ ai_status: "processing" })
      .eq("id", documentId);

    try {
      // ── Step 1: Find matching provider template ──
      const providerTemplate = await findProviderTemplate(serviceClient, orgId, requestId);
      
      // Build the system prompt with optional provider-specific hints
      let systemPrompt = BASE_SYSTEM_PROMPT;
      if (providerTemplate) {
        systemPrompt += buildProviderHints(providerTemplate);
        console.log(`[parse-transfer-document] Using provider template: ${providerTemplate.provider_name} (${providerTemplate.id})`);
      }

      // ── Step 2: Generate signed URL ──
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from("transfer-documents")
        .createSignedUrl(document.storage_path, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Cannot generate signed URL for document: ${signedUrlError?.message || "Unknown error"}`);
      }

      const fileUrl = signedUrlData.signedUrl;
      const isPdf = document.file_name?.toLowerCase().endsWith(".pdf");

      // ── Step 3: Build LLM message ──
      const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string }; file_url?: { url: string; mime_type: string } }> = [
        {
          type: "text",
          text: "Analiza este presupuesto o factura de servicio de transporte/transfer y extrae TODOS los datos según el esquema JSON indicado. Presta especial atención a: número de trayectos, si hay ida y vuelta, horas de recogida, tipos de vehículo, y precios individuales por trayecto.",
        },
      ];

      if (isPdf) {
        userContent.push({
          type: "file_url" as any,
          file_url: {
            url: fileUrl,
            mime_type: "application/pdf",
          },
        } as any);
      } else {
        userContent.push({
          type: "image_url",
          image_url: {
            url: fileUrl,
            detail: "high",
          },
        });
      }

      // ── Step 4: Invoke LLM ──
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent as any },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content?.toString() || "{}";

      // ── Step 5: Parse response ──
      let parsedData: Record<string, unknown> = {};
      try {
        const cleanJson = rawContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        parsedData = JSON.parse(cleanJson);
      } catch {
        parsedData = { raw_text: rawContent };
      }

      // Extract key fields
      const totalAmount = typeof parsedData.total_amount === "number" ? parsedData.total_amount : null;
      const detectedDate = typeof parsedData.date === "string" ? parsedData.date : null;
      const providerName = typeof parsedData.provider_name === "string" ? parsedData.provider_name : null;
      const detectedItems = Array.isArray(parsedData.items) ? parsedData.items : null;
      const confidence = typeof parsedData.confidence === "number" ? parsedData.confidence : null;

      // ── Step 6: Update document with parsed data ──
      await serviceClient
        .from("transfer_documents")
        .update({
          ai_raw_data: parsedData,
          ai_status: "completed",
          detected_amount: totalAmount,
          detected_date: detectedDate,
          detected_provider: providerName,
          detected_items: detectedItems,
        })
        .eq("id", documentId);

      // ── Step 7: Update provider template usage stats ──
      if (providerTemplate) {
        await serviceClient
          .from("provider_parsing_templates")
          .update({
            usage_count: (providerTemplate as any).usage_count ? (providerTemplate as any).usage_count + 1 : 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", providerTemplate.id);
      }

      // ── Step 8: Try to auto-match a template if none was pre-matched ──
      // If we didn't have a template but the LLM detected a provider name,
      // try to find a matching template for future reference
      let matchedTemplateId: string | null = providerTemplate?.id || null;
      if (!providerTemplate && providerName) {
        const postMatchTemplate = await findProviderTemplate(serviceClient, orgId, null);
        // We can't re-run with the template, but we log it for next time
        if (postMatchTemplate) {
          matchedTemplateId = postMatchTemplate.id;
          // Increment usage count for tracking
          await serviceClient
            .from("provider_parsing_templates")
            .update({
              usage_count: (postMatchTemplate as any).usage_count ? (postMatchTemplate as any).usage_count + 1 : 1,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", postMatchTemplate.id);
        }
      }

      return res.json({ 
        success: true, 
        data: parsedData, 
        confidence,
        provider_template_used: providerTemplate ? providerTemplate.provider_name : null,
        matched_template_id: matchedTemplateId,
      });
    } catch (parseError: any) {
      console.error("[parse-transfer-document] Parse error:", parseError);

      await serviceClient
        .from("transfer_documents")
        .update({
          ai_status: "failed",
        })
        .eq("id", documentId);

      return res.status(500).json({ error: parseError?.message || "Error al procesar documento" });
    }
  } catch (error: any) {
    console.error("[parse-transfer-document] Error:", error);
    const status = error instanceof AuthError ? error.status : 500;
    return res.status(status).json({ error: error?.message || "Error desconocido" });
  }
}
