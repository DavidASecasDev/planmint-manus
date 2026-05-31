import { Request, Response, NextFunction } from "express";
import { getServiceClient } from "./supabaseAdmin";

/**
 * Middleware that intercepts /track/:token requests from social media crawlers
 * (WhatsApp, Facebook, Twitter, etc.) and serves them a minimal HTML page with
 * proper Open Graph meta tags instead of the SPA.
 *
 * Regular browsers get passed through to the SPA as normal.
 */

const CRAWLER_USER_AGENTS = [
  "WhatsApp",
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
  "Googlebot",
  "bingbot",
  "Applebot",
];

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return CRAWLER_USER_AGENTS.some((bot) =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );
}

export function trackingOgMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Only intercept /track/:token paths
  const match = req.path.match(/^\/track\/([a-zA-Z0-9_-]+)$/);
  if (!match) return next();

  // Only intercept for crawlers
  const ua = req.headers["user-agent"];
  if (!isCrawler(ua)) return next();

  const token = match[1];

  // Fetch tracking data to build dynamic meta tags
  fetchTrackingMeta(token)
    .then((meta) => {
      const html = buildOgHtml(meta, req);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    })
    .catch(() => {
      // If fetch fails, serve generic meta tags
      const html = buildOgHtml(null, req);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    });
}

interface TrackingMeta {
  operationType: string;
  destination: string;
  driverName: string;
  isActive: boolean;
}

async function fetchTrackingMeta(
  token: string
): Promise<TrackingMeta | null> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("en_camino_tracking")
      .select("operation_type, destination_address, assigned_user_name, llego_at")
      .eq("share_token", token)
      .single();

    if (error || !data) return null;

    return {
      operationType: data.operation_type || "entrega",
      destination: data.destination_address || "",
      driverName: data.assigned_user_name || "el conductor",
      isActive: !data.llego_at,
    };
  } catch {
    return null;
  }
}

function buildOgHtml(meta: TrackingMeta | null, req: Request): string {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const fullUrl = `${baseUrl}${req.originalUrl}`;

  let title: string;
  let description: string;

  if (!meta) {
    title = "Seguimiento en tiempo real — Azul Cars";
    description =
      "Sigue la ubicación de tu conductor en tiempo real en el mapa.";
  } else if (!meta.isActive) {
    if (meta.operationType === "devolucion") {
      title = "El conductor ha llegado — Azul Cars";
      description =
        "El conductor ha llegado a tu ubicación para recoger el vehículo.";
    } else {
      title = "Tu vehículo ha llegado — Azul Cars";
      description =
        "El conductor ha llegado a su destino. Tu vehículo te está esperando.";
    }
  } else {
    if (meta.operationType === "devolucion") {
      title = "Tu conductor está en camino — Azul Cars";
      description = `${meta.driverName} se dirige a tu ubicación para recoger el vehículo. Sigue su posición en tiempo real.`;
    } else {
      title = "Tu vehículo está en camino — Azul Cars";
      description = meta.destination
        ? `${meta.driverName} se dirige a ${meta.destination} con tu vehículo. Sigue su posición en tiempo real.`
        : `${meta.driverName} está en camino con tu vehículo. Sigue su posición en tiempo real.`;
    }
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/tracking-og-image-LCM5SB734zpWT3vJLKbBJB.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/tracking-og-image-LCM5SB734zpWT3vJLKbBJB.png" />

  <!-- Redirect browsers to the actual page -->
  <meta http-equiv="refresh" content="0;url=${fullUrl}" />
</head>
<body>
  <p>${description}</p>
  <p><a href="${fullUrl}">Ver seguimiento en tiempo real</a></p>
</body>
</html>`;
}
