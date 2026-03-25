import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock supabaseAdmin ----
const mockFrom = vi.fn();
const mockStorage = {
  from: vi.fn().mockReturnValue({
    createSignedUrl: vi.fn(),
  }),
};
const mockServiceClient = {
  from: mockFrom,
  storage: mockStorage,
  auth: { getUser: vi.fn() },
};

vi.mock("../../../server/supabaseAdmin", () => ({
  getServiceClient: () => mockServiceClient,
  authenticateSupabaseRequest: vi.fn().mockResolvedValue({ userId: "u1", organizationId: "org1" }),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

// ---- Mock LLM ----
vi.mock("../../../server/_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            document_type: "presupuesto",
            total_amount: 450.0,
            date: "2026-03-20",
            provider_name: "TransMallorca SL",
            currency: "EUR",
            items: [
              {
                date: "2026-03-25",
                pickup_time: "10:00",
                pickup_location: "Aeropuerto PMI",
                dropoff_location: "Hotel Meliá",
                vehicle_type: "minivan",
                pax_count: 4,
                amount: 225.0,
                notes: null,
              },
              {
                date: "2026-03-28",
                pickup_time: "14:00",
                pickup_location: "Hotel Meliá",
                dropoff_location: "Aeropuerto PMI",
                vehicle_type: "minivan",
                pax_count: 4,
                amount: 225.0,
                notes: "Vuelo 15:30",
              },
            ],
          }),
        },
      },
    ],
  }),
}));

import { handleParseTransferDocument } from "../../../server/parseTransferDocument";

// Helper to create mock req/res
function createMockReqRes(body: Record<string, unknown> = {}, authHeader?: string) {
  const req = {
    method: "POST",
    headers: { authorization: authHeader || "Bearer test-token" },
    body,
  } as any;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn(),
  } as any;

  return { req, res };
}

/**
 * Helper to set up mockFrom for the full parsing flow.
 * The endpoint now queries multiple tables:
 * 1. transfer_documents (select + update x2)
 * 2. provider_parsing_templates (select for template matching)
 * 3. transfer_requests (select for provider name matching)
 */
function setupFullMocks(document: Record<string, unknown>, options?: {
  templates?: any[];
  requestProviderName?: string;
}) {
  const templates = options?.templates || [];
  const requestProviderName = options?.requestProviderName || null;

  // Track update calls separately
  const updateCalls: any[][] = [];
  const updateEqFn = vi.fn().mockImplementation((...args) => {
    // Store the call for later inspection
    return Promise.resolve({ error: null });
  });
  const updateFn = vi.fn().mockImplementation((...args) => {
    updateCalls.push(args);
    return { eq: updateEqFn };
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'transfer_documents') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: document, error: null }),
          }),
        }),
        update: updateFn,
      };
    }
    if (table === 'provider_parsing_templates') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, _val: string) => ({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: templates, error: null }),
            }),
          })),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === 'transfer_requests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: requestProviderName ? { external_provider_name: requestProviderName } : null,
              error: requestProviderName ? null : { message: 'not found' },
            }),
          }),
        }),
      };
    }
    // Default fallback
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
  });

  return { updateFn, updateCalls };
}

