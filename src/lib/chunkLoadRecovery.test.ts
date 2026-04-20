import { describe, expect, it } from "vitest";
import {
  buildChunkRecoveryUrl,
  isRecoverableChunkError,
} from "./chunkLoadRecovery";

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
