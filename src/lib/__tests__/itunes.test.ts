import { describe, it, expect, vi } from "vitest";
import { searchItunes, resolveAll } from "../itunes";
import type { ParsedLine } from "../types";

const RAW = {
  resultCount: 2,
  results: [
    {
      trackId: 111,
      trackName: "Guerrilla Radio (Live In Mexico City, MX, 10/28/99)",
      artistName: "Rage Against the Machine",
      collectionName: "Live At The Grand Olympic Auditorium",
      trackTimeMillis: 210000,
      artworkUrl100: "http://art/1.jpg",
      trackViewUrl: "https://music.apple.com/us/album/x/1",
    },
    {
      trackId: 222,
      trackName: "Guerrilla Radio",
      artistName: "Rage Against the Machine",
      collectionName: "The Battle Of Los Angeles",
      trackTimeMillis: 206000,
      artworkUrl100: "http://art/2.jpg",
      trackViewUrl: "https://music.apple.com/us/album/x/2",
    },
  ],
};

const fakeFetch = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => body } as Response);

const q: ParsedLine = { raw: "", artist: "Rage Against the Machine", title: "Guerrilla Radio" };

describe("searchItunes", () => {
  it("maps the iTunes payload into candidates", async () => {
    const out = await searchItunes(q, fakeFetch(RAW) as unknown as typeof fetch);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({
      trackId: 222,
      album: "The Battle Of Los Angeles",
      durationMs: 206000,
    });
  });

  it("returns an empty array on a non-ok response", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response);
    expect(await searchItunes(q, f as unknown as typeof fetch)).toEqual([]);
  });

  it("returns an empty array when the network throws", async () => {
    const f = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await searchItunes(q, f as unknown as typeof fetch)).toEqual([]);
  });
});

describe("resolveAll", () => {
  it("resolves every line and reports progress", async () => {
    const onProgress = vi.fn();
    const out = await resolveAll([q, q], {
      delayMs: 0,
      fetchImpl: fakeFetch(RAW) as unknown as typeof fetch,
      onProgress,
    });
    expect(out).toHaveLength(2);
    expect(out[0].candidates[0].trackId).toBe(222);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });

  it("marks a line missing when nothing comes back", async () => {
    const out = await resolveAll([q], {
      delayMs: 0,
      fetchImpl: fakeFetch({ resultCount: 0, results: [] }) as unknown as typeof fetch,
    });
    expect(out[0].status).toBe("missing");
  });
});