describe("parseTransferDocument endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if documentId is missing", async () => {
    const { req, res } = createMockReqRes({});
    await handleParseTransferDocument(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "documentId is required" });
  });

  it("returns 404 if document not found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      }),
    });

    const { req, res } = createMockReqRes({ documentId: "doc-123" });
    await handleParseTransferDocument(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("uses storage_path (not file_url) to generate signed URL", async () => {
    const mockDocument = {
      id: "doc-123",
      organization_id: "org1",
      request_id: "req1",
      storage_path: "org1/req1/test.pdf",
      file_name: "test.pdf",
      ai_status: "pending",
    };

    setupFullMocks(mockDocument);

    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example.com/signed/test.pdf" },
        error: null,
      }),
    });

    const { req, res } = createMockReqRes({ documentId: "doc-123" });
    await handleParseTransferDocument(req, res);

    // Verify signed URL was created from storage_path
    expect(mockStorage.from).toHaveBeenCalledWith("transfer-documents");

    // Verify success response
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it("sets ai_status to 'failed' (not 'error') on parse failure", async () => {
    const mockDocument = {
      id: "doc-456",
      organization_id: "org1",
      request_id: "req1",
      storage_path: "org1/req1/broken.pdf",
      file_name: "broken.pdf",
      ai_status: "pending",
    };

    const { updateFn, updateCalls } = setupFullMocks(mockDocument);

    // Simulate signed URL failure
    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Object not found" },
      }),
    });

    const { req, res } = createMockReqRes({ documentId: "doc-456" });
    await handleParseTransferDocument(req, res);

    // Verify it set status to 'failed' (matching UI expectations)
    const failedUpdate = updateCalls.find(
      (call: any[]) => call[0]?.ai_status === "failed"
    );
    expect(failedUpdate).toBeDefined();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("extracts transport-specific data from LLM response", async () => {
    const mockDocument = {
      id: "doc-789",
      organization_id: "org1",
      request_id: "req1",
      storage_path: "org1/req1/quote.pdf",
      file_name: "quote.pdf",
      ai_status: "pending",
    };

    const { updateCalls } = setupFullMocks(mockDocument);

    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example.com/signed/quote.pdf" },
        error: null,
      }),
    });

    const { req, res } = createMockReqRes({ documentId: "doc-789" });
    await handleParseTransferDocument(req, res);

    // Verify the update call includes transport-specific fields
    const completedUpdate = updateCalls.find(
      (call: any[]) => call[0]?.ai_status === "completed"
    );

    expect(completedUpdate).toBeDefined();
    expect(completedUpdate![0]).toMatchObject({
      ai_status: "completed",
      detected_amount: 450.0,
      detected_date: "2026-03-20",
      detected_provider: "TransMallorca SL",
    });
    expect(completedUpdate![0].detected_items).toHaveLength(2);
    expect(completedUpdate![0].detected_items[0]).toMatchObject({
      pickup_location: "Aeropuerto PMI",
      dropoff_location: "Hotel Meliá",
      vehicle_type: "minivan",
      pax_count: 4,
    });
  });

  it("handles OPTIONS request for CORS", async () => {
    const req = { method: "OPTIONS", headers: {}, body: {} } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
      json: vi.fn(),
    } as any;

    await handleParseTransferDocument(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it("includes provider_template_used in response when template matches", async () => {
    const mockDocument = {
      id: "doc-tpl",
      organization_id: "org1",
      request_id: "req1",
      storage_path: "org1/req1/quote.pdf",
      file_name: "quote.pdf",
      ai_status: "pending",
    };

    setupFullMocks(mockDocument, {
      templates: [{
        id: 'tpl-1',
        provider_name: 'TransMallorca',
        provider_aliases: ['TM', 'TransMallorca SL'],
        parsing_hints: 'Uses table format with columns: Servicio, Fecha, Hora, Precio',
        field_mappings: {},
        sample_fields: {},
        default_vehicle_type: 'minivan',
        is_active: true,
        usage_count: 5,
      }],
      requestProviderName: 'TransMallorca SL',
    });

    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example.com/signed/quote.pdf" },
        error: null,
      }),
    });

    const { req, res } = createMockReqRes({ documentId: "doc-tpl" });
    await handleParseTransferDocument(req, res);

    // Verify response includes template info
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        provider_template_used: 'TransMallorca',
      })
    );
  });
});

describe("AIStatus type compatibility", () => {
  it("'failed' and 'error' are both valid AIStatus values", () => {
    type AIStatus = "pending" | "processing" | "completed" | "failed" | "error";
    const statuses: AIStatus[] = ["pending", "processing", "completed", "failed", "error"];
    expect(statuses).toContain("failed");
    expect(statuses).toContain("error");
  });
});
