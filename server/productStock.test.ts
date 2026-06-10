import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for Product Stock Endpoints
 * Tests the endpoint handler logic for product categories and shortage reports
 */

// Mock the dependencies
vi.mock("./supabaseAdmin", () => ({
  getServiceClient: vi.fn(),
  authenticateSupabaseRequest: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("./permissionHelper", () => ({
  checkUserPermission: vi.fn(),
}));

import {
  handleGetProductCategories,
  handleCreateProductCategory,
  handleUpdateProductCategory,
  handleDeleteProductCategory,
  handleGetShortageReports,
  handleGetShortageReportsCount,
  handleCreateShortageReport,
  handleResolveShortageReport,
  handleUnresolveShortageReport,
  handleDeleteShortageReport,
} from "./productStockEndpoints";
import { getServiceClient, authenticateSupabaseRequest } from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

function mockReq(body = {}, headers = { authorization: "Bearer test-token" }) {
  return { body, headers } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("Product Stock Endpoints", () => {
  const mockUserId = "user-123";
  const mockOrgId = "org-456";

  beforeEach(() => {
    vi.clearAllMocks();
    (authenticateSupabaseRequest as any).mockResolvedValue({
      userId: mockUserId,
      organizationId: mockOrgId,
    });
  });

  describe("GET /api/product-categories", () => {
    it("should return categories for the organization", async () => {
      const mockCategories = [
        { id: "cat-1", name: "Limpiacristales", icon: null },
        { id: "cat-2", name: "Ambientador", icon: "spray" },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({ data: mockCategories, error: null });

      (getServiceClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
          eq: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      });

      const req = mockReq();
      const res = mockRes();

      await handleGetProductCategories(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, data: mockCategories });
    });

    it("should return 400 if no organization", async () => {
      (authenticateSupabaseRequest as any).mockResolvedValue({
        userId: mockUserId,
        organizationId: null,
      });

      const req = mockReq();
      const res = mockRes();

      await handleGetProductCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "No organization" });
    });
  });

  describe("POST /api/create-product-category", () => {
    it("should create a category when admin has permission", async () => {
      const newCategory = { id: "cat-new", name: "Cera", icon: null };

      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      const mockSingle = vi.fn().mockResolvedValue({ data: newCategory, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      (getServiceClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const req = mockReq({ name: "Cera" });
      const res = mockRes();

      await handleCreateProductCategory(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, data: newCategory });
    });

    it("should return 403 if user has no permission", async () => {
      (checkUserPermission as any).mockResolvedValue({ allowed: false });

      (getServiceClient as any).mockReturnValue({});

      const req = mockReq({ name: "Cera" });
      const res = mockRes();

      await handleCreateProductCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "No permission" });
    });

    it("should return 400 if name is empty", async () => {
      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      (getServiceClient as any).mockReturnValue({});

      const req = mockReq({ name: "  " });
      const res = mockRes();

      await handleCreateProductCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "El nombre es obligatorio" });
    });
  });

  describe("POST /api/create-shortage-report", () => {
    it("should create a shortage report when user has preparation.view permission", async () => {
      const newReport = { id: "report-1", category_id: "cat-1", product_name: "Sonax" };

      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      const mockSingle = vi.fn().mockResolvedValue({ data: newReport, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      (getServiceClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const req = mockReq({
        category_id: "cat-1",
        product_name: "Sonax",
        product_brand: "Sonax GmbH",
        notes: "Se acabó ayer",
      });
      const res = mockRes();

      await handleCreateShortageReport(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, data: newReport });
    });

    it("should return 400 if no category_id provided", async () => {
      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      (getServiceClient as any).mockReturnValue({});

      const req = mockReq({ product_name: "Sonax" });
      const res = mockRes();

      await handleCreateShortageReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Debes seleccionar una categoría" });
    });
  });

  describe("POST /api/resolve-shortage-report", () => {
    it("should resolve a shortage report when admin has permission", async () => {
      const resolvedReport = { id: "report-1", status: "resolved" };

      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      const mockSingle = vi.fn().mockResolvedValue({ data: resolvedReport, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });

      (getServiceClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: mockUpdate,
        }),
      });

      const req = mockReq({ id: "report-1" });
      const res = mockRes();

      await handleResolveShortageReport(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, data: resolvedReport });
    });

    it("should return 400 if no id provided", async () => {
      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      (getServiceClient as any).mockReturnValue({});

      const req = mockReq({});
      const res = mockRes();

      await handleResolveShortageReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Missing id" });
    });
  });

  describe("POST /api/unresolve-shortage-report", () => {
    it("should unresolve a shortage report when admin has permission", async () => {
      const unresolvedReport = { id: "report-1", status: "pending" };

      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      const mockSingle = vi.fn().mockResolvedValue({ data: unresolvedReport, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });

      (getServiceClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: mockUpdate,
        }),
      });

      const req = mockReq({ id: "report-1" });
      const res = mockRes();

      await handleUnresolveShortageReport(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, data: unresolvedReport });
    });
  });

  describe("GET /api/product-shortage-reports-count", () => {
    it("should return count of pending reports", async () => {
      const mockHead = vi.fn().mockResolvedValue({ count: 5, error: null });
      const mockEq2 = vi.fn().mockReturnValue(mockHead());
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

      (getServiceClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const req = mockReq();
      const res = mockRes();

      await handleGetShortageReportsCount(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true, count: 5 });
    });
  });

  describe("DELETE /api/product-shortage-reports", () => {
    it("should delete a shortage report when admin has permission", async () => {
      (checkUserPermission as any).mockResolvedValue({ allowed: true });

      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });

      (getServiceClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
        }),
      });

      const req = mockReq({ id: "report-1" });
      const res = mockRes();

      await handleDeleteShortageReport(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it("should return 403 if user has no permission", async () => {
      (checkUserPermission as any).mockResolvedValue({ allowed: false });

      (getServiceClient as any).mockReturnValue({});

      const req = mockReq({ id: "report-1" });
      const res = mockRes();

      await handleDeleteShortageReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "No permission" });
    });
  });
});
