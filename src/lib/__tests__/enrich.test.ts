import { describe, it, expect, vi } from "vitest";
import { enrichWithBpm } from "../enrich";
import type { Candidate } from "../types";

const c: Candidate = {
  trackId: 1,
  title: "Eye of the Tiger",
  artist: "Survivor",
  album: "Eye of the Tiger",
  durationMs: 243773,
  artworkUrl: "",
  url: "",
};

describe("enrichWithBpm", () => {
  it("attaches bpm and gain from the proxy", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bpm: 108.8, source: "deezer", gain: -12.7 }),
    } as Response);
    const [t] = await enrichWithBpm([c], f as unknown as typeof fetch);
    expect(t).toMatchObject({ bpm: 108.8, bpmSource: "deezer", gain: -12.7 });
  });

  it("keeps the track with a null bpm when the proxy fails", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const [t] = await enrichWithBpm([c], f as unknown as typeof fetch);
    expect(t.bpm).toBeNull();
    expect(t.trackId).toBe(1);
  });

  it("keeps the track when the network throws", async () => {
    const f = vi.fn().mockRejectedValue(new Error("offline"));
    const [t] = await enrichWithBpm([c], f as unknown as typeof fetch);
    expect(t.bpm).toBeNull();
  });
});
