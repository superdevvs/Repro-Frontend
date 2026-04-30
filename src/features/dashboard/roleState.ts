import type { UserRole } from "@/types/auth";

export type DashboardRoleState =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "unsupported"; role: string }
  | { kind: UserRole };

export const DASHBOARD_ROLES = [
  "admin",
  "client",
  "editor",
  "editing_manager",
  "photographer",
  "salesRep",
  "superadmin",
] as const satisfies readonly UserRole[];

const DASHBOARD_ROLE_SET = new Set<string>(DASHBOARD_ROLES);

export const resolveDashboardRoleState = ({
  authLoading,
  canViewCurrentDashboard,
  permissionsLoading,
  role,
}: {
  authLoading: boolean;
  canViewCurrentDashboard: boolean;
  permissionsLoading: boolean;
  role: UserRole | string;
}): DashboardRoleState => {
  if (authLoading || permissionsLoading) return { kind: "loading" };

  if (!DASHBOARD_ROLE_SET.has(role)) {
    return { kind: "unsupported", role };
  }

  if (!canViewCurrentDashboard) return { kind: "denied" };

  return { kind: role as UserRole };
};
