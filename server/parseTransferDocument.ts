/**
 * POST /api/parse-transfer-document
 * Parses transport transfer quotes/invoices using Manus LLM with vision.
 * Extracts: routes, dates, prices, pax count, vehicle types, provider info.
 */
import type { Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

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
          text: "Analiza este presupuesto o factura de servicio de transporte/transfer y extrae los datos según el esquema JSON indicado.",
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
          {
            role: "system",
            content: `Eres un experto en documentos de transporte y transfers turísticos. Tu tarea es analizar presupuestos y facturas de servicios de transporte (transfers de pasajeros, excursiones, traslados aeropuerto-hotel, etc.) y extraer la información relevante.

Responde SOLO con un JSON válido según este esquema:
{
  "document_type": "presupuesto | factura | proforma | otro",
  "total_amount": <número total en euros, sin símbolo>,
  "date": "YYYY-MM-DD o null si no se detecta",
  "provider_name": "nombre de la empresa proveedora del servicio",
  "currency": "EUR",
  "items": [
    {
      "date": "YYYY-MM-DD o null",
      "pickup_time": "HH:MM o null",
      "pickup_location": "lugar de recogida",
      "dropoff_location": "lugar de destino",
      "vehicle_type": "sedan | minivan | minibus | bus | null",
      "pax_count": <número de pasajeros o null>,
      "amount": <precio del trayecto en euros o null>,
      "notes": "observaciones del trayecto o null"
    }
  ]
}

Reglas:
- Si el documento tiene varios trayectos/servicios, crea un item por cada uno.
- Si solo hay un importe total sin desglose por trayecto, pon un solo item con el total.
- Extrae el nombre del proveedor del encabezado, logo o datos fiscales del documento.
- Si no puedes extraer un campo, usa null.
- Responde SOLO con el JSON, sin texto adicional ni bloques de código markdown.`,
          },
          {
            role: "user",
            content: userContent as any,
          },
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

      return res.json({ success: true, data: parsedData });
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
