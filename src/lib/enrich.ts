import type { BpmSource, Candidate, Track } from "./types";

/**
 * Calls the server-side BPM proxy, which exists because Deezer is CORS-blocked
 * in browsers. A failure never removes a track: it comes back with a null bpm
 * and the sequencer reports it as unplaced.
 */
// WIRE-DARK[Engine built bottom-up per the plan; page.tsx consumes enrichWithBpm later in this task.]
export async function enrichWithBpm(
  chosen: Candidate[],
  fetchImpl: typeof fetch = fetch,
): Promise<Track[]> {
  return Promise.all(
    chosen.map(async (c): Promise<Track> => {
      const params = new URLSearchParams({
        artist: c.artist,
        title: c.title,
        album: c.album,
        durationMs: String(c.durationMs),
      });
      try {
        const res = await fetchImpl(`/api/bpm?${params}`);
        if (!res.ok) return { ...c, bpm: null, bpmSource: null, gain: null };
        const body = (await res.json()) as {
          bpm: number | null;
          source: BpmSource | null;
          gain: number | null;
        };
        return { ...c, bpm: body.bpm, bpmSource: body.source, gain: body.gain };
      } catch {
        return { ...c, bpm: null, bpmSource: null, gain: null };
      }
    }),
  );
}
