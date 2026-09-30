import { describe, expect, it } from "vitest";
import { resolveClientCancelEndpoint } from "./clientCancelRequest";

describe("resolveClientCancelEndpoint", () => {
  it("withdraws unapproved requested shoots immediately", () => {
    expect(resolveClientCancelEndpoint("requested")).toBe("withdraw-request");
  });

  it("submits a cancellation request for scheduled shoots", () => {
    expect(resolveClientCancelEndpoint("scheduled")).toBe("request-cancellation");
    expect(resolveClientCancelEndpoint("booked")).toBe("request-cancellation");
    expect(resolveClientCancelEndpoint("on_hold")).toBe("request-cancellation");
  });

  it("returns null for delivered or cancelled shoots", () => {
    expect(resolveClientCancelEndpoint("delivered")).toBeNull();
    expect(resolveClientCancelEndpoint("cancelled")).toBeNull();
    expect(resolveClientCancelEndpoint("")).toBeNull();
  });
});
