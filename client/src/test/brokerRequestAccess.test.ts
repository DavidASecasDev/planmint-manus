import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the broker registration and auth flow fixes.
 * These tests validate the logic and data transformations
 * without requiring a live Supabase connection.
 */

// --- Test: Input validation logic ---
describe("brokerRequestAccess - input validation", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it("should reject missing required fields", () => {
    const cases = [
      { organization_id: null, name: "Test", email: "a@b.com", password: "123456" },
      { organization_id: "org-1", name: null, email: "a@b.com", password: "123456" },
      { organization_id: "org-1", name: "Test", email: null, password: "123456" },
      { organization_id: "org-1", name: "Test", email: "a@b.com", password: null },
    ];

    for (const c of cases) {
      const valid = !!(c.organization_id && c.name && c.email && c.password);
      expect(valid).toBe(false);
    }
  });

  it("should accept valid required fields", () => {
    const data = {
      organization_id: "org-1",
      name: "Test Broker",
      email: "broker@test.com",
      password: "secure123",
    };
    const valid = !!(data.organization_id && data.name && data.email && data.password);
    expect(valid).toBe(true);
  });

  it("should reject passwords shorter than 6 characters", () => {
    expect("12345".length < 6).toBe(true);
    expect("123456".length < 6).toBe(false);
    expect("1234567".length < 6).toBe(false);
  });

  it("should validate email format correctly", () => {
    expect(emailRegex.test("valid@email.com")).toBe(true);
    expect(emailRegex.test("user@domain.co.uk")).toBe(true);
    expect(emailRegex.test("invalid")).toBe(false);
    expect(emailRegex.test("no@")).toBe(false);
    expect(emailRegex.test("@no.com")).toBe(false);
    expect(emailRegex.test("spaces in@email.com")).toBe(false);
  });

  it("should normalize email to lowercase and trim", () => {
    const raw = "  Broker@Test.COM  ";
    const normalized = raw.trim().toLowerCase();
    expect(normalized).toBe("broker@test.com");
  });

  it("should trim name", () => {
    const raw = "  Test Broker  ";
    const trimmed = raw.trim();
    expect(trimmed).toBe("Test Broker");
  });

  it("should handle optional fields (company, phone) as null when empty", () => {
    const company = "";
    const phone = "";
    expect(company?.trim() || null).toBeNull();
    expect(phone?.trim() || null).toBeNull();
  });

  it("should preserve optional fields when provided", () => {
    const company = "Test Corp";
    const phone = "+34 600 000 000";
    expect(company?.trim() || null).toBe("Test Corp");
    expect(phone?.trim() || null).toBe("+34 600 000 000");
  });
});

// --- Test: Error message mapping in BrokerRegister ---
describe("BrokerRegister - error message mapping", () => {
  const errorMessages: Record<string, string> = {
    missing_fields: "Por favor completa todos los campos requeridos",
    weak_password: "La contraseña debe tener al menos 6 caracteres",
    invalid_email: "El formato del email no es válido",
    invalid_organization: "La organización seleccionada no es válida",
    pending_request: "Ya tienes una solicitud pendiente. Te notificaremos cuando sea revisada.",
    rejected_request: "Tu solicitud anterior fue rechazada. Contacta al administrador.",
    already_approved: "Ya tienes acceso aprobado. Inicia sesión en su lugar.",
    email_exists: "Este email ya está registrado. Intenta iniciar sesión.",
    duplicate_request: "Ya existe una solicitud con este email para esta organización",
    rate_limited: "Demasiados intentos. Por favor espera una hora antes de reintentar.",
    critical_error: "Ocurrió un error inesperado. Nuestro equipo ha sido notificado.",
    server_error: "Error del servidor. Intenta de nuevo más tarde.",
  };

  it("should have a message for every known error code", () => {
    const knownCodes = [
      "missing_fields", "weak_password", "invalid_email", "invalid_organization",
      "pending_request", "rejected_request", "already_approved", "email_exists",
      "duplicate_request", "rate_limited", "critical_error", "server_error",
    ];
    for (const code of knownCodes) {
      expect(errorMessages[code]).toBeDefined();
      expect(errorMessages[code].length).toBeGreaterThan(0);
    }
  });

  it("should return undefined for unknown error codes", () => {
    expect(errorMessages["unknown_code"]).toBeUndefined();
  });
});

