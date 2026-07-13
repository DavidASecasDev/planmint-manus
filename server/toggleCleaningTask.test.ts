import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mock supabaseAdmin
vi.mock("./supabaseAdmin", () => ({
  getServiceClient: vi.fn(),
  authenticateSupabaseRequest: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

import { handleToggleCleaningTask } from "./toggleCleaningTaskEndpoint";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";

function mockReq(body: Record<string, unknown> = {}, authHeader = "Bearer valid-token"): Partial<Request> {
  return {
    headers: { authorization: authHeader },
    body,
  };
}

function mockRes(): Partial<Response> & { _status: number; _json: any } {
  const res: any = { _status: 200, _json: null };
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (data: any) => { res._json = data; return res; };
  return res;
}

describe("handleToggleCleaningTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    const { AuthError: AE } = await import("./supabaseAdmin");
    vi.mocked(authenticateSupabaseRequest).mockRejectedValue(new AE("Invalid or expired token", 401));

    const req = mockReq({ taskId: "abc", completed: true });
    const res = mockRes();

    await handleToggleCleaningTask(req as Request, res as unknown as Response);

    expect(res._status).toBe(401);
    expect(res._json.ok).toBe(false);
    expect(res._json.error).toContain("Invalid");
  });

  it("returns 400 when taskId is missing", async () => {
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    const req = mockReq({ completed: true }); // no taskId
    const res = mockRes();

    await handleToggleCleaningTask(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.ok).toBe(false);
    expect(res._json.error).toContain("taskId");
  });

  it("returns 400 when completed is not boolean", async () => {
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    const req = mockReq({ taskId: "abc", completed: "yes" });
    const res = mockRes();

    await handleToggleCleaningTask(req as Request, res as unknown as Response);

    expect(res._status).toBe(400);
    expect(res._json.ok).toBe(false);
  });

  it("returns 404 when task not found", async () => {
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    const mockSb: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(getServiceClient).mockReturnValue(mockSb);

    const req = mockReq({ taskId: "nonexistent", completed: true });
    const res = mockRes();

    await handleToggleCleaningTask(req as Request, res as unknown as Response);

    expect(res._status).toBe(404);
    expect(res._json.ok).toBe(false);
    expect(res._json.error).toContain("no encontrada");
  });

  it("returns 403 when vehicle belongs to different org", async () => {
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    let callCount = 0;
    const mockSb: any = {
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // vehicle_cleaning_tasks lookup
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "task-1", vehicle_id: "vehicle-1", task_key: "limpieza_int", completed: false },
              error: null,
            }),
          };
        }
        // vehicles lookup
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "vehicle-1", organization_id: "org-OTHER" },
            error: null,
          }),
        };
      }),
    };
    vi.mocked(getServiceClient).mockReturnValue(mockSb);

    const req = mockReq({ taskId: "task-1", completed: true });
    const res = mockRes();

    await handleToggleCleaningTask(req as Request, res as unknown as Response);

    expect(res._status).toBe(403);
    expect(res._json.ok).toBe(false);
    expect(res._json.error).toContain("permiso");
  });

  it("successfully toggles a task to completed", async () => {
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    let callCount = 0;
    const mockUpdate = vi.fn().mockReturnThis();
    const mockInsert = vi.fn().mockReturnThis();
    const mockThen = vi.fn().mockImplementation((cb) => {
      cb({ error: null });
      return Promise.resolve();
    });

    const mockSb: any = {
      from: vi.fn().mockImplementation((table: string) => {
        callCount++;
        if (callCount === 1) {
          // vehicle_cleaning_tasks lookup
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "task-1", vehicle_id: "vehicle-1", task_key: "limpieza_int", completed: false },
              error: null,
            }),
          };
        }
        if (callCount === 2) {
          // vehicles lookup
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "vehicle-1", organization_id: "org-1" },
              error: null,
            }),
          };
        }
        if (callCount === 3) {
          // vehicle_cleaning_tasks update
          return {
            update: mockUpdate,
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        // vehicle_cleaning_history insert
        return {
          insert: vi.fn().mockReturnValue({ then: mockThen }),
        };
      }),
    };
    vi.mocked(getServiceClient).mockReturnValue(mockSb);

    const req = mockReq({ taskId: "task-1", completed: true, vehicleId: "vehicle-1", taskKey: "limpieza_int" });
    const res = mockRes();

    await handleToggleCleaningTask(req as Request, res as unknown as Response);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.taskId).toBe("task-1");
    expect(res._json.completed).toBe(true);
    expect(res._json.completed_at).toBeTruthy();
  });

  it("successfully toggles a task to uncompleted", async () => {
    vi.mocked(authenticateSupabaseRequest).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });

    let callCount = 0;
    const mockSb: any = {
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // vehicle_cleaning_tasks lookup
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "task-1", vehicle_id: "vehicle-1", task_key: "limpieza_int", completed: true },
              error: null,
            }),
          };
        }
        if (callCount === 2) {
          // vehicles lookup
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "vehicle-1", organization_id: "org-1" },
              error: null,
            }),
          };
        }
        // vehicle_cleaning_tasks update
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    };
    vi.mocked(getServiceClient).mockReturnValue(mockSb);

    const req = mockReq({ taskId: "task-1", completed: false });
    const res = mockRes();

    await handleToggleCleaningTask(req as Request, res as unknown as Response);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.completed).toBe(false);
    expect(res._json.completed_at).toBeNull();
  });
});
