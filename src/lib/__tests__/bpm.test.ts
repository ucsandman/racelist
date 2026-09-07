import { describe, it, expect } from "vitest";
import { pickBpmCandidate, type DeezerTrack } from "../bpm";
import type { Candidate } from "../types";

const target: Candidate = {
  trackId: 1,
  title: "Born to Run",
  artist: "Bruce Springsteen",
  album: "Born to Run",
  durationMs: 270000,
  artworkUrl: "",
  url: "",
};

const dz = (over: Partial<DeezerTrack>): DeezerTrack => ({
  id: 1,
  title: "Born to Run",
  bpm: 0,
  gain: -10,
  duration: 270,
  album: { title: "Born to Run" },
  ...over,
});

describe("pickBpmCandidate", () => {
  it("rejects a zero bpm", () => {
    expect(pickBpmCandidate([dz({ bpm: 0 })], target)).toBeNull();
  });

  it("accepts a bpm from a matching-duration studio cut (measured case)", () => {
    const picked = pickBpmCandidate([dz({ id: 9, bpm: 148.7, duration: 270 })], target);
    expect(picked?.bpm).toBe(148.7);
  });

  it("rejects the live cut whose duration is far off (measured trap)", () => {
    const picked = pickBpmCandidate(
      [
        dz({
          id: 5,
          bpm: 104.4,
          duration: 600,
          album: { title: "Chimes of Freedom (Live) - EP" },
        }),
      ],
      target,
    );
    expect(picked).toBeNull();
  });

  it("rejects a cast recording by album even when the duration is close (measured trap)", () => {
    const dontStop: Candidate = {
      ...target,
      title: "Don't Stop Me Now",
      album: "Jazz",
      durationMs: 209000,
    };
    const picked = pickBpmCandidate(
      [
        dz({
          id: 7,
          bpm: 93.8,
          duration: 210,
          title: "Don't Stop Me Now",
          album: { title: "We Will Rock You: Cast Album (Live)" },
        }),
      ],
      dontStop,
    );
    expect(picked).toBeNull();
  });

  it("prefers the closest duration when several qualify", () => {
    const picked = pickBpmCandidate(
      [dz({ id: 1, bpm: 140, duration: 262 }), dz({ id: 2, bpm: 148.7, duration: 270 })],
      target,
    );
    expect(picked?.id).toBe(2);
  });

  it("allows an 8 second absolute tolerance on short tracks", () => {
    const short: Candidate = { ...target, durationMs: 100000 };
    const picked = pickBpmCandidate([dz({ id: 3, bpm: 160, duration: 107 })], short);
    expect(picked?.bpm).toBe(160);
  });
});
