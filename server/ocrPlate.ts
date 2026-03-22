import type { Request, Response } from "express";
import { invokeLLM } from "./_core/llm";

/**
 * POST /api/ocr-plate
 * Body: { image_base64: string }
 * Returns: { plate: string, success: boolean }
 *
 * Replaces the Supabase Edge Function ocr-plate.
 * Uses Manus LLM with vision to detect license plates.
 */
export async function handleOcrPlate(req: Request, res: Response) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { image_base64 } = req.body;

    if (!image_base64) {
      return res.status(400).json({ plate: "", success: false, error: "image_base64 is required" });
    }

    // Determine mime type from base64 header or default to jpeg
    let mimeType = "image/jpeg";
    let cleanBase64 = image_base64;
    if (image_base64.startsWith("data:")) {
      const match = image_base64.match(/data:(image\/\w+);base64,/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = image_base64.replace(/data:image\/\w+;base64,/, "");
      }
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a license plate recognition system. Analyze the image and extract the vehicle license plate number. Return ONLY the plate number in uppercase without spaces or dashes. If you cannot detect a plate, return exactly 'NO_PLATE_DETECTED'. Do not include any other text.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Read the license plate number from this vehicle image.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${cleanBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      maxTokens: 50,
    });

    const rawPlate =
      response.choices?.[0]?.message?.content?.toString().trim() || "NO_PLATE_DETECTED";

    if (rawPlate === "NO_PLATE_DETECTED") {
      return res.json({ plate: "", success: false });
    }

    // Clean the plate: remove spaces, dashes, and non-alphanumeric chars
    const cleanPlate = rawPlate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return res.json({ plate: cleanPlate, success: true });
  } catch (err: any) {
    console.error("[OCR] LLM error:", err.message);
    return res.status(500).json({ plate: "", success: false, error: err.message });
  }
}
