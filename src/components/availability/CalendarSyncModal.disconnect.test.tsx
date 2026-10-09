import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { CalendarSyncModal } from "./CalendarSyncModal";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  availabilitySlots: [] as [],
  onGoogleCalendarConnect: vi.fn(),
};

describe("CalendarSyncModal Google disconnect", () => {
  it("can reconnect an existing account in the opt-in verification flow without disconnecting", async () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    render(<CalendarSyncModal {...baseProps} allowGoogleCalendarReconnect onGoogleCalendarConnect={onConnect}
      onGoogleCalendarDisconnect={onDisconnect} googleCalendarStatus={{available:true, connected:true, sync_enabled:true, provider_email:"demo@example.com"}} />);
    await userEvent.setup().click(screen.getByRole("button", {name:/google calendar.*reconnect with google/i}));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onDisconnect).not.toHaveBeenCalled();
  });
  it("shows a permission error and lets the user reconnect when OAuth is configured", async () => {
    const onConnect = vi.fn();
    render(
      <CalendarSyncModal
        {...baseProps}
        onGoogleCalendarConnect={onConnect}
        googleCalendarStatus={{
          available: true,
          connected: false,
          sync_enabled: false,
          last_error: "Calendar permission was not granted. Please reconnect.",
        }}
      />,
    );
    expect(screen.getByText("Calendar permission was not granted. Please reconnect.")).toBeInTheDocument();
    const connectButton = screen.getByRole("button", { name: /google calendar.*connect with google/i });
    expect(connectButton).toBeEnabled();
    await userEvent.setup().click(connectButton);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("shows Disconnect when connected and a disconnect handler is provided", () => {
    render(
      <CalendarSyncModal
        {...baseProps}
        onGoogleCalendarDisconnect={vi.fn()}
        googleCalendarStatus={{
          available: true,
          connected: true,
          provider_email: "calendar-owner@example.com",
          sync_enabled: true,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /disconnect google calendar/i })).toBeInTheDocument();
    expect(screen.getByText("calendar-owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("hides Disconnect when not connected", () => {
    render(
      <CalendarSyncModal
        {...baseProps}
        onGoogleCalendarDisconnect={vi.fn()}
        googleCalendarStatus={{
          available: true,
          connected: false,
          sync_enabled: false,
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: /disconnect google calendar/i })).not.toBeInTheDocument();
    expect(screen.getByText("Connect with Google")).toBeInTheDocument();
  });

  it("hides Disconnect when connected but no disconnect handler (admin view)", () => {
    render(
      <CalendarSyncModal
        {...baseProps}
        googleCalendarStatus={{
          available: true,
          connected: true,
          provider_email: "calendar-owner@example.com",
          sync_enabled: true,
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: /disconnect google calendar/i })).not.toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("asks for confirmation before calling disconnect", async () => {
    const user = userEvent.setup();
    const onDisconnect = vi.fn().mockResolvedValue(undefined);

    render(
      <CalendarSyncModal
        {...baseProps}
        onGoogleCalendarDisconnect={onDisconnect}
        googleCalendarStatus={{
          available: true,
          connected: true,
          provider_email: "calendar-owner@example.com",
          sync_enabled: true,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /disconnect google calendar/i }));
    expect(screen.getByRole("heading", { name: /disconnect google calendar\?/i })).toBeInTheDocument();
    expect(onDisconnect).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^disconnect$/i }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });
});
