import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { flushSync } from "react-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotographerCubiCasaGuide } from "./PhotographerCubiCasaGuide";
import { photographerCubiCasaGuide as guide } from "../config/photographerCubiCasaGuide";

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PhotographerCubiCasaGuide", () => {
  it("starts with the credited official lesson, without autoplay or a hidden second player", () => {
    render(<PhotographerCubiCasaGuide open onOpenChange={vi.fn()} />);
    const iframe = screen.getByTitle(guide.officialTitle);
    expect(iframe).toHaveAttribute("src", guide.officialEmbed);
    expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(new URL(iframe.getAttribute("src")!).searchParams.get("autoplay")).toBe("0");
    expect(screen.getByRole("link", { name: "Watch on YouTube" })).toHaveAttribute("href", guide.officialUrl);
    expect(document.querySelector("video")).not.toBeInTheDocument();
  });

  it("unmounts the official player when continuing and provides reviewed video and captions", async () => {
    render(<PhotographerCubiCasaGuide open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Continue to your REPro order" }));
    expect(screen.queryByTitle(guide.officialTitle)).not.toBeInTheDocument();
    const video = screen.getByLabelText<HTMLVideoElement>("Your REPro draft order walkthrough");
    expect(video).toHaveAttribute("src", guide.video);
    expect(video).toHaveAttribute("poster", guide.poster);
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video.querySelector("track[kind='captions']")).toHaveAttribute("src", guide.captions);
    expect(video.querySelector("track")).toHaveAttribute("default");
  });

  it("pauses and removes the walkthrough when switching back to the official lesson", async () => {
    render(<PhotographerCubiCasaGuide open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("tab", { name: "2. Your REPro order" }));
    const video = screen.getByLabelText<HTMLVideoElement>("Your REPro draft order walkthrough");
    await userEvent.click(screen.getByRole("tab", { name: "1. How to scan" }));
    expect(video.pause).toHaveBeenCalledOnce();
    expect(video).not.toBeInTheDocument();
    expect(screen.getByTitle(guide.officialTitle)).toBeInTheDocument();
  });

  it("pauses and removes the walkthrough on close and resets the chapter on reopening", async () => {
    const { rerender } = render(<PhotographerCubiCasaGuide open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Continue to your REPro order" }));
    const video = screen.getByLabelText<HTMLVideoElement>("Your REPro draft order walkthrough");
    rerender(<PhotographerCubiCasaGuide open={false} onOpenChange={vi.fn()} />);
    expect(video.pause).toHaveBeenCalledOnce();
    expect(document.querySelector("video, iframe")).not.toBeInTheDocument();
    rerender(<PhotographerCubiCasaGuide open onOpenChange={vi.fn()} />);
    expect(screen.getByTitle(guide.officialTitle)).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
  });

  it("opens the full REPro transcript when the local video fails and returns to help on request", async () => {
    const onOpenChange = vi.fn();
    render(<PhotographerCubiCasaGuide open onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Continue to your REPro order" }));
    fireEvent.error(screen.getByLabelText("Your REPro draft order walkthrough"));
    expect(screen.getByRole("status")).toHaveTextContent("walkthrough couldn’t load");
    expect(screen.getByText("Read the REPro walkthrough transcript").closest("details")).toHaveAttribute("open");
    expect(screen.getByText(guide.transcript[1].text)).toBeVisible();
    expect(screen.getByText(guide.transcript[6].text)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Back to help" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stops the same Escape from reaching a tour shortcut restored while closing", () => {
    const pageShortcut = vi.fn();
    function GuideWithRestoredShortcut() {
      const [open, setOpen] = useState(true);
      return <PhotographerCubiCasaGuide open={open} onOpenChange={(next) => {
        if (!next) window.addEventListener("keydown", pageShortcut);
        flushSync(() => setOpen(next));
      }} />;
    }
    render(<GuideWithRestoredShortcut />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "1. How to scan" }), { key: "Escape" });
    window.removeEventListener("keydown", pageShortcut);
    expect(document.querySelector("video, iframe")).not.toBeInTheDocument();
    expect(pageShortcut).not.toHaveBeenCalled();
  });
});
