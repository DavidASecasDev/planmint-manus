import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { makeRequest } from "./_core/map";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  maps: router({
    directions: publicProcedure
      .input(z.object({
        origin: z.string(),
        destination: z.string(),
        originPlaceId: z.string().optional(),
        destinationPlaceId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const params: Record<string, string> = {
            mode: 'driving',
          };
          if (input.originPlaceId) {
            params.origin = `place_id:${input.originPlaceId}`;
          } else {
            params.origin = input.origin;
          }
          if (input.destinationPlaceId) {
            params.destination = `place_id:${input.destinationPlaceId}`;
          } else {
            params.destination = input.destination;
          }
          const result = await makeRequest<any>('/maps/api/directions/json', params);
          if (result.status !== 'OK' || !result.routes?.length) {
            return { success: false as const, error: result.status || 'No route found' };
          }
          const route = result.routes[0];
          const leg = route.legs[0];
          return {
            success: true as const,
            distance: leg.distance,
            duration: leg.duration,
            startAddress: leg.start_address,
            endAddress: leg.end_address,
            overviewPolyline: route.overview_polyline?.points || '',
            bounds: route.bounds,
          };
        } catch (err: any) {
          console.error('[Maps] Directions error:', err.message);
          return { success: false as const, error: err.message };
        }
      }),
  }),
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
