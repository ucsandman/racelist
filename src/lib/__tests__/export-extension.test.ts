import { describe, it, expect, afterEach } from "vitest";
import { extensionExporter } from "../export/extension";
import type { Program, Track } from "../types";

const track = (id: number): Track => ({
  trackId: id,
  title: `T${id}`,
  artist: "A",
  album: "Al",
  durationMs: 200000,
  artworkUrl: "",
  url: "",
  bpm: 170,
  bpmSource: "deezer",
  gain: -10,
});

const program: Program = {
  slots: [{ track: track(1), phase: "cruise", targetCadence: 175, reason: "r" }],
  unplaced: [],
  totalMs: 200000,
  goalMs: 180000,
  cadence: 175,
};

function replyWith(payload: Record<string, unknown>) {
  const handler = (e: MessageEvent) => {
    if ((e.data as { source?: string })?.source !== "racelist") return;
    window.postMessage({ source: "racelist-ext", ...payload }, "*");
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe("extensionExporter", () => {
  it("reports unavailable when nothing answers the ping", async () => {
    expect(await extensionExporter.isAvailable(50)).toBe(false);
  });

  it("reports available when the extension pongs", async () => {
    cleanup = replyWith({ type: "pong" });
    expect(await extensionExporter.isAvailable(200)).toBe(true);
  });

  it("returns the playlist url on success", async () => {
    cleanup = replyWith({
      type: "created",
      playlistUrl: "https://music.apple.com/library/playlist/p.123",
    });
    const r = await extensionExporter.export(program, "Half Marathon", 200);
    expect(r.ok).toBe(true);
    expect(r.playlistUrl).toContain("p.123");
  });

  it("surfaces an error message without throwing", async () => {
    cleanup = replyWith({ type: "error", message: "Sign in to Apple Music first" });
    const r = await extensionExporter.export(program, "Half Marathon", 200);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sign in/i);
  });

  it("fails cleanly on timeout rather than hanging", async () => {
    const r = await extensionExporter.export(program, "Half Marathon", 50);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not responding|extension/i);
  });
});
