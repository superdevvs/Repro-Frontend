import React, { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AvailabilityPanelContent } from "./AvailabilityPanelContent";
import { AvailabilityToolsMenu } from "./AvailabilityToolsMenu";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => true }));
afterEach(cleanup);

function Harness() {
  const [adding, setAdding] = useState(false);
  return <>
    <AvailabilityToolsMenu canManagePhotographerSelection canEditAvailability onTeam={vi.fn()} onDetails={vi.fn()} onAddSchedule={() => setAdding(true)} onDefaultSchedule={vi.fn()} onSync={vi.fn()} />
    <Dialog open={adding} onOpenChange={setAdding}>
      <AvailabilityPanelContent><DialogTitle>Add availability</DialogTitle><DialogDescription>Select a person and dates.</DialogDescription><button onClick={() => setAdding(false)}>Cancel</button></AvailabilityPanelContent>
    </Dialog>
  </>;
}

it("hands focus from the mobile tools sheet to the destination and leaves the page usable after closing", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Availability menu" }));
  expect(screen.getByRole("dialog", { name: "Calendar tools" })).toHaveAttribute("data-availability-panel", "true");
  await user.click(screen.getByRole("button", { name: "Add schedule" }));
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Add availability" })).toBeVisible());
  expect(screen.queryByRole("dialog", { name: "Calendar tools" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
  await user.click(screen.getByRole("button", { name: "Availability menu" }));
  expect(screen.getByRole("dialog", { name: "Calendar tools" })).toBeVisible();
});

it("dismisses with Escape and returns focus to the toolbar trigger", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Availability menu" });
  await user.click(trigger);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});
