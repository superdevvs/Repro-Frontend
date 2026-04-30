import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, "..", "..");
const readSource = (...parts: string[]) => readFileSync(resolve(srcRoot, ...parts), "utf8");

const collectSourceFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((entry) => {
    const fullPath = resolve(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
};

describe("app-wide bundle boundaries", () => {
  it("keeps PDF and spreadsheet libraries out of static imports", () => {
    const staticHeavyImport = /^\s*import\s+(?:[^'"]+\s+from\s+)?['"](jspdf|xlsx)['"]/m;
    const offenders = collectSourceFiles(srcRoot).filter((filePath) =>
      staticHeavyImport.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps invoice viewing behind interaction-level lazy imports", () => {
    const dashboardSource = readSource("pages", "Dashboard.tsx");
    const accountingSource = readSource("pages", "Accounting.tsx");

    expect(dashboardSource).not.toMatch(/import\s+\{\s*InvoiceViewDialog\s*\}/);
    expect(accountingSource).not.toMatch(/import\s+\{\s*InvoiceViewDialog\s*\}/);
    expect(dashboardSource).toContain("LazyInvoiceViewDialog");
    expect(accountingSource).toContain("LazyInvoiceViewDialog");
  });

  it("keeps tour-heavy shoot details UI behind lazy boundaries", () => {
    const modalBodySource = readSource("components", "shoots", "details", "ShootDetailsModalBody.tsx");
    const shootDetailsPageSource = readSource("pages", "ShootDetails.tsx");

    expect(modalBodySource).not.toMatch(/import\s+\{\s*ShootDetailsTourTab\s*\}/);
    expect(shootDetailsPageSource).not.toMatch(/import\s+\{\s*ShootDetailsTourTab\s*\}/);
    expect(modalBodySource).toContain("LazyShootDetailsTourTab");
    expect(shootDetailsPageSource).toContain("LazyShootDetailsTourTab");
    expect(modalBodySource).toContain("LazyTourAnalyticsPanel");
  });

  it("does not load legacy Leaflet styles globally", () => {
    expect(readSource("main.tsx")).not.toContain("leaflet/dist/leaflet.css");
  });
});
