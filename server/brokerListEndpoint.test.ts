import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("./supabaseAdmin", () => ({
  getServiceClient: vi.fn(),
  authenticateSupabaseRequest: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

vi.mock("./permissionHelper", () => ({
  requireAnyPermission: vi.fn(),
}));

import { handleGetTransferBrokers } from "./brokerListEndpoint";
import { authenticateSupabaseRequest, getServiceClient } from "./supabaseAdmin";
import { requireAnyPermission } from "./permissionHelper";

function mockReq(): Partial<Request> {
  return { headers: { authorization: "Bearer valid-token" } };
}

function mockRes(): Partial<Response> & { _status: number; _json: any } {
  const res: any = { _status: 200, _json: null };
  res.status = (status: number) => {
    res._status = status;
    return res;
  };
  res.json = (payload: unknown) => {
    res._json = payload;
    return res;
  };
  return res;
}

function queryResult(result: { data: unknown; error?: unknown }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(async () => ({ data: result.data, error: result.error ?? null })),
    order: vi.fn(async () => ({ data: result.data, error: result.error ?? null })),
  };
  return builder;
}

describe("handleGetTransferBrokers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "admin-user",
      organizationId: "org-1",
    });
    vi.mocked(requireAnyPermission).mockResolvedValue({
      role: "admin",
      permission: "transfers.manage_brokers",
    });
  });

  it("rejects callers without a broker-management permission before reading data", async () => {
    const permissionError: any = new Error("Permission denied");
    permissionError.status = 403;
    vi.mocked(requireAnyPermission).mockRejectedValue(permissionError);
    const from = vi.fn();
    vi.mocked(getServiceClient).mockReturnValue({ from } as any);
    const res = mockRes();

    await handleGetTransferBrokers(mockReq() as Request, res as Response);

    expect(res._status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it("reports a complete link only when both profiles point to the same broker and organization", async () => {
    const broker = {
      id: "broker-1",
      organization_id: "org-1",
      user_id: "broker-user",
      name: "Broker Example",
      is_active: true,
    };
    const from = vi.fn((table: string) => {
      if (table === "transfer_brokers") return queryResult({ data: [broker] });
      if (table === "profiles") {
        return queryResult({ data: [{ id: "broker-user", organization_id: "org-1" }] });
      }
      if (table === "broker_profiles") {
        return queryResult({
          data: [{
            user_id: "broker-user",
            broker_id: "broker-1",
            organization_id: "org-1",
            is_active: true,
          }],
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getServiceClient).mockReturnValue({ from } as any);
    const res = mockRes();

    await handleGetTransferBrokers(mockReq() as Request, res as Response);

    expect(res._status).toBe(200);
    expect(res._json.data.profileHealth["broker-1"]).toEqual({
      has_profile: true,
      has_org: true,
      has_broker_profile: true,
      broker_profile_matches: true,
      broker_profile_active: true,
      can_link_company: false,
      is_linked: true,
    });
  });

  it("offers the repair only when an active matching portal profile exists and the main profile lacks an organization", async () => {
    const broker = {
      id: "broker-1",
      organization_id: "org-1",
      user_id: "broker-user",
      name: "Broker Example",
      is_active: true,
    };
    const from = vi.fn((table: string) => {
      if (table === "transfer_brokers") return queryResult({ data: [broker] });
      if (table === "profiles") {
        return queryResult({ data: [{ id: "broker-user", organization_id: null }] });
      }
      if (table === "broker_profiles") {
        return queryResult({
          data: [{
            user_id: "broker-user",
            broker_id: "broker-1",
            organization_id: "org-1",
            is_active: true,
          }],
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getServiceClient).mockReturnValue({ from } as any);
    const res = mockRes();

    await handleGetTransferBrokers(mockReq() as Request, res as Response);

    expect(res._json.data.profileHealth["broker-1"]).toMatchObject({
      has_profile: true,
      has_org: false,
      can_link_company: true,
      is_linked: false,
    });
  });

  it("offers the repair when the broker has a user but broker_profiles is missing", async () => {
    const broker = {
      id: "broker-1",
      organization_id: "org-1",
      user_id: "broker-user",
      name: "Broker Example",
      is_active: true,
    };
    const from = vi.fn((table: string) => {
      if (table === "transfer_brokers") return queryResult({ data: [broker] });
      if (table === "profiles") {
        return queryResult({ data: [{ id: "broker-user", organization_id: null }] });
      }
      if (table === "broker_profiles") return queryResult({ data: [] });
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getServiceClient).mockReturnValue({ from } as any);
    const res = mockRes();

    await handleGetTransferBrokers(mockReq() as Request, res as Response);

    expect(res._json.data.profileHealth["broker-1"]).toMatchObject({
      has_profile: true,
      has_org: false,
      has_broker_profile: false,
      can_link_company: true,
      is_linked: false,
    });
  });

  it("does not hide profile-query failures as an incomplete user", async () => {
    const broker = {
      id: "broker-1",
      organization_id: "org-1",
      user_id: "broker-user",
      name: "Broker Example",
      is_active: true,
    };
    const from = vi.fn((table: string) => {
      if (table === "transfer_brokers") return queryResult({ data: [broker] });
      if (table === "profiles") {
        return queryResult({ data: null, error: { message: "database unavailable" } });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getServiceClient).mockReturnValue({ from } as any);
    const res = mockRes();

    await handleGetTransferBrokers(mockReq() as Request, res as Response);

    expect(res._status).toBe(500);
    expect(res._json.error).toContain("perfil");
  });
});
