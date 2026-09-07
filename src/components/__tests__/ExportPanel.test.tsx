import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ExportPanel } from "../ExportPanel";
import type { Program, Track } from "../../lib/types";

const track: Track = {
  trackId: 1,
  title: "T",
  artist: "A",
  album: "Al",
  durationMs: 200000,
  artworkUrl: "",
  url: "https://music.apple.com/us/album/a/1",
  bpm: 170,
  bpmSource: "deezer",
  gain: -10,
};

const program: Program = {
  slots: [{ track, phase: "cruise", targetCadence: 175, reason: "r" }],
  unplaced: [],
  totalMs: 200000,
  goalMs: 180000,
  cadence: 175,
};

describe("ExportPanel", () => {
  it("always offers the deep link fallback", async () => {
    render(<ExportPanel program={program} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /open each track/i })).toBeDefined(),
    );
  });

  it("explains how to get the one-click option when no extension answers", async () => {
    render(<ExportPanel program={program} />);
    await waitFor(() => expect(screen.getByText(/extension/i)).toBeDefined());
  });
});
