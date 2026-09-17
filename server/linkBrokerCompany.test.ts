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

import { handleLinkBrokerCompany } from "./linkBrokerCompany";
import { authenticateSupabaseRequest, getServiceClient } from "./supabaseAdmin";
import { requireAnyPermission } from "./permissionHelper";

interface ScriptedResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface RecordedOperation {
  table: string;
  filters: Array<["eq", string, unknown]>;
}

function createScriptedClient(
  script: Record<string, ScriptedResult[]>,
  rpcResult: ScriptedResult = {
    data: [{ already_linked: false, profile_created: false, organization_name: "Empresa Real" }],
    error: null,
  }
) {
  const queues = new Map(Object.entries(script).map(([table, results]) => [table, [...results]]));
  const operations: RecordedOperation[] = [];

  const from = vi.fn((table: string) => {
    const result = queues.get(table)?.shift() ?? { data: null, error: null };
    const operation: RecordedOperation = { table, filters: [] };
    operations.push(operation);
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        operation.filters.push(["eq", column, value]);
        return builder;
      }),
      maybeSingle: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    };
    return builder;
  });

  const rpc = vi.fn(async () => ({ data: rpcResult.data ?? null, error: rpcResult.error ?? null }));
  return { client: { from, rpc } as any, operations, rpc };
}

function mockReq(body: Record<string, unknown> = {}): Partial<Request> {
  return {
    body,
    headers: { authorization: "Bearer valid-token", "user-agent": "vitest" },
    ip: "127.0.0.1",
  };
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

const broker = {
  id: "broker-1",
  organization_id: "org-1",
  user_id: "broker-user",
  name: "Broker Example",
  is_active: true,
};
const brokerProfile = {
  id: "portal-profile",
  broker_id: "broker-1",
  organization_id: "org-1",
  is_active: true,
};

async function invoke(body: Record<string, unknown>, client: any) {
  vi.mocked(getServiceClient).mockReturnValue(client);
  const res = mockRes();
  await handleLinkBrokerCompany(mockReq(body) as Request, res as Response);
  return res;
}

describe("handleLinkBrokerCompany", () => {
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

  it("requires a broker id", async () => {
    const { client } = createScriptedClient({});
    const res = await invoke({}, client);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain("brokerId");
  });

  it("requires a broker-management permission", async () => {
    const permissionError: any = new Error("Permission denied");
    permissionError.status = 403;
    vi.mocked(requireAnyPermission).mockRejectedValue(permissionError);
    const { client } = createScriptedClient({});
    const res = await invoke({ brokerId: "broker-1" }, client);
    expect(res._status).toBe(403);
    expect(requireAnyPermission).toHaveBeenCalledWith(client, "org-1", "admin-user", [
      "transfers.manage_brokers",
      "transfers.manage",
    ]);
  });

  it("cannot link a broker outside the authenticated organization", async () => {
    const { client, operations, rpc } = createScriptedClient({ transfer_brokers: [{ data: null }] });
    const res = await invoke({ brokerId: "broker-other" }, client);
    expect(res._status).toBe(404);
    expect(operations[0].filters).toContainEqual(["eq", "organization_id", "org-1"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires portal access before company linking", async () => {
    const { client, rpc } = createScriptedClient({
      transfer_brokers: [{ data: { ...broker, user_id: null } }],
    });
    const res = await invoke({ brokerId: broker.id }, client);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain("Configura primero");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not reactivate an inactive broker", async () => {
    const { client, rpc } = createScriptedClient({
      transfer_brokers: [{ data: { ...broker, is_active: false } }],
    });
    const res = await invoke({ brokerId: broker.id }, client);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain("Activa primero");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires an existing active portal profile for the same broker and company", async () => {
    const missing = createScriptedClient({
      transfer_brokers: [{ data: broker }],
      broker_profiles: [{ data: null }],
    });
    expect((await invoke({ brokerId: broker.id }, missing.client))._status).toBe(409);

    const crossed = createScriptedClient({
      transfer_brokers: [{ data: broker }],
      broker_profiles: [{ data: { ...brokerProfile, organization_id: "org-other" } }],
    });
    expect((await invoke({ brokerId: broker.id }, crossed.client))._json.error).toContain("otra empresa o broker");

    const inactive = createScriptedClient({
      transfer_brokers: [{ data: broker }],
      broker_profiles: [{ data: { ...brokerProfile, is_active: false } }],
    });
    expect((await invoke({ brokerId: broker.id }, inactive.client))._json.error).toContain("desactivado");

    const nullActive = createScriptedClient({
      transfer_brokers: [{ data: broker }],
      broker_profiles: [{ data: { ...brokerProfile, is_active: null } }],
    });
    expect((await invoke({ brokerId: broker.id }, nullActive.client))._status).toBe(409);
  });

  it("calls the transactional RPC with identities derived from the authenticated context", async () => {
    const { client, rpc } = createScriptedClient({
      transfer_brokers: [{ data: broker }],
      broker_profiles: [{ data: brokerProfile }],
    });
    const res = await invoke({ brokerId: broker.id, organizationId: "attacker-org" }, client);
    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({ success: true, already_linked: false, organization_name: "Empresa Real" });
    expect(rpc).toHaveBeenCalledWith("link_broker_profile_to_company", {
      p_organization_id: "org-1",
      p_broker_id: "broker-1",
      p_user_id: "broker-user",
      p_actor_user_id: "admin-user",
      p_actor_role: "admin",
    });
  });

  it("returns the idempotent result from the transaction", async () => {
    const { client } = createScriptedClient(
      { transfer_brokers: [{ data: broker }], broker_profiles: [{ data: brokerProfile }] },
      { data: [{ already_linked: true, profile_created: false, organization_name: "Empresa Real" }] }
    );
    const res = await invoke({ brokerId: broker.id }, client);
    expect(res._status).toBe(200);
    expect(res._json.already_linked).toBe(true);
  });

  it("maps a cross-company profile conflict without exposing database details", async () => {
    const { client } = createScriptedClient(
      { transfer_brokers: [{ data: broker }], broker_profiles: [{ data: brokerProfile }] },
      { error: { message: "profile_other_organization" } }
    );
    const res = await invoke({ brokerId: broker.id }, client);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain("otra empresa");
    expect(res._json.error).not.toContain("profile_other_organization");
  });

  it("maps concurrent unlink or reassignment to a retryable conflict", async () => {
    const { client } = createScriptedClient(
      { transfer_brokers: [{ data: broker }], broker_profiles: [{ data: brokerProfile }] },
      { error: { message: "broker_link_changed" } }
    );
    const res = await invoke({ brokerId: broker.id }, client);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain("cambió durante la operación");
    expect(res._json.error).toContain("vuelve a intentarlo");
  });

  it("fails closed when the RPC does not return a verifiable result", async () => {
    const { client } = createScriptedClient(
      { transfer_brokers: [{ data: broker }], broker_profiles: [{ data: brokerProfile }] },
      { data: [] }
    );
    const res = await invoke({ brokerId: broker.id }, client);
    expect(res._status).toBe(500);
    expect(res._json.error).toContain("verificable");
  });
});
