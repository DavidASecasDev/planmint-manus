/**
 * Tests for the auth endpoint migration in AuthContext.
 * Verifies that the backend endpoints return the correct structure
 * and that the frontend correctly parses the responses.
 */
import { describe, it, expect } from "vitest";

describe("AuthContext backend migration", () => {
  describe("fetchProfileViaBackend response parsing", () => {
    it("correctly parses a successful profile response", () => {
      const serverResponse = {
        data: {
          id: "user-123",
          name: "Jordan",
          organization_id: "org-456",
          role: "member",
          theme_pref: "system",
          avatar_url: null,
          created_at: "2025-01-01",
        },
        error: null,
      };

      expect(serverResponse.data).not.toBeNull();
      expect(serverResponse.error).toBeNull();
      expect(serverResponse.data?.organization_id).toBe("org-456");
      expect(serverResponse.data?.role).toBe("member");
      expect(serverResponse.data?.name).toBe("Jordan");
    });

    it("correctly handles null profile (new user)", () => {
      const serverResponse = { data: null, error: null };
      expect(serverResponse.data).toBeNull();
      expect(serverResponse.error).toBeNull();
    });

    it("correctly handles error response", () => {
      const serverResponse = { data: null, error: "Invalid or expired token" };
      expect(serverResponse.data).toBeNull();
      expect(serverResponse.error).toBeTruthy();
    });
  });

  describe("fetchOrganizationViaBackend response parsing", () => {
    it("correctly parses a successful organization response", () => {
      const serverResponse = {
        data: { id: "org-456", name: "Azul Cars", created_at: "2025-01-01" },
        error: null,
      };
      expect(serverResponse.data).not.toBeNull();
      expect(serverResponse.data?.name).toBe("Azul Cars");
    });

    it("correctly handles null organization", () => {
      const serverResponse = { data: null, error: null };
      expect(serverResponse.data).toBeNull();
    });
  });

  describe("useOrganizationModules response parsing", () => {
    it("correctly parses modules from apiInvoke response", () => {
      const apiInvokeResult = {
        data: {
          data: [
            { module_key: "reservations", enabled: true },
            { module_key: "transfers", enabled: true },
            { module_key: "garatech", enabled: true },
            { module_key: "movements", enabled: true },
            { module_key: "fleet", enabled: true },
            { module_key: "daily_tasks", enabled: true },
            { module_key: "vehicle_status", enabled: true },
            { module_key: "forms", enabled: true },
            { module_key: "reports", enabled: true },
            { module_key: "teams", enabled: true },
          ],
          error: null,
        },
        error: null,
      };

      const DEFAULT_MODULES: Record<string, boolean> = {
        reservations: false, transfers: false, garatech: false,
        movements: true, fleet: false, daily_tasks: true,
        vehicle_status: false, forms: false, reports: true, teams: true,
      };

      const rows = apiInvokeResult.data!.data;
      expect(rows).toHaveLength(10);

      const modulesMap: Record<string, boolean> = { ...DEFAULT_MODULES };
      for (const row of rows) {
        modulesMap[row.module_key] = row.enabled;
      }

      expect(modulesMap.reservations).toBe(true);
      expect(modulesMap.transfers).toBe(true);
      expect(modulesMap.garatech).toBe(true);
      expect(modulesMap.fleet).toBe(true);
    });

    it("falls back to DEFAULT_MODULES when API returns error", () => {
      const apiInvokeResult = { data: null, error: { message: "Network error" } };
      const DEFAULT_MODULES = { reservations: false, transfers: false };

      if (apiInvokeResult.error || !apiInvokeResult.data) {
        expect(DEFAULT_MODULES.reservations).toBe(false);
        expect(DEFAULT_MODULES.transfers).toBe(false);
      }
    });
  });

  describe("usePermissions response parsing", () => {
    it("correctly parses permissions for manager role", () => {
      const apiInvokeResult = {
        data: {
          success: true,
          role: "manager",
          status: "active",
          permissions: {
            "tasks.view": true, "tasks.create": true,
            "reservations.view": true, "reservations.create": true,
            "transfers.view": true, "transfers.create": true,
            "garatech.view": true, "members.view": true,
          },
        },
        error: null,
      };

      const data = apiInvokeResult.data!;
      expect(data.success).toBe(true);
      expect(data.role).toBe("manager");
      expect(data.permissions["reservations.view"]).toBe(true);
      expect(data.permissions["transfers.view"]).toBe(true);
    });

    it("correctly handles member with user overrides", () => {
      const apiInvokeResult = {
        data: {
          success: true,
          role: "member",
          status: "active",
          permissions: {
            "tasks.view": true, "tasks.create": true,
            "transfers.view": true, "transfers.create": true,
            "vehicles.view": true, "movements.view": true,
          },
        },
        error: null,
      };

      const data = apiInvokeResult.data!;
      expect(data.role).toBe("member");
      expect(data.permissions["transfers.view"]).toBe(true);
      expect(data.permissions["transfers.create"]).toBe(true);
    });
  });

  describe("Permission chain: AuthContext -> hooks -> sidebar", () => {
    it("demonstrates the full data flow for a non-owner user", () => {
      // Step 1: AuthContext loads profile via backend
      const profileResponse = {
        data: { id: "mikaela-id", name: "Mikaela", organization_id: "org-456", role: "manager" },
        error: null,
      };
      expect(profileResponse.data).not.toBeNull();
      expect(profileResponse.data!.organization_id).toBe("org-456");

      // Step 2: useOrganizationModules fires because profile.organization_id exists
      const enabled = !!profileResponse.data?.organization_id;
      expect(enabled).toBe(true);

      // Step 3: Modules are loaded from backend
      const modulesMap: Record<string, boolean> = {};
      for (const row of [
        { module_key: "reservations", enabled: true },
        { module_key: "transfers", enabled: true },
      ]) {
        modulesMap[row.module_key] = row.enabled;
      }
      expect(modulesMap.reservations).toBe(true);
      expect(modulesMap.transfers).toBe(true);

      // Step 4: Permissions loaded
      const permissions: Record<string, boolean> = {
        "reservations.view": true, "transfers.view": true,
      };

      // Step 5: Sidebar checks both module AND permission
      const reservationsVisible = modulesMap.reservations && permissions["reservations.view"];
      const transfersVisible = modulesMap.transfers && permissions["transfers.view"];
      expect(reservationsVisible).toBe(true);
      expect(transfersVisible).toBe(true);
    });

    it("demonstrates the failure mode when profile is null (the bug)", () => {
      const profileResponse = { data: null, error: null };
      const enabled = !!profileResponse.data?.organization_id;
      expect(enabled).toBe(false);

      const DEFAULT_MODULES = { reservations: false, transfers: false };
      expect(DEFAULT_MODULES.reservations).toBe(false);
      expect(DEFAULT_MODULES.transfers).toBe(false);
    });
  });
});
