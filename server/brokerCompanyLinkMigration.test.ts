import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20260917100000_broker_company_link_rpc.sql"
);
const rollbackPath = path.resolve(
  __dirname,
  "../supabase/rollbacks/20260917100000_broker_company_link_rpc.rollback.sql"
);
const scriptPath = path.resolve(
  __dirname,
  "../scripts/test-broker-company-link-migration.sh"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const fixtureScript = fs.readFileSync(scriptPath, "utf8");

describe("broker company link migration contract", () => {
  it("is additive and contains no destructive table/data statements", () => {
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.link_broker_profile_to_company");
  });

  it("locks and revalidates the portal profile and broker before writing", () => {
    expect(migration).toContain("FROM public.broker_profiles bp");
    expect(migration).toContain("FROM public.transfer_brokers tb");
    expect((migration.match(/FOR UPDATE/g) || [])).toHaveLength(4);
    expect(migration).toContain("broker_link_changed");
  });

  it("is service-role only with a fixed search path", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = public, pg_temp");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("keeps rollback limited to the exact new function", () => {
    expect(rollback).toContain(
      "DROP FUNCTION IF EXISTS public.link_broker_profile_to_company(uuid, uuid, uuid, uuid, text)"
    );
    expect(rollback).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(rollback).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("has an executable PostgreSQL fixture covering both concurrency orders", () => {
    expect(fixtureScript).toContain("migration fixture OK");
    expect(fixtureScript).toContain("concurrent unlink serialized both orders");
    expect(fixtureScript).toContain("SET ROLE authenticated");
    expect(fixtureScript).toContain("SET ROLE service_role");
  });
});
