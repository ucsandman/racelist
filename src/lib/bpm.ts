import type { BpmSource, Candidate } from "./types";

export type DeezerTrack = {
  id: number;
  title: string;
  bpm: number;
  gain: number | null;
  duration: number; // seconds
  album: { title: string };
};

const LIVE = /\b(live|concert|unplugged|cast album|bbc session)\b/i;
const REMIX = /\b(remix|rework|re-?edit|radio edit|extended mix|club mix|instrumental)\b/i;

function durationOk(dzSeconds: number, targetMs: number): boolean {
  const diffMs = Math.abs(dzSeconds * 1000 - targetMs);
  const tolerance = Math.max(targetMs * 0.05, 8000);
  return diffMs <= tolerance;
}

/**
 * Deezer returns bpm 0 for plenty of tracks. Scanning further candidates
 * recovers a value, but on measured data those came off the wrong recording:
 * Mr. Brightside's 144.56 from a Royal Albert Hall live album, Don't Stop Me
 * Now's 93.8 from a We Will Rock You cast recording. A candidate is only
 * trusted when its runtime matches and its album is not a live or remix cut.
 */
// WIRE-DARK[Engine built bottom-up per the plan; the /api/bpm route consumes this in the same task.]
export function pickBpmCandidate(cands: DeezerTrack[], target: Candidate): DeezerTrack | null {
  const usable = cands
    .filter((d) => d.bpm > 0)
    .filter((d) => durationOk(d.duration, target.durationMs))
    .filter((d) => {
      const hay = `${d.title} ${d.album.title}`;
      const targetIsLive = LIVE.test(`${target.title} ${target.album}`);
      const targetIsRemix = REMIX.test(target.title);
      if (LIVE.test(hay) && !targetIsLive) return false;
      if (REMIX.test(hay) && !targetIsRemix) return false;
      return true;
    })
    .sort(
      (a, b) =>
        Math.abs(a.duration * 1000 - target.durationMs) -
        Math.abs(b.duration * 1000 - target.durationMs),
    );

  return usable[0] ?? null;
}

// WIRE-DARK[Engine built bottom-up per the plan; the /api/bpm route consumes this in the same task.]
export async function lookupBpm(
  target: Candidate,
  fetchImpl: typeof fetch = fetch,
): Promise<{ bpm: number | null; source: BpmSource | null; gain: number | null }> {
  const query = `artist:"${target.artist}" track:"${target.title}"`;
  try {
    const searchRes = await fetchImpl(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`,
    );
    if (!searchRes.ok) return { bpm: null, source: null, gain: null };
    const search = (await searchRes.json()) as { data?: { id: number }[] };

    const full: DeezerTrack[] = [];
    for (const hit of (search.data ?? []).slice(0, 8)) {
      const r = await fetchImpl(`https://api.deezer.com/track/${hit.id}`);
      if (!r.ok) continue;
      full.push((await r.json()) as DeezerTrack);
    }

    const picked = pickBpmCandidate(full, target);
    if (!picked) return { bpm: null, source: null, gain: null };
    return { bpm: picked.bpm, source: "deezer", gain: picked.gain };
  } catch {
    return { bpm: null, source: null, gain: null };
  }
}
