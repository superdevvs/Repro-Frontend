import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityPhotographerSelect } from "./AvailabilityPhotographerSelect";

const photographers = [
  { id: "3", name: "Jaz Singh" },
  { id: "8", name: "Alex Rivera" },
];

describe("AvailabilityPhotographerSelect", () => {
  it("hides the team picker from photographers", () => {
    const { container } = render(
      <AvailabilityPhotographerSelect
        canManagePhotographerSelection={false}
        photographers={photographers}
        selectedPhotographer="8"
        onSelect={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("All Photographers")).not.toBeInTheDocument();
    expect(screen.queryByText("Jaz Singh")).not.toBeInTheDocument();
  });

  it("lets admins switch between the whole team", () => {
    render(
      <AvailabilityPhotographerSelect
        canManagePhotographerSelection
        photographers={photographers}
        selectedPhotographer="all"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("All Photographers")).toBeTruthy();
  });
});
