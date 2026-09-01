import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260901124500_external_transfers_bidirectional_api.sql"),
  "utf8",
);

describe("external Transfers API migration", () => {
  it("is forward-only, additive and idempotent", () => {
    expect(sql).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE)\b/im);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.external_api_idempotency");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.external_api_webhooks");
    expect(sql).toContain("external_api_idempotency_transfer_idx");
    expect(sql).toContain("external_api_webhooks_created_by_idx");
    expect(sql).toContain("ON CONFLICT (singleton_key) DO NOTHING");
  });

  it("implements atomic numbering, creation and cancellation", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("create_external_transfer_v1");
    expect(sql).toContain("cancel_external_transfer_v1");
    expect(sql).toContain("IDEMPOTENCY_CONFLICT");
    expect(sql).toContain("CANCELLATION_NOT_ALLOWED");
  });

  it("uses RLS, service-role-only RPCs and an atomic webhook claim", () => {
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("claim_external_api_webhook_deliveries");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.create_external_transfer_v1");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.claim_external_api_webhook_deliveries(integer) TO service_role");
  });
});
