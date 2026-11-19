import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, "..", "..", "..");
const thisFile = fileURLToPath(import.meta.url);

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const fullPath = resolve(directory, entry);
    if (statSync(fullPath).isDirectory()) return collectSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });

describe("client dashboard account notices", () => {
  // The owner asked for the Outlook / Microsoft email advisory to be removed from client accounts.
  it("does not show the Microsoft / Outlook email advisory to clients", () => {
    const clientDashboard = readFileSync(resolve(__dirname, "ClientDashboardView.tsx"), "utf8");

    expect(clientDashboard).not.toMatch(/MicrosoftEmailNotice/);
    expect(clientDashboard).not.toMatch(/Microsoft email|Outlook/i);
    expect(
      existsSync(resolve(srcRoot, "features", "dashboard", "components", "MicrosoftEmailNotice.tsx")),
    ).toBe(false);
  });

  it("leaves no other screen rendering the advisory", () => {
    const offenders = collectSourceFiles(srcRoot).filter(
      (filePath) =>
        filePath !== thisFile &&
        /MicrosoftEmailNotice|Microsoft email delays/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders).toEqual([]);
  }, 15000);
});
