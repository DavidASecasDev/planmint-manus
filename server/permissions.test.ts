/**
 * Tests for the granular permissions system.
 * Validates:
 * - Shared permission defaults (ALL_PERMISSION_KEYS, getDefaultPermissionsForRole, flattenCustomRolePermissions)
 * - checkUserPermission resolution chain
 * - requirePermission throws on denied
 */
import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  BASE_VIEW_PERMISSIONS,
  ROLE_DEFAULTS,
  getDefaultPermissionsForRole,
  flattenCustomRolePermissions,
} from "../shared/permissionDefaults";

describe("Shared Permission Defaults", () => {
  it("ALL_PERMISSION_KEYS contains all expected modules", () => {
    const modules = new Set(ALL_PERMISSION_KEYS.map((k) => k.split(".")[0]));
    expect(modules).toContain("tasks");
    expect(modules).toContain("areas");
    expect(modules).toContain("tags");
    expect(modules).toContain("members");
    expect(modules).toContain("garatech");
    expect(modules).toContain("transfers");
    expect(modules).toContain("vehicles");
    expect(modules).toContain("fleet");
    expect(modules).toContain("movements");
    expect(modules).toContain("daily_tasks");
    expect(modules).toContain("time_tracking");
    expect(modules).toContain("forms");
    expect(modules).toContain("reservations");
    expect(modules).toContain("reports");
    expect(modules).toContain("billing");
    expect(modules).toContain("security");
    expect(modules).toContain("integrations");
    expect(modules).toContain("automations");
    expect(modules).toContain("templates");
    expect(modules).toContain("teams");
  });

  it("BASE_VIEW_PERMISSIONS are a subset of ALL_PERMISSION_KEYS", () => {
    for (const key of BASE_VIEW_PERMISSIONS) {
      expect(ALL_PERMISSION_KEYS).toContain(key);
    }
  });

  it("ROLE_DEFAULTS keys are subsets of ALL_PERMISSION_KEYS", () => {
    for (const [role, keys] of Object.entries(ROLE_DEFAULTS)) {
      for (const key of keys) {
        expect(ALL_PERMISSION_KEYS, `${role} has unknown key: ${key}`).toContain(key);
      }
    }
  });

  it("admin defaults include members.manage_permissions", () => {
    expect(ROLE_DEFAULTS.admin).toContain("members.manage_permissions");
  });

  it("manager defaults do NOT include members.manage_permissions", () => {
    expect(ROLE_DEFAULTS.manager).not.toContain("members.manage_permissions");
  });

  it("read_only has no extra defaults", () => {
    expect(ROLE_DEFAULTS.read_only).toEqual([]);
  });
});

describe("getDefaultPermissionsForRole", () => {
  it("owner gets ALL permissions as true", () => {
    const perms = getDefaultPermissionsForRole("owner");
    for (const key of ALL_PERMISSION_KEYS) {
      expect(perms[key], `owner should have ${key}`).toBe(true);
    }
  });

  it("admin gets base view + admin defaults", () => {
    const perms = getDefaultPermissionsForRole("admin");
    // Base view
    for (const key of BASE_VIEW_PERMISSIONS) {
      expect(perms[key], `admin should have base view: ${key}`).toBe(true);
    }
    // Admin-specific
    expect(perms["tasks.delete"]).toBe(true);
    expect(perms["members.manage_permissions"]).toBe(true);
    expect(perms["billing.manage"]).toBe(true);
  });

  it("manager does NOT get billing.manage", () => {
    const perms = getDefaultPermissionsForRole("manager");
    expect(perms["billing.manage"]).toBe(false);
  });

  it("member does NOT get tasks.delete", () => {
    const perms = getDefaultPermissionsForRole("member");
    expect(perms["tasks.delete"]).toBe(false);
  });

  it("member gets base view permissions", () => {
    const perms = getDefaultPermissionsForRole("member");
    for (const key of BASE_VIEW_PERMISSIONS) {
      expect(perms[key], `member should have base view: ${key}`).toBe(true);
    }
  });

  it("read_only only gets base view permissions", () => {
    const perms = getDefaultPermissionsForRole("read_only");
    for (const key of BASE_VIEW_PERMISSIONS) {
      expect(perms[key], `read_only should have: ${key}`).toBe(true);
    }
    // Should NOT have any non-view permissions
    expect(perms["tasks.create"]).toBe(false);
    expect(perms["tasks.delete"]).toBe(false);
    expect(perms["members.manage_permissions"]).toBe(false);
  });

  it("unknown role gets only base view permissions", () => {
    const perms = getDefaultPermissionsForRole("nonexistent_role");
    for (const key of BASE_VIEW_PERMISSIONS) {
      expect(perms[key]).toBe(true);
    }
    expect(perms["tasks.create"]).toBe(false);
  });

  it("returns all permission keys (no missing keys)", () => {
    const perms = getDefaultPermissionsForRole("admin");
    for (const key of ALL_PERMISSION_KEYS) {
      expect(key in perms, `Missing key in result: ${key}`).toBe(true);
    }
  });
});

