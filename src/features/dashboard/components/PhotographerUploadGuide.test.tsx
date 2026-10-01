import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { flushSync } from "react-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardOnboarding } from "./DashboardOnboarding";
import { PhotographerUploadGuide } from "./PhotographerUploadGuide";
import { dashboardOnboardingConfig } from "../config/dashboardOnboardingConfig";
import { photographerUploadGuide as guide } from "../config/photographerUploadGuide";

afterEach(cleanup);

describe("PhotographerUploadGuide", () => {
  it("provides deliberate playback, captions, and the full handoff transcript", () => {
    render(<PhotographerUploadGuide open onOpenChange={vi.fn()} />);

    const video = screen.getByLabelText(guide.title, { selector: "video" });
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("src", guide.video);
    const captions = video.querySelector("track[kind='captions']");
    expect(captions).toHaveAttribute("src", guide.captions);
    expect(captions).toHaveAttribute("srclang", "en");
    expect(captions).toHaveAttribute("default");

    fireEvent.click(screen.getByText("Read the transcript"));
    expect(screen.getByText(/choose Submit Raw Files/)).toBeVisible();
  });

  it("opens the transcript if playback fails and removes the player on close", () => {
    const { rerender } = render(<PhotographerUploadGuide open onOpenChange={vi.fn()} />);
    fireEvent.error(screen.getByLabelText(guide.title, { selector: "video" }));
    expect(screen.getByRole("status")).toHaveTextContent("video couldn’t load");
    expect(screen.getByText("Read the transcript").closest("details")).toHaveAttribute("open");

    rerender(<PhotographerUploadGuide open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByLabelText(guide.title, { selector: "video" })).not.toBeInTheDocument();
  });

  it("pauses tour keyboard navigation and resumes the same step after Escape closes the guide", async () => {
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    const config = dashboardOnboardingConfig.photographer;
    const uploadStep = config.steps.findIndex((step) => step.guide === "uploads");

    function TourWithGuide() {
      const [open, setOpen] = useState(false);
      return <>
        <DashboardOnboarding
          roleKey="photographer"
          steps={config.steps}
          copy={config.copy}
          welcomeOpen={false}
          tourOpen
          uploadGuideOpen={open}
          onOpenUploadGuide={() => setOpen(true)}
          isMobile={false}
          lastStep={uploadStep}
          onStart={vi.fn()}
          onDismiss={vi.fn()}
          onComplete={onComplete}
          onProgress={onProgress}
          onReplay={vi.fn()}
        />
        <PhotographerUploadGuide open={open} onOpenChange={setOpen} />
      </>;
    }

    render(<TourWithGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Watch upload guide" }));
    const video = screen.getByLabelText(guide.title, { selector: "video" });
    expect(screen.queryByRole("button", { name: "Finish" })).not.toBeInTheDocument();
    fireEvent.keyDown(video, { key: "ArrowLeft" });
    fireEvent.keyDown(video, { key: "ArrowRight" });
    expect(onProgress).not.toHaveBeenCalled();
    fireEvent.keyDown(video, { key: "Escape" });

    await waitFor(() => expect(screen.getByRole("heading", { name: config.steps[uploadStep].title })).toBeVisible());
    expect(onComplete).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
  });

  it("keeps Escape from reaching page shortcuts restored synchronously while the guide closes", () => {
    const pageShortcut = vi.fn();
    function GuideWithRestoredShortcut() {
      const [open, setOpen] = useState(true);
      return <PhotographerUploadGuide open={open} onOpenChange={(next) => {
        // Model the browser race: closing the dialog synchronously restores the
        // tour's window listener before this same Escape reaches bubble phase.
        if (!next) window.addEventListener("keydown", pageShortcut);
        flushSync(() => setOpen(next));
      }} />;
    }

    render(<GuideWithRestoredShortcut />);
    fireEvent.keyDown(screen.getByLabelText(guide.title, { selector: "video" }), { key: "Escape" });
    window.removeEventListener("keydown", pageShortcut);
    expect(screen.queryByLabelText(guide.title, { selector: "video" })).not.toBeInTheDocument();
    expect(pageShortcut).not.toHaveBeenCalled();
  });

  it("offers the video from the photographer welcome without exposing it to client tours", () => {
    const onOpenUploadGuide = vi.fn();
    const shared = {
      welcomeOpen: true, tourOpen: false, isMobile: false,
      onStart: vi.fn(), onDismiss: vi.fn(), onComplete: vi.fn(),
      onProgress: vi.fn(), onReplay: vi.fn(), onOpenUploadGuide,
    };
    const { rerender } = render(<DashboardOnboarding {...shared} {...dashboardOnboardingConfig.photographer} />);
    fireEvent.click(screen.getByRole("button", { name: "Watch upload guide" }));
    expect(onOpenUploadGuide).toHaveBeenCalledOnce();
    rerender(<DashboardOnboarding {...shared} {...dashboardOnboardingConfig.client} />);
    expect(screen.queryByRole("button", { name: "Watch upload guide" })).not.toBeInTheDocument();
  });

  it("returns to the welcome dialog without dismissing onboarding after watching the guide", async () => {
    const onDismiss = vi.fn();
    const config = dashboardOnboardingConfig.photographer;
    function WelcomeWithGuide() {
      const [open, setOpen] = useState(false);
      return <>
        <DashboardOnboarding
          {...config}
          welcomeOpen
          tourOpen={false}
          isMobile={false}
          uploadGuideOpen={open}
          onOpenUploadGuide={() => setOpen(true)}
          onStart={vi.fn()}
          onDismiss={onDismiss}
          onComplete={vi.fn()}
          onProgress={vi.fn()}
          onReplay={vi.fn()}
        />
        <PhotographerUploadGuide open={open} onOpenChange={setOpen} />
      </>;
    }
    render(<WelcomeWithGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Watch upload guide" }));
    expect(screen.queryByRole("button", { name: "Start tour" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText(guide.title, { selector: "video" }), { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Start tour" })).toBeVisible());
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
