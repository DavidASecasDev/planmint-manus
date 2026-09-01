import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateExternalApi, ExternalApiError, generateApiKey, hashAuditValue, logExternalApiRequest } from "./externalApiAuth";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("./supabaseAdmin", () => ({ getServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));

const validApiKey = "pmk_12345678_1234567890abcdef1234567890abcdef";
const validHash = crypto.createHash("sha256").update(validApiKey).digest("hex");

function request(apiKey?: string) {
  return { headers: apiKey ? { "x-api-key": apiKey } : {} } as any;
}

function query(record: Record<string, unknown> | null, error: unknown = null) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: record, error }));
  chain.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve));
  return chain;
}

function activeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    organization_id: "00000000-0000-0000-0000-000000000002",
    name: "Comerciales · Clave compartida",
    key_hash: validHash,
    permissions: ["transfers.read", "transfers.create", "transfers.cancel", "webhooks.manage"],
    is_active: true,
    expires_at: null,
    metadata: { rate_limit_per_minute: 60 },
    ...overrides,
  };
}

describe("ExternalApiAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "synthetic-jwt-secret";
  });

  it("rejects missing and malformed keys before storage lookup", async () => {
    await expect(authenticateExternalApi(request())).rejects.toMatchObject({ code: "MISSING_API_KEY", status: 401 });
    await expect(authenticateExternalApi(request("invalid"))).rejects.toMatchObject({ code: "INVALID_API_KEY_FORMAT", status: 401 });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects unknown, deactivated and expired keys", async () => {
    mocks.from.mockReturnValueOnce(query(null, { message: "not found" }));
    await expect(authenticateExternalApi(request(validApiKey))).rejects.toMatchObject({ code: "INVALID_API_KEY" });
    mocks.from.mockReturnValueOnce(query(activeRecord({ is_active: false })));
    await expect(authenticateExternalApi(request(validApiKey))).rejects.toMatchObject({ code: "API_KEY_DEACTIVATED" });
    mocks.from.mockReturnValueOnce(query(activeRecord({ expires_at: "2020-01-01T00:00:00Z" })));
    await expect(authenticateExternalApi(request(validApiKey))).rejects.toMatchObject({ code: "API_KEY_EXPIRED" });
  });

  it("enforces scopes before rate limiting", async () => {
    mocks.from.mockReturnValue(query(activeRecord({ permissions: ["transfers.read"] })));
    await expect(authenticateExternalApi(request(validApiKey), "transfers.create")).rejects.toMatchObject({ code: "INSUFFICIENT_PERMISSIONS", status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed without the security RPC and returns 429 when exhausted", async () => {
    mocks.from.mockReturnValue(query(activeRecord()));
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "missing" } });
    await expect(authenticateExternalApi(request(validApiKey), "transfers.read")).rejects.toMatchObject({ code: "API_SCHEMA_NOT_READY", status: 503 });
    mocks.from.mockReturnValue(query(activeRecord()));
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(authenticateExternalApi(request(validApiKey), "transfers.read")).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED", status: 429 });
  });

  it("returns the shared organization context when valid", async () => {
    mocks.from.mockReturnValue(query(activeRecord()));
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await expect(authenticateExternalApi(request(validApiKey), "transfers.read")).resolves.toMatchObject({
      organizationId: "00000000-0000-0000-0000-000000000002",
      keyName: "Comerciales · Clave compartida",
      rateLimitPerMinute: 60,
    });
  });

  it("generates only supported shared-key scopes and hashes the secret", async () => {
    const db = query({ id: "00000000-0000-0000-0000-000000000010" });
    mocks.from.mockReturnValue(db);
    const result = await generateApiKey({
      organizationId: "00000000-0000-0000-0000-000000000002",
      name: "Comerciales",
      permissions: ["transfers.read", "transfers.create"],
      rateLimitPerMinute: 75,
    });
    expect(result.apiKey).toMatch(/^pmk_[a-f0-9]{8}_[a-f0-9]{32}$/);
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      metadata: expect.objectContaining({ key_type: "shared", rate_limit_per_minute: 75 }),
    }));
    await expect(generateApiKey({ organizationId: "x", name: "invalid", permissions: ["database.admin"] })).rejects.toThrow("Unsupported API permission");
  });

  it("never persists request or response bodies and hashes client metadata", async () => {
    const db = query(null);
    db.insert = vi.fn(async () => ({ data: null, error: null }));
    mocks.from.mockReturnValue(db);
    await logExternalApiRequest({
      apiKeyId: "00000000-0000-0000-0000-000000000001",
      organizationId: "00000000-0000-0000-0000-000000000002",
      method: "POST",
      endpoint: "/transfers",
      statusCode: 201,
      requestBody: { client_name: "No debe guardarse" },
      responseBody: { client_phone: "No debe guardarse" },
      ipAddress: "203.0.113.10",
      userAgent: "Synthetic Agent",
    });
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      request_body: null,
      response_body: null,
      ip_address: expect.stringMatching(/^ip_[a-f0-9]{64}$/),
      user_agent: expect.stringMatching(/^ua_[a-f0-9]{64}$/),
    }));
    expect(hashAuditValue("ip", "203.0.113.10")).not.toContain("203.0.113.10");
  });

  it("keeps structured API error status and code", () => {
    expect(new ExternalApiError("Test", 418, "TEST_ERROR")).toMatchObject({ status: 418, code: "TEST_ERROR" });
  });
});
