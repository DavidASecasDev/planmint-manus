/**
 * Tests for the validate-broker-invite endpoint and BrokerRegister integration.
 * Validates that invite validation is done server-side (bypassing RLS).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ENDPOINT_FILE = path.resolve(__dirname, "validateBrokerInvite.ts");
const endpointSource = fs.readFileSync(ENDPOINT_FILE, "utf-8");

const REGISTER_FILE = path.resolve(
  __dirname,
  "../client/src/pages/broker/BrokerRegister.tsx"
);
const registerSource = fs.readFileSync(REGISTER_FILE, "utf-8");

const INDEX_FILE = path.resolve(__dirname, "_core/index.ts");
const indexSource = fs.readFileSync(INDEX_FILE, "utf-8");

describe("validate-broker-invite endpoint", () => {
  it("should exist as a file", () => {
    expect(fs.existsSync(ENDPOINT_FILE)).toBe(true);
  });

  it("should export handleValidateBrokerInvite function", () => {
    expect(endpointSource).toContain(
      "export async function handleValidateBrokerInvite"
    );
  });

  it("should use getServiceClient (service role) to bypass RLS", () => {
    expect(endpointSource).toContain("getServiceClient");
    // Should NOT use the anon client
    expect(endpointSource).not.toContain("createClient");
  });

  it("should decode invite code server-side using Buffer", () => {
    expect(endpointSource).toContain("Buffer.from(base64");
  });

  it("should validate UUID format", () => {
    expect(endpointSource).toContain('[0-9a-f]{8}-[0-9a-f]{4}');
  });

  it("should query organizations table with status=active", () => {
    expect(endpointSource).toContain(".from('organizations')");
    expect(endpointSource).toContain(".eq('status', 'active')");
  });

  it("should return valid:true with organization data on success", () => {
    expect(endpointSource).toContain("valid: true");
    expect(endpointSource).toContain("organization:");
  });

  it("should return valid:false on invalid code", () => {
    expect(endpointSource).toContain("valid: false");
  });

  it("should handle missing invite_code", () => {
    expect(endpointSource).toContain("missing_code");
  });

  it("should handle invalid code format", () => {
    expect(endpointSource).toContain("invalid_code");
  });

  it("should handle org not found", () => {
    expect(endpointSource).toContain("org_not_found");
  });
});

describe("BrokerRegister uses Express endpoint", () => {
  it("should NOT import supabase client directly", () => {
    expect(registerSource).not.toContain(
      "import { supabase } from '@/integrations/supabase/client'"
    );
  });

  it("should NOT import decodeBrokerInviteCode", () => {
    expect(registerSource).not.toContain(
      "import { decodeBrokerInviteCode }"
    );
  });

  it("should call /api/validate-broker-invite endpoint", () => {
    expect(registerSource).toContain("/api/validate-broker-invite");
  });

  it("should send invite_code in the request body", () => {
    expect(registerSource).toContain("invite_code: inviteCode");
  });

  it("should check result.valid and result.organization", () => {
    expect(registerSource).toContain("result.valid");
    expect(registerSource).toContain("result.organization");
  });
});

describe("Endpoint is registered in server index", () => {
  it("should import handleValidateBrokerInvite", () => {
    expect(indexSource).toContain("handleValidateBrokerInvite");
  });

  it("should register POST /api/validate-broker-invite route", () => {
    expect(indexSource).toContain(
      '/api/validate-broker-invite", handleValidateBrokerInvite'
    );
  });

  it("should be registered before request-broker-access (public endpoints together)", () => {
    const validateIdx = indexSource.indexOf("validate-broker-invite");
    const requestIdx = indexSource.indexOf("request-broker-access");
    expect(validateIdx).toBeLessThan(requestIdx);
  });
});
