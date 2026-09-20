import { describe, expect, it } from "vitest";
import type { Photographer } from "@/types/availability";
import {
  resolveSelectedPhotographer,
  scopePhotographersForViewer,
} from "./photographerScope";

const team: Photographer[] = [
  { id: "3", name: "Jaz Singh" },
  { id: "8", name: "Alex Rivera" },
  { id: "12", name: "Sam Patel" },
];

describe("scopePhotographersForViewer", () => {
  it("keeps the full team for admins and reps", () => {
    expect(scopePhotographersForViewer(team, { isPhotographer: false, userId: 1 })).toEqual(team);
  });

  it("limits a photographer to their own row", () => {
    expect(scopePhotographersForViewer(team, { isPhotographer: true, userId: 8 })).toEqual([
      { id: "8", name: "Alex Rivera" },
    ]);
  });

  it("synthesizes a self row when the public list omitted the logged-in photographer", () => {
    expect(
      scopePhotographersForViewer([], { isPhotographer: true, userId: 8, name: "Alex Rivera" }),
    ).toEqual([{ id: "8", name: "Alex Rivera" }]);
  });
});

describe("resolveSelectedPhotographer", () => {
  it("leaves admin team selection alone", () => {
    expect(resolveSelectedPhotographer("all", { isPhotographer: false, userId: 1 })).toBe("all");
    expect(resolveSelectedPhotographer("12", { isPhotographer: false, userId: 1 })).toBe("12");
  });

  it("pins a photographer to their own id even if the UI asked for all or a teammate", () => {
    expect(resolveSelectedPhotographer("all", { isPhotographer: true, userId: 8 })).toBe("8");
    expect(resolveSelectedPhotographer("12", { isPhotographer: true, userId: 8 })).toBe("8");
    expect(resolveSelectedPhotographer("8", { isPhotographer: true, userId: 8 })).toBe("8");
  });
});
