import { beforeEach, describe, expect, it } from "vitest";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  isPrivateNetworkAddress,
  signWebhookPayload,
} from "./externalWebhookSecurity";

describe("externalWebhookSecurity", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "synthetic-test-secret";
  });

  it("encrypts secrets with authenticated encryption and restores them", () => {
    const encrypted = encryptWebhookSecret("whsec_synthetic");
    expect(encrypted).not.toContain("whsec_synthetic");
    expect(decryptWebhookSecret(encrypted)).toBe("whsec_synthetic");
  });

  it("signs timestamp and body deterministically", () => {
    expect(signWebhookPayload("secret", "123", "{\"ok\":true}"))
      .toBe(signWebhookPayload("secret", "123", "{\"ok\":true}"));
    expect(signWebhookPayload("secret", "124", "{\"ok\":true}"))
      .not.toBe(signWebhookPayload("secret", "123", "{\"ok\":true}"));
  });

  it("rejects loopback, private, link-local and mapped private addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateNetworkAddress(address), address).toBe(true);
    }
    expect(isPrivateNetworkAddress("8.8.8.8")).toBe(false);
    expect(isPrivateNetworkAddress("2606:4700:4700::1111")).toBe(false);
  });
});
