import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  ocr: router({
    recognizePlate: protectedProcedure
      .input(z.object({ image_base64: z.string() }))
      .mutation(async ({ input }) => {
        const { image_base64 } = input;

        if (!image_base64) {
          return { plate: "", success: false, error: "image_base64 is required" };
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

        try {
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

          const plate =
            response.choices?.[0]?.message?.content?.toString().trim() || "NO_PLATE_DETECTED";

          if (plate === "NO_PLATE_DETECTED") {
            return { plate: "", success: false };
          }

          // Clean the plate: remove spaces, dashes, and non-alphanumeric chars
          const cleanPlate = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
          return { plate: cleanPlate, success: true };
        } catch (err: any) {
          console.error("[OCR] LLM error:", err.message);
          return { plate: "", success: false, error: err.message };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
