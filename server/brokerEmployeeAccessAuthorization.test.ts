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

import { handleLinkEmployeeAsBroker } from "./linkEmployeeAsBroker";
import { handleUnlinkEmployeeAsBroker } from "./unlinkEmployeeAsBroker";
import { authenticateSupabaseRequest, getServiceClient } from "./supabaseAdmin";
import { requireAnyPermission } from "./permissionHelper";
import fs from "node:fs";
import path from "node:path";

const linkSource = fs.readFileSync(path.resolve(__dirname, "linkEmployeeAsBroker.ts"), "utf8");
const unlinkSource = fs.readFileSync(path.resolve(__dirname, "unlinkEmployeeAsBroker.ts"), "utf8");

function mockReq(body: Record<string, unknown>): Partial<Request> {
  return { body, headers: { authorization: "Bearer valid-token" } };
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

describe("legacy broker access routes authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "ordinary-user",
      organizationId: "org-1",
    });
    const permissionError: any = new Error("Permission denied");
    permissionError.status = 403;
    vi.mocked(requireAnyPermission).mockRejectedValue(permissionError);
  });

  it.each([
    ["link", handleLinkEmployeeAsBroker, { memberId: "member-1", brokerId: "broker-1" }],
    ["unlink", handleUnlinkEmployeeAsBroker, { memberId: "member-1" }],
  ])("blocks direct %s calls before any service-role query", async (_name, handler, body) => {
    const from = vi.fn();
    const client = { from } as any;
    vi.mocked(getServiceClient).mockReturnValue(client);
    const res = mockRes();

    await handler(mockReq(body) as Request, res as Response);

    expect(res._status).toBe(403);
    expect(from).not.toHaveBeenCalled();
    expect(requireAnyPermission).toHaveBeenCalledWith(client, "org-1", "ordinary-user", [
      "transfers.manage_brokers",
      "transfers.manage",
    ]);
  });

  it("uses compare-and-set guards so stale unlink cannot clear a newer assignee", () => {
    expect(linkSource).toContain('.is("user_id", null)');
    expect(linkSource).toContain("El broker cambió durante la operación");
    expect(unlinkSource).toContain('.eq("user_id", memberId)');
  });

  it("does not silently link an inactive or already assigned broker", () => {
    expect(linkSource).toContain("Activa primero el broker");
    expect(linkSource).toContain("Este broker ya está vinculado a otro usuario");
  });
});
