import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityToolsPanel } from "./AvailabilityToolsPanel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./AvailabilityDialog";

function Harness({ canEdit = true, onFilters = vi.fn() }) {
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState(false);
  const [filters, setFilters] = useState({ open: true, booked: true, blocked: true });
  return <>
    <button aria-label="Calendar tools" onClick={() => setOpen(true)}>Tools</button>
    <AvailabilityToolsPanel open={open} onOpenChange={setOpen} context="Jay · Fri, Oct 23" canEdit={canEdit}
      mapOpen={false} filters={filters} onFilters={value => { setFilters(value); onFilters(value); }}
      onAdd={() => setAdd(true)} onBlock={vi.fn()} onDefault={vi.fn()} onManage={vi.fn()} onMap={vi.fn()} onSync={vi.fn()} />
    <Dialog open={add} onOpenChange={setAdd}><DialogContent>
      <DialogTitle>Add schedule</DialogTitle><DialogDescription>Set working hours</DialogDescription>
      <input aria-label="Schedule note" />
    </DialogContent></Dialog>
  </>;
}

describe("Availability tools drawer", () => {
  it("opens the next drawer, keeps keyboard focus inside it, and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Calendar tools' }));
    expect(screen.getByRole('dialog', { name: 'Calendar tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add schedule' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Add schedule' })).toContainElement(document.activeElement as HTMLElement));
    expect(screen.queryByRole('dialog', { name: 'Calendar tools' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calendar tools' })).toHaveFocus());
  });

  it("preserves filter selections when leaving and reopening the menu", async () => {
    const user = userEvent.setup();
    const onFilters = vi.fn();
    render(<Harness onFilters={onFilters} />);
    await user.click(screen.getByRole('button', { name: 'Calendar tools' }));
    await user.click(screen.getByRole('button', { name: 'Filter availability' }));
    await user.click(screen.getByRole('switch', { name: /Available time/ }));
    expect(onFilters).toHaveBeenLastCalledWith({ open: false, booked: true, blocked: true });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Calendar tools' }));
    await user.click(screen.getByRole('button', { name: 'Filter availability' }));
    expect(screen.getByRole('switch', { name: /Available time/ })).not.toBeChecked();
  });

  it("keeps mutation tools hidden for read-only roles", async () => {
    render(<Harness canEdit={false} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Calendar tools' }));
    expect(screen.queryByRole('button', { name: /Add schedule|Block time|Default schedule|Manage schedules/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calendar sync/ })).toBeInTheDocument();
  });
});
