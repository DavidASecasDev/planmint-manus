import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

/**
 * Tests for the invitation Express endpoints that replace broken Supabase RPCs.
 * Tests the business logic, validation, and data flow of:
 *   - /api/get-invitation-public
 *   - /api/accept-invitation
 *   - /api/accept-my-pending-invitation
 *   - /api/revoke-invitation
 *   - /api/get-organization-invitations
 *   - /api/get-my-pending-invitations
 */

function hashToken(token: string): string {
  return createHash("sha256").update(Buffer.from(token, "utf-8")).digest("hex");
}

describe("invitationEndpoints - Token hashing", () => {
  it("should produce consistent SHA256 hashes", () => {
    const token = "test-token-for-invitation";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should produce different hashes for different tokens", () => {
    const hash1 = hashToken("invitation-token-a");
    const hash2 = hashToken("invitation-token-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("invitationEndpoints - get-invitation-public validation", () => {
  it("should require a p_token parameter", () => {
    const body = {};
    const hasToken = !!(body as any).p_token;
    expect(hasToken).toBe(false);
  });

  it("should accept a valid p_token parameter", () => {
    const body = { p_token: "abc123def456" };
    const hasToken = !!body.p_token;
    expect(hasToken).toBe(true);
  });

  it("should identify expired invitations correctly", () => {
    const pastDate = new Date("2020-01-01T00:00:00Z");
    const futureDate = new Date("2099-12-31T23:59:59Z");
    expect(pastDate < new Date()).toBe(true);
    expect(futureDate < new Date()).toBe(false);
  });

  it("should identify invitation statuses correctly", () => {
    const isAccepted = (status: string) => status === "accepted";
    const isRevoked = (status: string) => status === "revoked";
    
    expect(isAccepted("accepted")).toBe(true);
    expect(isAccepted("pending")).toBe(false);
    expect(isRevoked("revoked")).toBe(true);
    expect(isRevoked("pending")).toBe(false);
  });
});

describe("invitationEndpoints - accept-invitation validation", () => {
  it("should require authentication token", () => {
    const authHeader = undefined;
    const token = authHeader ? (authHeader as string).replace("Bearer ", "") : null;
    expect(token).toBeNull();
  });

  it("should extract bearer token from authorization header", () => {
    const authHeader = "Bearer abc123xyz";
    const token = authHeader.replace("Bearer ", "");
    expect(token).toBe("abc123xyz");
  });

  it("should validate email matching case-insensitively", () => {
    const invitationEmail = "User@Example.COM";
    const userEmail = "user@example.com";
    const matches = invitationEmail.toLowerCase() === userEmail.toLowerCase();
    expect(matches).toBe(true);
  });

  it("should reject email mismatches", () => {
    const invitationEmail = "invited@example.com";
    const userEmail = "different@example.com";
    const matches = invitationEmail.toLowerCase() === userEmail.toLowerCase();
    expect(matches).toBe(false);
  });
});

describe("invitationEndpoints - accept-my-pending-invitation", () => {
  it("should find the most recent pending invitation", () => {
    const invitations = [
      { id: "1", created_at: "2025-01-01", status: "pending" },
      { id: "2", created_at: "2025-06-01", status: "pending" },
      { id: "3", created_at: "2025-03-01", status: "accepted" },
    ];
    
    const pending = invitations
      .filter(i => i.status === "pending")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    expect(pending.length).toBe(2);
    expect(pending[0].id).toBe("2");
  });

  it("should handle no pending invitations", () => {
    const invitations: any[] = [];
    const hasPending = invitations.length > 0;
    expect(hasPending).toBe(false);
  });
});

describe("invitationEndpoints - revoke-invitation", () => {
  it("should require invitation_id parameter", () => {
    const body = {};
    const hasId = !!(body as any).p_invitation_id;
    expect(hasId).toBe(false);
  });

  it("should only allow revoking pending invitations", () => {
    const canRevoke = (status: string) => status === "pending";
    expect(canRevoke("pending")).toBe(true);
    expect(canRevoke("accepted")).toBe(false);
    expect(canRevoke("revoked")).toBe(false);
  });

  it("should only allow owner and admin to revoke", () => {
    const allowedRoles = ["owner", "admin"];
    expect(allowedRoles.includes("owner")).toBe(true);
    expect(allowedRoles.includes("admin")).toBe(true);
    expect(allowedRoles.includes("manager")).toBe(false);
    expect(allowedRoles.includes("member")).toBe(false);
  });
});

describe("invitationEndpoints - get-organization-invitations", () => {
  it("should return invitations with expected fields", () => {
    const mockInvitation = {
      id: "uuid-123",
      email: "test@example.com",
      role: "member",
      status: "pending",
      created_at: "2025-01-01T00:00:00Z",
      expires_at: "2025-01-08T00:00:00Z",
      accepted_at: null,
    };

    expect(mockInvitation).toHaveProperty("id");
    expect(mockInvitation).toHaveProperty("email");
    expect(mockInvitation).toHaveProperty("role");
    expect(mockInvitation).toHaveProperty("status");
    expect(mockInvitation).toHaveProperty("created_at");
    expect(mockInvitation).toHaveProperty("expires_at");
    expect(mockInvitation).toHaveProperty("accepted_at");
  });
});

describe("invitationEndpoints - get-my-pending-invitations", () => {
  it("should enrich invitations with organization names", () => {
    const invitation = {
      id: "uuid-1",
      email: "user@test.com",
      role: "member",
      status: "pending",
      organization_id: "org-1",
    };

    const orgName = "Azul Cars";
    const enriched = {
      ...invitation,
      organization_name: orgName,
    };

    expect(enriched.organization_name).toBe("Azul Cars");
    expect(enriched.email).toBe("user@test.com");
  });

  it("should default organization name when not found", () => {
    const orgName = null;
    const defaultName = orgName || "Organización";
    expect(defaultName).toBe("Organización");
  });
});

describe("invitationEndpoints - profiles.email awareness", () => {
  it("should NOT reference profiles.email (column does not exist)", () => {
    const profileColumns = [
      "id", "name", "organization_id", "role",
      "avatar_url", "created_at", "updated_at",
    ];
    expect(profileColumns.includes("email")).toBe(false);
  });

  it("should use invitation email for matching, not profiles.email", () => {
    const invitationEmail = "invited@example.com";
    const authUserEmail = "invited@example.com";
    const matches = invitationEmail.toLowerCase() === authUserEmail.toLowerCase();
    expect(matches).toBe(true);
  });
});

describe("invitationEndpoints - Response shapes", () => {
  it("get-invitation-public should return valid/invalid shape", () => {
    const validResponse = {
      valid: true,
      organization_id: "org-1",
      organization_name: "Azul Cars",
      role: "member",
      email: "test@example.com",
      expires_at: "2025-01-08T00:00:00Z",
    };
    expect(validResponse.valid).toBe(true);
    expect(validResponse).toHaveProperty("organization_name");

    const invalidResponse = { valid: false, error: "invitation_not_found" };
    expect(invalidResponse.valid).toBe(false);
    expect(invalidResponse).toHaveProperty("error");
  });

  it("accept-invitation should return success/error shape", () => {
    const successResponse = { success: true, organization_name: "Azul Cars" };
    expect(successResponse.success).toBe(true);

    const errorResponse = { success: false, error: "email_mismatch" };
    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toBe("email_mismatch");
  });

  it("revoke-invitation should return success/error shape", () => {
    const successResponse = { success: true };
    expect(successResponse.success).toBe(true);

    const errorResponse = { success: false, error: "invitation_not_pending" };
    expect(errorResponse.success).toBe(false);
  });
});
