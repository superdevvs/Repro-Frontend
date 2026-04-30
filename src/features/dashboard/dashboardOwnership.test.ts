import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = (...parts: string[]) => resolve(__dirname, "..", "..", ...parts);
const readSource = (...parts: string[]) => readFileSync(srcPath(...parts), "utf8");

describe("dashboard role-owned runtime work", () => {
  it("keeps client billing owned by the client view", () => {
    const dashboardSource = readSource("pages", "Dashboard.tsx");
    const clientViewSource = readSource("features", "dashboard", "views", "ClientDashboardView.tsx");

    expect(dashboardSource).not.toContain("useClientBilling");
    expect(clientViewSource).toContain("useClientBilling");
    expect(clientViewSource).toContain("useClientDashboardMetrics");
  });

  it("keeps editor queue loading owned by the editor view", () => {
    const dashboardSource = readSource("pages", "Dashboard.tsx");
    const editorViewSource = readSource("features", "dashboard", "views", "EditorDashboardView.tsx");

    expect(dashboardSource).not.toContain("useEditorDashboardQueue");
    expect(editorViewSource).toContain("useEditorDashboardQueue");
    expect(editorViewSource).toContain("useEditorDashboardMetrics");
  });

  it("uses role-specific metric hooks from the dashboard route", () => {
    const dashboardSource = readSource("pages", "Dashboard.tsx");
    const metricsSource = readSource("features", "dashboard", "hooks", "useDashboardMetrics.tsx");

    expect(dashboardSource).toContain("useAdminDashboardMetrics");
    expect(dashboardSource).toContain("useSalesDashboardMetrics");
    expect(dashboardSource).not.toContain("useDashboardMetrics({");
    expect(metricsSource).toContain("export const useAdminDashboardMetrics");
    expect(metricsSource).toContain("export const useSalesDashboardMetrics");
    expect(metricsSource).toContain("export const useClientDashboardMetrics");
    expect(metricsSource).toContain("export const useEditorDashboardMetrics");
  });
});
