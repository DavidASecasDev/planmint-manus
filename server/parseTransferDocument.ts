/**
 * POST /api/parse-transfer-document
 * Migrated from Supabase Edge Function parse-transfer-document.
 * Uses Manus LLM with vision to parse transfer documents.
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
      const fileUrl = document.file_url;
      if (!fileUrl) {
        throw new Error("Document has no file URL");
      }

      // Use LLM with vision to parse the document
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Eres un experto en documentos de transferencia de vehículos. Analiza el documento y extrae la siguiente información en formato JSON:
{
  "vehicle_plate": "matrícula del vehículo",
  "vehicle_brand": "marca",
  "vehicle_model": "modelo",
  "vehicle_year": "año",
  "vehicle_vin": "número de bastidor/VIN",
  "buyer_name": "nombre del comprador",
  "buyer_document": "DNI/NIE del comprador",
  "seller_name": "nombre del vendedor",
  "seller_document": "DNI/NIE del vendedor",
  "transfer_date": "fecha de transferencia",
  "price": "precio de venta",
  "document_type": "tipo de documento (contrato, DGT, factura, etc.)",
  "notes": "observaciones adicionales"
}
Si no puedes extraer algún campo, usa null. Responde SOLO con el JSON, sin texto adicional.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analiza este documento de transferencia de vehículo y extrae los datos.",
              },
              {
                type: "image_url",
                image_url: {
                  url: fileUrl,
                  detail: "high",
                },
              },
            ],
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

      // Update document with parsed data
      await serviceClient
        .from("transfer_documents")
        .update({
          ai_raw_data: parsedData,
          ai_status: "completed",
          ai_processed_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      return res.json({ success: true, data: parsedData });
    } catch (parseError: any) {
      console.error("[parse-transfer-document] Parse error:", parseError);

      await serviceClient
        .from("transfer_documents")
        .update({
          ai_status: "error",
          ai_error: parseError?.message || "Error al procesar documento",
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
