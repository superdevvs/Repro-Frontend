import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildChunkRecoveryUrl,
  isRecoverableChunkError,
} from "./chunkLoadRecovery";

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

const browser = (href = 'https://reprodashboard.com/dashboard') => {
  const url = new URL(href);
  const stored = new Map<string, string>();
  const replace = vi.fn();
  const sessionStorage = {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stored.set(key, value); }),
  };
  vi.stubGlobal('window', {
    location: { href, pathname: url.pathname, search: url.search, hash: url.hash, replace },
    sessionStorage,
  });
  return { replace, sessionStorage, stored };
};

describe("isRecoverableChunkError", () => {
  it("matches Vite dynamic import fetch failures", () => {
    expect(
      isRecoverableChunkError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://reprodashboard.com/assets/ShootHistory-old.js"
        )
      )
    ).toBe(true);
  });

  it("matches classic chunk load failures", () => {
    expect(
      isRecoverableChunkError(new Error("Loading chunk 42 failed."))
    ).toBe(true);
  });

  it("ignores unrelated runtime errors", () => {
    expect(
      isRecoverableChunkError(new Error("Cannot read properties of undefined"))
    ).toBe(false);
  });
});

describe("buildChunkRecoveryUrl", () => {
  it("adds a cache-busting query param while preserving the route", () => {
    expect(
      buildChunkRecoveryUrl(
        "https://reprodashboard.com/shoot-history?view=calendar#top",
        123456
      )
    ).toBe(
      "https://reprodashboard.com/shoot-history?view=calendar&__chunk_reload=123456#top"
    );
  });

  it("overwrites an old reload param with the latest attempt", () => {
    expect(
      buildChunkRecoveryUrl(
        "https://reprodashboard.com/dashboard?__chunk_reload=111",
        222
      )
    ).toBe("https://reprodashboard.com/dashboard?__chunk_reload=222");
  });
});

describe('automatic chunk recovery during uploads', () => {
  const safariError = () => new TypeError('Importing a module script failed.');

  it('does not navigate or consume recovery while any queued upload is active', async () => {
    const page = browser();
    const guard = await import('./uploadNavigationProtection');
    const { attemptChunkLoadRecovery } = await import('./chunkLoadRecovery');
    guard.protectUploadFromNavigation('raw-job');
    guard.protectUploadFromNavigation('edited-job');
    expect(attemptChunkLoadRecovery(safariError())).toBe(false);
    guard.releaseUploadNavigationProtection('raw-job');
    expect(attemptChunkLoadRecovery(safariError())).toBe(false);
    expect(page.replace).not.toHaveBeenCalled();
    expect(page.sessionStorage.setItem).not.toHaveBeenCalled();
    guard.releaseUploadNavigationProtection('edited-job');
    expect(page.replace).not.toHaveBeenCalled();
    expect(attemptChunkLoadRecovery(safariError())).toBe(true);
    expect(page.replace).toHaveBeenCalledOnce();
  });

  it('does not repeat recovery when a fresh app boot still cannot load its route', async () => {
    const page = browser();
    let recovery = await import('./chunkLoadRecovery');
    expect(recovery.attemptChunkLoadRecovery(safariError())).toBe(true);
    // A reload reconstructs the module while the same tab session survives.
    // Even a route change that removes the query marker must not clear the
    // durable attempt marker, as App previously did before lazy routes loaded.
    vi.resetModules();
    recovery = await import('./chunkLoadRecovery');
    expect(recovery.attemptChunkLoadRecovery(safariError())).toBe(false);
    expect(page.replace).toHaveBeenCalledOnce();
  });

  it('uses the URL marker when Safari denies session storage', async () => {
    const page = browser('https://reprodashboard.com/dashboard?__chunk_reload=123');
    page.sessionStorage.getItem.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const { attemptChunkLoadRecovery } = await import('./chunkLoadRecovery');
    expect(attemptChunkLoadRecovery(safariError())).toBe(false);
    expect(page.replace).not.toHaveBeenCalled();
  });

  it('attempts only once when storage is blocked and navigation has not completed', async () => {
    const page = browser();
    page.sessionStorage.getItem.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    page.sessionStorage.setItem.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const { attemptChunkLoadRecovery } = await import('./chunkLoadRecovery');
    expect(attemptChunkLoadRecovery(safariError())).toBe(true);
    expect(attemptChunkLoadRecovery(safariError())).toBe(false);
    expect(page.replace).toHaveBeenCalledOnce();
  });
});
