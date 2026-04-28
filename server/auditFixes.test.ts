import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("Audit FIX-11: Dead code files removed", () => {
  const deadFiles = [
    "client/src/hooks/useBillingProducts.ts",
    "client/src/hooks/useDashboardStats.ts",
    "client/src/hooks/useFeatureFlags.ts",
    "client/src/hooks/useSubtasks.ts",
    "client/src/pages/Billing.tsx",
    "client/src/pages/EnterpriseSettings.tsx",
  ];

  for (const file of deadFiles) {
    it(`should not have dead code file: ${file}`, () => {
      const fullPath = path.join(ROOT, file);
      expect(fs.existsSync(fullPath)).toBe(false);
    });
  }
});

describe("Audit FIX-12: Error handling in endpoints", () => {
  it("vapidKey.ts should have try/catch", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "server/vapidKey.ts"),
      "utf-8"
    );
    expect(content).toContain("try {");
    expect(content).toContain("catch");
  });

  it("ocrPlate.ts should have try/catch", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "server/ocrPlate.ts"),
      "utf-8"
    );
    expect(content).toContain("try {");
    expect(content).toContain("catch");
  });
});

describe("Audit: No legacy RPC calls in production code", () => {
  it("should not have any .rpc() calls in client/src (excluding test files)", () => {
    const clientDir = path.join(ROOT, "client/src");

    function findRpcCalls(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "test") continue;
          results.push(...findRpcCalls(fullPath));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
          !entry.name.includes(".test.")
        ) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(".rpc(")) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const filesWithRpc = findRpcCalls(clientDir);
    expect(filesWithRpc).toEqual([]);
  });
});
