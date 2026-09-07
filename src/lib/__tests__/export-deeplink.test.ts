import { describe, it, expect } from "vitest";
import { deeplinkExporter } from "../export/deeplink";
import type { Program, Track } from "../types";

const track = (id: number, url: string): Track => ({
  trackId: id,
  title: `T${id}`,
  artist: "A",
  album: "Al",
  durationMs: 200000,
  artworkUrl: "",
  url,
  bpm: 170,
  bpmSource: "deezer",
  gain: -10,
});

const program: Program = {
  slots: [
    {
      track: track(1, "https://music.apple.com/us/album/a/1"),
      phase: "warmup",
      targetCadence: 165,
      reason: "r",
    },
    {
      track: track(2, "https://music.apple.com/us/album/b/2"),
      phase: "cruise",
      targetCadence: 175,
      reason: "r",
    },
  ],
  unplaced: [],
  totalMs: 400000,
  goalMs: 360000,
  cadence: 175,
};

describe("deeplinkExporter", () => {
  it("is always available", async () => {
    expect(await deeplinkExporter.isAvailable()).toBe(true);
  });

  it("returns one deep link per slot in program order", async () => {
    const r = await deeplinkExporter.export(program, "Half Marathon");
    expect(r.ok).toBe(true);
    expect(r.deepLinks).toEqual([
      "https://music.apple.com/us/album/a/1",
      "https://music.apple.com/us/album/b/2",
    ]);
  });

  it("succeeds with an empty list for an empty program", async () => {
    const empty: Program = { ...program, slots: [] };
    const r = await deeplinkExporter.export(empty, "x");
    expect(r.ok).toBe(true);
    expect(r.deepLinks).toEqual([]);
  });
});