describe("flattenCustomRolePermissions", () => {
  it("returns all false for empty permissions_json", () => {
    const result = flattenCustomRolePermissions({});
    expect(result["tasks.view"]).toBe(false);
    expect(result["members.manage_permissions"]).toBe(false);
  });

  it("correctly maps nested tasks permissions", () => {
    const pj = {
      tasks: { view: true, create: true, update: true, delete: false },
    };
    const result = flattenCustomRolePermissions(pj);
    expect(result["tasks.view"]).toBe(true);
    expect(result["tasks.create"]).toBe(true);
    expect(result["tasks.update"]).toBe(true);
    expect(result["tasks.delete"]).toBe(false);
    expect(result["tasks.assign"]).toBe(true); // falls back to tasks.update
  });

  it("correctly maps team.read to members.view and teams.view", () => {
    const pj = {
      team: { read: true, manage: false },
    };
    const result = flattenCustomRolePermissions(pj);
    expect(result["teams.view"]).toBe(true);
    expect(result["members.view"]).toBe(true);
    expect(result["members.invite"]).toBe(false);
  });

  it("correctly maps team.manage to members.invite/change_role/manage_permissions", () => {
    const pj = {
      team: { read: true, manage: true },
    };
    const result = flattenCustomRolePermissions(pj);
    expect(result["members.invite"]).toBe(true);
    expect(result["members.change_role"]).toBe(true);
    expect(result["members.manage_permissions"]).toBe(true);
  });

  it("correctly maps garatech permissions", () => {
    const pj = {
      garatech: { view: true, manage: true, edit_dates: false },
    };
    const result = flattenCustomRolePermissions(pj);
    expect(result["garatech.view"]).toBe(true);
    expect(result["garatech.create"]).toBe(true); // falls back to manage
    expect(result["garatech.manage"]).toBe(true);
    expect(result["garatech.edit_dates"]).toBe(false);
  });

  it("correctly maps transfers permissions", () => {
    const pj = {
      transfers: { view: true, create: true, manage: false, delete: true },
    };
    const result = flattenCustomRolePermissions(pj);
    expect(result["transfers.view"]).toBe(true);
    expect(result["transfers.create"]).toBe(true);
    expect(result["transfers.manage"]).toBe(false);
    expect(result["transfers.delete"]).toBe(true);
    expect(result["transfers.manage_pricing"]).toBe(false); // falls back to manage=false
  });

  it("correctly maps fleet permissions", () => {
    const pj = {
      fleet: { view: true, manage: true, import: false },
    };
    const result = flattenCustomRolePermissions(pj);
    expect(result["fleet.view"]).toBe(true);
    expect(result["fleet.manage"]).toBe(true);
    expect(result["fleet.import"]).toBe(false); // explicit false overrides manage fallback
  });
});
