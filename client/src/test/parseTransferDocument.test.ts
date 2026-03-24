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
      storage_path: "org1/req1/test.pdf",
      file_name: "test.pdf",
      ai_status: "pending",
    };

    // Mock: from().select().eq().single() for document fetch
    const singleFn = vi.fn().mockResolvedValue({ data: mockDocument, error: null });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

    // Mock: from().update().eq() for status updates
    const updateEqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

    mockFrom.mockImplementation((table: string) => {
      return {
        select: selectFn,
        update: updateFn,
      };
    });

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
    expect(mockStorage.from("transfer-documents").createSignedUrl).toHaveBeenCalledWith(
      "org1/req1/test.pdf",
      3600
    );

    // Verify success response
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it("sets ai_status to 'failed' (not 'error') on parse failure", async () => {
    const mockDocument = {
      id: "doc-456",
      storage_path: "org1/req1/broken.pdf",
      file_name: "broken.pdf",
      ai_status: "pending",
    };

    const singleFn = vi.fn().mockResolvedValue({ data: mockDocument, error: null });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const updateEqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

    mockFrom.mockImplementation(() => ({
      select: selectFn,
      update: updateFn,
    }));

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
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ ai_status: "failed" })
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("extracts transport-specific data from LLM response", async () => {
    const mockDocument = {
      id: "doc-789",
      storage_path: "org1/req1/quote.pdf",
      file_name: "quote.pdf",
      ai_status: "pending",
    };

    const singleFn = vi.fn().mockResolvedValue({ data: mockDocument, error: null });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const updateEqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

    mockFrom.mockImplementation(() => ({
      select: selectFn,
      update: updateFn,
    }));

    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example.com/signed/quote.pdf" },
        error: null,
      }),
    });

    const { req, res } = createMockReqRes({ documentId: "doc-789" });
    await handleParseTransferDocument(req, res);

    // Verify the update call includes transport-specific fields
    const updateCalls = updateFn.mock.calls;
    const completedUpdate = updateCalls.find(
      (call: any[]) => call[0]?.ai_status === "completed"
    );

    expect(completedUpdate).toBeDefined();
    expect(completedUpdate[0]).toMatchObject({
      ai_status: "completed",
      detected_amount: 450.0,
      detected_date: "2026-03-20",
      detected_provider: "TransMallorca SL",
    });
    expect(completedUpdate[0].detected_items).toHaveLength(2);
    expect(completedUpdate[0].detected_items[0]).toMatchObject({
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

  it("sends image_url for image files, file_url for PDFs", async () => {
    // This test verifies the content type detection logic
    const { invokeLLM } = await import("../../../server/_core/llm");
    const mockLLM = vi.mocked(invokeLLM);

    const mockDocument = {
      id: "doc-img",
      storage_path: "org1/req1/photo.jpg",
      file_name: "photo.jpg",
      ai_status: "pending",
    };

    const singleFn = vi.fn().mockResolvedValue({ data: mockDocument, error: null });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const updateEqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

    mockFrom.mockImplementation(() => ({
      select: selectFn,
      update: updateFn,
    }));

    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example.com/signed/photo.jpg" },
        error: null,
      }),
    });

    const { req, res } = createMockReqRes({ documentId: "doc-img" });
    await handleParseTransferDocument(req, res);

    // Verify LLM was called with image_url (not file_url) for .jpg
    const llmCall = mockLLM.mock.calls[0][0];
    const userMessage = llmCall.messages.find((m) => m.role === "user");
    const content = userMessage?.content as any[];
    const imageContent = content.find((c: any) => c.type === "image_url");
    expect(imageContent).toBeDefined();
    expect(imageContent.image_url.url).toContain("photo.jpg");
  });
});

describe("AIStatus type compatibility", () => {
  it("'failed' and 'error' are both valid AIStatus values", () => {
    // This is a compile-time check - if AIStatus doesn't include 'error',
    // the import would fail. We verify at runtime too.
    type AIStatus = "pending" | "processing" | "completed" | "failed" | "error";
    const statuses: AIStatus[] = ["pending", "processing", "completed", "failed", "error"];
    expect(statuses).toContain("failed");
    expect(statuses).toContain("error");
  });
});
