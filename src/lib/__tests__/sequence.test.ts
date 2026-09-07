import { describe, it, expect } from "vitest";
import { buildProgram } from "../sequence";
import type { Track } from "../types";

const t = (id: number, bpm: number | null, gain = -10): Track => ({
  trackId: id,
  title: `T${id}`,
  artist: "A",
  album: "Al",
  durationMs: 210000,
  artworkUrl: "",
  url: "",
  bpm,
  bpmSource: bpm === null ? null : "deezer",
  gain,
});

const GOAL = 2 * 60 * 60 * 1000; // a 2 hour half marathon

describe("buildProgram", () => {
  // 45 tracks at 210s is 9450s, comfortably past the 7776s the 1.08 buffer needs.
  const many = [
    ...Array.from({ length: 15 }, (_, i) => t(100 + i, 165)),
    ...Array.from({ length: 15 }, (_, i) => t(200 + i, 175)),
    ...Array.from({ length: 15 }, (_, i) => t(300 + i, 180)),
  ];

  it("covers at least the goal time plus buffer", () => {
    const p = buildProgram(many, GOAL, 175);
    expect(p.totalMs).toBeGreaterThanOrEqual(GOAL * 1.08);
  });

  it("uses everything it has when the pool cannot cover the goal", () => {
    const few = Array.from({ length: 5 }, (_, i) => t(400 + i, 175));
    const p = buildProgram(few, GOAL, 175);
    expect(p.slots).toHaveLength(5);
    expect(p.totalMs).toBeLessThan(GOAL);
    expect(p.unplaced).toEqual([]);
  });

  it("emits phases in race order", () => {
    const phases = buildProgram(many, GOAL, 175).slots.map((s) => s.phase);
    const order = ["warmup", "cruise", "lift", "kick"];
    const seen = [...new Set(phases)];
    expect(seen).toEqual(order.filter((o) => seen.includes(o as never)));
  });

  it("raises the target cadence across phases and never lowers it", () => {
    const slots = buildProgram(many, GOAL, 175).slots;
    const targets = slots.map((s) => s.targetCadence);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i]).toBeGreaterThanOrEqual(targets[i - 1]);
    }
  });

  it("keeps bpm-less tracks as unplaced rather than dropping them", () => {
    const p = buildProgram([...many, t(999, null)], GOAL, 175);
    expect(p.unplaced.map((u) => u.trackId)).toContain(999);
    expect(p.slots.some((s) => s.track.trackId === 999)).toBe(false);
  });

  it("gives every slot a human-readable reason", () => {
    for (const s of buildProgram(many, GOAL, 175).slots) {
      expect(s.reason.length).toBeGreaterThan(0);
    }
  });

  it("uses every available track before repeating any", () => {
    const p = buildProgram(many, GOAL, 175);
    const ids = p.slots.map((s) => s.track.trackId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns an empty program with no unplaced tracks for no input", () => {
    const p = buildProgram([], GOAL, 175);
    expect(p.slots).toEqual([]);
    expect(p.unplaced).toEqual([]);
    expect(p.totalMs).toBe(0);
  });
});
