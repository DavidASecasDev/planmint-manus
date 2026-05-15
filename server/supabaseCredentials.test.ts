import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("Supabase Credentials Validation", () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  it("SUPABASE_URL should be set and point to the correct project", () => {
    expect(url).toBeDefined();
    expect(url).toBe("https://exayzwdudssyegxjiyrk.supabase.co");
  });

  it("SUPABASE_SERVICE_ROLE_KEY should be set and valid", () => {
    expect(serviceRoleKey).toBeDefined();
    expect(serviceRoleKey!.length).toBeGreaterThan(100);
    // Decode JWT to verify it's for the correct project and has service_role
    const payload = JSON.parse(
      Buffer.from(serviceRoleKey!.split(".")[1], "base64url").toString("utf-8")
    );
    expect(payload.ref).toBe("exayzwdudssyegxjiyrk");
    expect(payload.role).toBe("service_role");
  });

  it("SUPABASE_ANON_KEY should be set and valid", () => {
    expect(anonKey).toBeDefined();
    expect(anonKey!.length).toBeGreaterThan(100);
    const payload = JSON.parse(
      Buffer.from(anonKey!.split(".")[1], "base64url").toString("utf-8")
    );
    expect(payload.ref).toBe("exayzwdudssyegxjiyrk");
    expect(payload.role).toBe("anon");
  });

  it("Service role client can query the profiles table", async () => {
    const client = createClient(url!, serviceRoleKey!);
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .limit(1);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  it("Anon client can reach the auth endpoint", async () => {
    const client = createClient(url!, anonKey!);
    // getSession should work even without a logged-in user
    const { error } = await client.auth.getSession();
    expect(error).toBeNull();
  });
});
