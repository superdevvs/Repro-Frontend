import { describe, expect, it } from "vitest";

import { DASHBOARD_ROLES, resolveDashboardRoleState } from "./roleState";

describe("resolveDashboardRoleState", () => {
  it("returns loading while auth is loading", () => {
    expect(
      resolveDashboardRoleState({
        authLoading: true,
        canViewCurrentDashboard: true,
        permissionsLoading: false,
        role: "admin",
      }),
    ).toEqual({ kind: "loading" });
  });

  it("returns loading while permissions are loading", () => {
    expect(
      resolveDashboardRoleState({
        authLoading: false,
        canViewCurrentDashboard: true,
        permissionsLoading: true,
        role: "client",
      }),
    ).toEqual({ kind: "loading" });
  });

  it("returns denied for recognized roles without dashboard permission", () => {
    expect(
      resolveDashboardRoleState({
        authLoading: false,
        canViewCurrentDashboard: false,
        permissionsLoading: false,
        role: "editor",
      }),
    ).toEqual({ kind: "denied" });
  });

  it("returns unsupported for unrecognized roles", () => {
    expect(
      resolveDashboardRoleState({
        authLoading: false,
        canViewCurrentDashboard: true,
        permissionsLoading: false,
        role: "owner",
      }),
    ).toEqual({ kind: "unsupported", role: "owner" });
  });

  it.each(DASHBOARD_ROLES)("returns %s for recognized roles with permission", (role) => {
    expect(
      resolveDashboardRoleState({
        authLoading: false,
        canViewCurrentDashboard: true,
        permissionsLoading: false,
        role,
      }),
    ).toEqual({ kind: role });
  });
});
