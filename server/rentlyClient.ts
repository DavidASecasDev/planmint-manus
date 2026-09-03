import { createHash } from 'node:crypto';
import { getServiceClient } from './supabaseAdmin';

export const RENTLY_REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_FALLBACK_TTL_MS = 23 * 60 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export interface RentlyCredentials {
  host: string;
  clientId: string;
  clientSecret: string;
}

export interface RentlyErrorPayload {
  ErrorMessage?: string;
  ErrorCode?: string | number;
  Id?: string | number;
}

export class RentlyApiError extends Error {
  readonly status: number;
  readonly errorCode: string | number | null;
  readonly errorId: string | number | null;

  constructor(status: number, payload?: RentlyErrorPayload | null) {
    const message = payload?.ErrorMessage || `Rently respondió con error ${status}`;
    super(message);
    this.name = 'RentlyApiError';
    this.status = status;
    this.errorCode = payload?.ErrorCode ?? null;
    this.errorId = payload?.Id ?? null;
  }

  toSafeJson() {
    return {
      message: this.message,
      status: this.status,
      errorCode: this.errorCode,
      errorId: this.errorId,
    };
  }
}

type TokenEntry = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenEntry>();
const tokenRequests = new Map<string, Promise<TokenEntry>>();

function credentialCacheKey(credentials: RentlyCredentials): string {
  const secretFingerprint = createHash('sha256').update(credentials.clientSecret).digest('hex').slice(0, 12);
  return `${credentials.host.toLowerCase()}|${credentials.clientId}|${secretFingerprint}`;
}

function normalizeHost(value: string): string {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9.-]+$/.test(host) || !host.endsWith('.rently.com.ar')) {
    throw new Error('Host Rently no válido');
  }
  return host;
}

export async function getRentlyCredentialsForOrganization(organizationId: string): Promise<RentlyCredentials> {
  const { data: settings, error } = await getServiceClient()
    .from('integration_settings')
    .select('rently_api_host, rently_client_id, rently_client_secret')
    .eq('organization_id', organizationId)
    .single();

  if (error || !settings?.rently_client_id || !settings?.rently_client_secret) {
    throw new Error('Rently no está configurado para esta organización');
  }

  return {
    host: normalizeHost(settings.rently_api_host || 'azul.rently.com.ar'),
    clientId: settings.rently_client_id,
    clientSecret: settings.rently_client_secret,
  };
}

async function requestToken(credentials: RentlyCredentials): Promise<TokenEntry> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RENTLY_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://${credentials.host}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new RentlyApiError(response.status, await readRentlyError(response));
    }

    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error('Rently no devolvió access_token');
    const ttlMs = Number.isFinite(payload.expires_in)
      ? Math.max(60_000, Number(payload.expires_in) * 1000)
      : TOKEN_FALLBACK_TTL_MS;
    return { token: payload.access_token, expiresAt: Date.now() + ttlMs };
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Timeout obteniendo token de Rently');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCachedRentlyToken(credentials: RentlyCredentials, forceRefresh = false): Promise<string> {
  const key = credentialCacheKey(credentials);
  if (!forceRefresh) {
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt - TOKEN_EXPIRY_SKEW_MS > Date.now()) return cached.token;
    const pending = tokenRequests.get(key);
    if (pending) return (await pending).token;
  } else {
    tokenCache.delete(key);
  }

  const pending = requestToken(credentials);
  tokenRequests.set(key, pending);
  try {
    const entry = await pending;
    tokenCache.set(key, entry);
    return entry.token;
  } finally {
    tokenRequests.delete(key);
  }
}

async function readRentlyError(response: Response): Promise<RentlyErrorPayload | null> {
  try {
    const payload = await response.json() as RentlyErrorPayload;
    return {
      ErrorMessage: typeof payload?.ErrorMessage === 'string' ? payload.ErrorMessage : undefined,
      ErrorCode: typeof payload?.ErrorCode === 'string' || typeof payload?.ErrorCode === 'number' ? payload.ErrorCode : undefined,
      Id: typeof payload?.Id === 'string' || typeof payload?.Id === 'number' ? payload.Id : undefined,
    };
  } catch {
    return null;
  }
}

export async function rentlyRequest<T>(input: {
  credentials: RentlyCredentials;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
}): Promise<{ status: number; data: T }> {
  if (!input.path.startsWith('/api/')) throw new Error('Ruta Rently no permitida');

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getCachedRentlyToken(input.credentials, attempt === 1);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? RENTLY_REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      const options: RequestInit = { method: input.method ?? 'GET', headers, signal: controller.signal };
      if (input.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(input.body);
      }
      const response = await fetch(`https://${input.credentials.host}${input.path}`, options);
      if (response.status === 401 && attempt === 0) continue;
      if (!response.ok) throw new RentlyApiError(response.status, await readRentlyError(response));
      const contentType = response.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();
      return { status: response.status, data: data as T };
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('Timeout llamando a Rently');
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error('No se pudo renovar la sesión Rently');
}

export function clearRentlyTokenCacheForTests() {
  tokenCache.clear();
  tokenRequests.clear();
}
