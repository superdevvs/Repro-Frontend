import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardOnboarding } from "./DashboardOnboarding";
import { dashboardOnboardingConfig } from "../config/dashboardOnboardingConfig";

afterEach(cleanup);

const makeProps = () => ({
  ...dashboardOnboardingConfig.photographer,
  welcomeOpen: false,
  tourOpen: true,
  isMobile: false,
  onStart: vi.fn(),
  onDismiss: vi.fn(),
  onComplete: vi.fn(),
  onProgress: vi.fn(),
  onReplay: vi.fn(),
});

describe("dashboard onboarding with the shared help hub", () => {
  it("opens shared Robbie help without rendering the legacy floating help control", () => {
    const onOpenHelp = vi.fn();
    render(<DashboardOnboarding {...makeProps()} onOpenHelp={onOpenHelp} />);

    fireEvent.click(screen.getByRole("button", { name: "Ask Robbie" }));
    expect(onOpenHelp).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ask Robbie about this tour")).not.toBeInTheDocument();
  });

  it("pauses keyboard navigation while the hub is open and restores the same tour step", () => {
    const props = makeProps();
    const { rerender } = render(<DashboardOnboarding {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: props.steps[1].title })).toBeVisible();
    props.onProgress.mockClear();

    rerender(<DashboardOnboarding {...props} overlayOpen />);
    expect(screen.queryByRole("heading", { name: props.steps[1].title })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onProgress).not.toHaveBeenCalled();
    expect(props.onComplete).not.toHaveBeenCalled();

    rerender(<DashboardOnboarding {...props} overlayOpen={false} />);
    expect(screen.getByRole("heading", { name: props.steps[1].title })).toBeVisible();
  });

  it("temporarily hides the welcome dialog without dismissing it", () => {
    const props = { ...makeProps(), welcomeOpen: true, tourOpen: false };
    const { rerender } = render(<DashboardOnboarding {...props} />);
    expect(screen.getByRole("button", { name: "Start tour" })).toBeVisible();

    rerender(<DashboardOnboarding {...props} overlayOpen />);
    expect(screen.queryByRole("button", { name: "Start tour" })).not.toBeInTheDocument();
    expect(props.onDismiss).not.toHaveBeenCalled();

    rerender(<DashboardOnboarding {...props} overlayOpen={false} />);
    expect(screen.getByRole("button", { name: "Start tour" })).toBeVisible();
  });

  it("preserves the existing upload-guide pause and watch shortcut at the help-hub step", () => {
    const props = makeProps();
    const finalStep = props.steps.length - 1;
    const onOpenUploadGuide = vi.fn();
    const { rerender } = render(
      <DashboardOnboarding {...props} lastStep={finalStep} onOpenUploadGuide={onOpenUploadGuide} />,
    );
    expect(props.steps[finalStep].target).toBe("photographer-help-hub");
    fireEvent.click(screen.getByRole("button", { name: "Watch upload guide" }));
    expect(onOpenUploadGuide).toHaveBeenCalledOnce();

    rerender(<DashboardOnboarding {...props} lastStep={finalStep} uploadGuideOpen />);
    expect(screen.queryByRole("button", { name: "Finish" })).not.toBeInTheDocument();
  });

  it("retains the existing standalone Robbie help for other roles", () => {
    render(<DashboardOnboarding {...makeProps()} {...dashboardOnboardingConfig.client} />);
    expect(screen.queryByRole("button", { name: "Ask Robbie" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByLabelText("Ask Robbie about this tour")).toBeVisible();
  });
});
