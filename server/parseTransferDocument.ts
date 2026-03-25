/**
 * POST /api/parse-transfer-document
 * Parses transport transfer quotes/invoices using Manus LLM with vision.
 * Extracts: routes, dates, prices, pax count, vehicle types, provider info,
 * return trips, flight numbers, and confidence scores for automation.
 */
import type { Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

const SYSTEM_PROMPT = `Eres un experto en documentos de transporte y transfers turísticos. Tu tarea es analizar presupuestos y facturas de servicios de transporte (transfers de pasajeros, excursiones, traslados aeropuerto-hotel, etc.) y extraer la información relevante con la mayor precisión posible.

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

export async function handleParseTransferDocument(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await authenticateSupabaseRequest(req.headers.authorization);
    const { documentId } = req.body || {};

    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" });
    }

    const serviceClient = getServiceClient();

    // Get the document
    const { data: document, error: docError } = await serviceClient
      .from("transfer_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update status to processing
    await serviceClient
      .from("transfer_documents")
      .update({ ai_status: "processing" })
      .eq("id", documentId);

    try {
      // Generate a signed URL from the storage_path
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from("transfer-documents")
        .createSignedUrl(document.storage_path, 3600); // 1 hour

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Cannot generate signed URL for document: ${signedUrlError?.message || "Unknown error"}`);
      }

      const fileUrl = signedUrlData.signedUrl;
      const isPdf = document.file_name?.toLowerCase().endsWith(".pdf");

      // Build the message content based on file type
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

      // Use LLM with structured output to parse the transport document
      const response = await invokeLLM({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent as any },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content?.toString() || "{}";

      // Try to parse JSON from the response
      let parsedData: Record<string, unknown> = {};
      try {
        // Remove markdown code blocks if present
        const cleanJson = rawContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        parsedData = JSON.parse(cleanJson);
      } catch {
        parsedData = { raw_text: rawContent };
      }

      // Extract key fields for direct column storage
      const totalAmount = typeof parsedData.total_amount === "number" ? parsedData.total_amount : null;
      const detectedDate = typeof parsedData.date === "string" ? parsedData.date : null;
      const providerName = typeof parsedData.provider_name === "string" ? parsedData.provider_name : null;
      const detectedItems = Array.isArray(parsedData.items) ? parsedData.items : null;
      const confidence = typeof parsedData.confidence === "number" ? parsedData.confidence : null;

      // Update document with parsed data
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

      return res.json({ success: true, data: parsedData, confidence });
    } catch (parseError: any) {
      console.error("[parse-transfer-document] Parse error:", parseError);

      // Use 'failed' status to match what the UI expects
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