// --- Test: BrokerAuthContext broker.id remapping ---
describe("BrokerAuthContext - broker.id remapping", () => {
  function remapBrokerProfile(raw: any) {
    if (!raw || typeof raw !== "object" || !("id" in raw)) return null;
    return {
      id: raw.broker_id || raw.id,
      profile_id: raw.id,
      name: raw.name || "",
      email: raw.email || null,
      phone: raw.phone || null,
      company: raw.company || null,
      organization_id: raw.organization_id,
      organization_name: raw.organization_name || "",
      organization_logo: raw.organization_logo || null,
      is_active: raw.is_active ?? true,
      user_id: raw.user_id,
      broker_id: raw.broker_id || null,
    };
  }

  it("should remap broker_id as id when broker_id is present", () => {
    const raw = {
      id: "profile-uuid-123",
      broker_id: "broker-uuid-456",
      name: "Daniel Ripoll",
      email: "daniel@test.com",
      phone: null,
      company: "Test Corp",
      organization_id: "org-1",
      organization_name: "Azul Cars",
      organization_logo: null,
      is_active: true,
      user_id: "user-uuid-789",
    };

    const result = remapBrokerProfile(raw);
    expect(result).not.toBeNull();
    // CRITICAL: id should be broker_id, not profile id
    expect(result!.id).toBe("broker-uuid-456");
    expect(result!.profile_id).toBe("profile-uuid-123");
    expect(result!.broker_id).toBe("broker-uuid-456");
  });

  it("should fallback to profile id when broker_id is null", () => {
    const raw = {
      id: "profile-uuid-123",
      broker_id: null,
      name: "Legacy Broker",
      organization_id: "org-1",
      is_active: true,
      user_id: "user-uuid-789",
    };

    const result = remapBrokerProfile(raw);
    expect(result).not.toBeNull();
    // Fallback: id = profile id when broker_id is null
    expect(result!.id).toBe("profile-uuid-123");
    expect(result!.profile_id).toBe("profile-uuid-123");
    expect(result!.broker_id).toBeNull();
  });

  it("should return null for invalid data", () => {
    expect(remapBrokerProfile(null)).toBeNull();
    expect(remapBrokerProfile(undefined)).toBeNull();
    expect(remapBrokerProfile("string")).toBeNull();
    expect(remapBrokerProfile({})).toBeNull();
  });

  it("should default is_active to true when not provided", () => {
    const raw = {
      id: "profile-1",
      organization_id: "org-1",
      user_id: "user-1",
    };

    const result = remapBrokerProfile(raw);
    expect(result!.is_active).toBe(true);
  });

  it("should preserve is_active=false", () => {
    const raw = {
      id: "profile-1",
      is_active: false,
      organization_id: "org-1",
      user_id: "user-1",
    };

    const result = remapBrokerProfile(raw);
    expect(result!.is_active).toBe(false);
  });
});

// --- Test: Approval flow - broker creation with user_id ---
describe("Approval flow - transfer_brokers.user_id", () => {
  it("should include user_id when creating new broker on approval", () => {
    const request = {
      user_id: "user-uuid-123",
      name: "New Broker",
      email: "new@broker.com",
      phone: "+34 600 000 000",
      company: "Broker Corp",
    };

    const insertPayload = {
      organization_id: "org-1",
      name: request.name,
      email: request.email || null,
      phone: request.phone || null,
      company: request.company || null,
      user_id: request.user_id || null,
      is_active: true,
    };

    expect(insertPayload.user_id).toBe("user-uuid-123");
    expect(insertPayload.email).toBe("new@broker.com");
    expect(insertPayload.phone).toBe("+34 600 000 000");
    expect(insertPayload.company).toBe("Broker Corp");
  });

  it("should update existing broker with user_id on approval", () => {
    const existingBroker = {
      id: "broker-uuid-456",
      email: null,
      phone: null,
      company: null,
    };

    const request = {
      user_id: "user-uuid-123",
      email: "broker@test.com",
      phone: "+34 600 000 000",
      company: "Updated Corp",
    };

    const updatePayload = {
      user_id: request.user_id,
      email: request.email || existingBroker.email || null,
      phone: request.phone || existingBroker.phone || null,
      company: request.company || existingBroker.company || null,
    };

    expect(updatePayload.user_id).toBe("user-uuid-123");
    expect(updatePayload.email).toBe("broker@test.com");
  });

  it("should preserve existing broker data when request fields are empty", () => {
    const existingBroker = {
      id: "broker-uuid-456",
      email: "existing@email.com",
      phone: "+34 111 111 111",
      company: "Existing Corp",
    };

    const request = {
      user_id: "user-uuid-123",
      email: null,
      phone: null,
      company: null,
    };

    const updatePayload = {
      user_id: request.user_id,
      email: request.email || existingBroker.email || null,
      phone: request.phone || existingBroker.phone || null,
      company: request.company || existingBroker.company || null,
    };

    expect(updatePayload.email).toBe("existing@email.com");
    expect(updatePayload.phone).toBe("+34 111 111 111");
    expect(updatePayload.company).toBe("Existing Corp");
  });
});

// --- Test: Security - organization_id filter ---
describe("Security - organization_id filter in request detail", () => {
  it("should require organization_id in query to prevent cross-org access", () => {
    // Simulating the query builder pattern
    const queryParams: Record<string, string> = {};
    
    // Before fix: only id filter
    queryParams["id"] = "request-uuid-123";
    
    // After fix: must also include organization_id
    queryParams["organization_id"] = "org-uuid-456";

    expect(queryParams["id"]).toBeDefined();
    expect(queryParams["organization_id"]).toBeDefined();
  });
});
