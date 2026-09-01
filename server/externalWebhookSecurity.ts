import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

const WEBHOOK_TIMEOUT_MS = 10_000;

function encryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for webhook secret encryption");
  return crypto.createHash("sha256").update(`planmint-webhooks:${secret}`).digest();
}

export function encryptWebhookSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptWebhookSecret(value: string): string {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = value.split(".");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Invalid encrypted webhook secret");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  return `v1=${crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isPrivateNetworkAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  const version = net.isIP(normalized);
  if (version === 4) return isPrivateIpv4(normalized);
  if (version !== 6) return true;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIpv4(normalized.slice(7));
  return false;
}

export async function assertWebhookDestination(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Webhook URL must use HTTPS without credentials");
  if (url.port && url.port !== "443") throw new Error("Webhook URL must use the standard HTTPS port");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Webhook URL cannot target a local hostname");
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
    throw new Error("Webhook URL resolves to a private or invalid network address");
  }
  return url;
}

export async function deliverWebhookPayload(params: {
  url: string;
  secret: string;
  eventType: string;
  deliveryId: string;
  payload: unknown;
}): Promise<{ status: number }> {
  const url = await assertWebhookDestination(params.url);
  const body = JSON.stringify(params.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PlanMint-Webhooks/1.0",
        "X-PlanMint-Event": params.eventType,
        "X-PlanMint-Delivery": params.deliveryId,
        "X-PlanMint-Timestamp": timestamp,
        "X-PlanMint-Signature": signWebhookPayload(params.secret, timestamp, body),
      },
      body,
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) throw new Error("Webhook redirects are not allowed");
    if (!response.ok) throw new Error(`Webhook responded with HTTP ${response.status}`);
    return { status: response.status };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("base64url")}`;
}
