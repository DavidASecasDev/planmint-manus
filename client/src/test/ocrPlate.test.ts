import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock the LLM module before importing the handler
vi.mock("../../../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { handleOcrPlate } from "../../../server/ocrPlate";
import { invokeLLM } from "../../../server/_core/llm";

const mockedInvokeLLM = vi.mocked(invokeLLM);

function createMockReqRes(body: any = {}) {
  const req = {
    method: "POST",
    body,
  } as any;

  const res = {
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  } as any;

  return { req, res };
}

describe("handleOcrPlate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when image_base64 is missing", async () => {
    const { req, res } = createMockReqRes({});
    await handleOcrPlate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "image_base64 is required" })
    );
  });

  it("returns detected plate on success", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "1861MSD" },
          finish_reason: "stop",
        },
      ],
    });

    const { req, res } = createMockReqRes({ image_base64: "dGVzdA==" });
    await handleOcrPlate(req, res);
    expect(res.json).toHaveBeenCalledWith({ plate: "1861MSD", success: true });
  });

  it("returns success: false when no plate detected", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "NO_PLATE_DETECTED" },
          finish_reason: "stop",
        },
      ],
    });

    const { req, res } = createMockReqRes({ image_base64: "dGVzdA==" });
    await handleOcrPlate(req, res);
    expect(res.json).toHaveBeenCalledWith({ plate: "", success: false });
  });

  it("cleans plate with spaces and dashes", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "18-61 MSD" },
          finish_reason: "stop",
        },
      ],
    });

    const { req, res } = createMockReqRes({ image_base64: "dGVzdA==" });
    await handleOcrPlate(req, res);
    expect(res.json).toHaveBeenCalledWith({ plate: "1861MSD", success: true });
  });

  it("handles LLM errors gracefully", async () => {
    mockedInvokeLLM.mockRejectedValueOnce(new Error("LLM service unavailable"));

    const { req, res } = createMockReqRes({ image_base64: "dGVzdA==" });
    await handleOcrPlate(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "LLM service unavailable" })
    );
  });

  it("handles OPTIONS request for CORS", async () => {
    const req = { method: "OPTIONS", body: {} } as any;
    const res = {
      setHeader: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as any;

    await handleOcrPlate(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it("strips data URI prefix from base64", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "ABC1234" },
          finish_reason: "stop",
        },
      ],
    });

    const { req, res } = createMockReqRes({
      image_base64: "data:image/png;base64,dGVzdA==",
    });
    await handleOcrPlate(req, res);

    // Verify LLM was called with cleaned base64 (no data: prefix)
    expect(mockedInvokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "image_url",
                image_url: expect.objectContaining({
                  url: "data:image/png;base64,dGVzdA==",
                }),
              }),
            ]),
          }),
        ]),
      })
    );

    expect(res.json).toHaveBeenCalledWith({ plate: "ABC1234", success: true });
  });
});
