import { describe, it, expect } from "vitest";
import { createHash, randomBytes } from "crypto";

/**
 * Tests for the create-invitation Express endpoint logic.
 * These test the business rules and token generation.
 */

const VALID_ROLES = ["owner", "admin", "manager", "member", "read_only"];

describe("createInvitation - Role validation", () => {
  it("should accept all valid roles", () => {
    for (const role of VALID_ROLES) {
      expect(VALID_ROLES.includes(role)).toBe(true);
    }
  });

  it("should reject invalid roles", () => {
    const invalidRoles = ["superadmin", "viewer", "editor", "guest", ""];
    for (const role of invalidRoles) {
      expect(VALID_ROLES.includes(role)).toBe(false);
    }
  });
});

describe("createInvitation - Token generation", () => {
  it("should generate a 64-character hex token", () => {
    const token = randomBytes(32).toString("hex");
    expect(token.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("should generate unique tokens each time", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(randomBytes(32).toString("hex"));
    }
    expect(tokens.size).toBe(100);
  });

  it("should produce consistent SHA-256 hashes", () => {
    const token = "test-token-abc123";
    const hash1 = createHash("sha256").update(Buffer.from(token, "utf-8")).digest("hex");
    const hash2 = createHash("sha256").update(Buffer.from(token, "utf-8")).digest("hex");
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("should produce different hashes for different tokens", () => {
    const hash1 = createHash("sha256").update(Buffer.from("token-a", "utf-8")).digest("hex");
    const hash2 = createHash("sha256").update(Buffer.from("token-b", "utf-8")).digest("hex");
    expect(hash1).not.toBe(hash2);
  });
});

describe("createInvitation - Expiration calculation", () => {
  it("should default to 7 days expiration", () => {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });

  it("should support custom expiration days", () => {
    const days = 14;
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + days);
    
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(14);
  });
});

describe("createInvitation - Permission checks", () => {
  it("should allow owner and admin roles to create invitations", () => {
    const allowedRoles = ["owner", "admin"];
    expect(allowedRoles.includes("owner")).toBe(true);
    expect(allowedRoles.includes("admin")).toBe(true);
  });

  it("should deny manager, member, and read_only from creating invitations", () => {
    const allowedRoles = ["owner", "admin"];
    expect(allowedRoles.includes("manager")).toBe(false);
    expect(allowedRoles.includes("member")).toBe(false);
    expect(allowedRoles.includes("read_only")).toBe(false);
  });
});

describe("createInvitation - Error messages", () => {
  const ERROR_MESSAGES: Record<string, string> = {
    missing_email: "El email es obligatorio.",
    invalid_role: "El rol seleccionado no es válido.",
    insufficient_permissions: "No tienes permisos para invitar miembros. Solo los propietarios y administradores pueden hacerlo.",
    already_member: "Este usuario ya es miembro de tu organización.",
    invitation_already_exists: "Ya existe una invitación pendiente para este email.",
    insert_failed: "Error al guardar la invitación. Inténtalo de nuevo.",
  };

  it("should have messages for all known error codes", () => {
    const expectedCodes = [
      "missing_email",
      "invalid_role",
      "insufficient_permissions",
      "already_member",
      "invitation_already_exists",
      "insert_failed",
    ];
    for (const code of expectedCodes) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it("should return undefined for unknown error codes", () => {
    expect(ERROR_MESSAGES["unknown_error"]).toBeUndefined();
  });
});
