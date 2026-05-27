/**
 * Tests for the email and phone validation helpers used in CreateRentlyBookingDialog.
 * The helpers are pure functions extracted here for testing.
 */
import { describe, it, expect } from "vitest";

// ─── Replicate the same validation logic from the component ──────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?\d[\d\s\-().]{6,18}$/;

function validateEmail(email: string): string | null {
  if (!email.trim()) return null; // optional field
  if (!EMAIL_REGEX.test(email.trim())) return "Formato de email no válido";
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null; // optional field
  const cleaned = phone.trim();
  if (!cleaned.startsWith("+")) return "El teléfono debe incluir prefijo internacional (ej. +34)";
  if (!PHONE_REGEX.test(cleaned)) return "Formato de teléfono no válido";
  return null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("validateEmail", () => {
  it("returns null for empty string (optional)", () => {
    expect(validateEmail("")).toBeNull();
    expect(validateEmail("   ")).toBeNull();
  });

  it("accepts valid email addresses", () => {
    expect(validateEmail("user@example.com")).toBeNull();
    expect(validateEmail("john.doe@empresa.es")).toBeNull();
    expect(validateEmail("name+tag@domain.co.uk")).toBeNull();
    expect(validateEmail("test@sub.domain.com")).toBeNull();
  });

  it("rejects emails without @", () => {
    expect(validateEmail("noatsign.com")).toBe("Formato de email no válido");
  });

  it("rejects emails without domain", () => {
    expect(validateEmail("user@")).toBe("Formato de email no válido");
  });

  it("rejects emails without TLD (min 2 chars)", () => {
    expect(validateEmail("user@domain.c")).toBe("Formato de email no válido");
  });

  it("rejects emails with spaces", () => {
    expect(validateEmail("user @example.com")).toBe("Formato de email no válido");
  });

  it("rejects double @", () => {
    expect(validateEmail("user@@example.com")).toBe("Formato de email no válido");
  });
});

describe("validatePhone", () => {
  it("returns null for empty string (optional)", () => {
    expect(validatePhone("")).toBeNull();
    expect(validatePhone("   ")).toBeNull();
  });

  it("accepts valid international phone numbers", () => {
    expect(validatePhone("+34 612 345 678")).toBeNull();
    expect(validatePhone("+44 7911 123456")).toBeNull();
    expect(validatePhone("+1 555-0123")).toBeNull();
    expect(validatePhone("+49 170 1234567")).toBeNull();
    expect(validatePhone("+34612345678")).toBeNull();
  });

  it("rejects phone numbers without + prefix", () => {
    const result = validatePhone("34612345678");
    expect(result).toBe("El teléfono debe incluir prefijo internacional (ej. +34)");
  });

  it("rejects phone numbers without + prefix (local format)", () => {
    const result = validatePhone("612345678");
    expect(result).toBe("El teléfono debe incluir prefijo internacional (ej. +34)");
  });

  it("rejects too short phone numbers", () => {
    const result = validatePhone("+34 12");
    expect(result).toBe("Formato de teléfono no válido");
  });

  it("rejects phone numbers with letters", () => {
    const result = validatePhone("+34 abc def ghi");
    expect(result).toBe("Formato de teléfono no válido");
  });
});
