import type { Candidate, ParsedLine, Resolution } from "./types";
import { rank, decide } from "./score";

const ENDPOINT = "https://itunes.apple.com/search";

type ItunesResult = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

// WIRE-DARK[Engine built bottom-up per the plan; PasteBox consumes resolveAll in Task 9.]
export async function searchItunes(
  query: ParsedLine,
  fetchImpl: typeof fetch = fetch,
): Promise<Candidate[]> {
  const url = `${ENDPOINT}?term=${encodeURIComponent(
    `${query.artist} ${query.title}`,
  )}&entity=song&limit=5&country=US`;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: ItunesResult[] };
    return (body.results ?? []).map((r) => ({
      trackId: r.trackId,
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName ?? "",
      durationMs: r.trackTimeMillis ?? 0,
      artworkUrl: (r.artworkUrl100 ?? "").replace("100x100", "300x300"),
      url: r.trackViewUrl ?? "",
    }));
  } catch {
    return [];
  }
}

// WIRE-DARK[Engine built bottom-up per the plan; PasteBox consumes resolveAll in Task 9.]
export async function resolveAll(
  lines: ParsedLine[],
  opts: {
    onProgress?: (done: number, total: number) => void;
    delayMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<Resolution[]> {
  // iTunes Search allows roughly 20 requests per minute. 1.1s spacing stays under it.
  const { onProgress, delayMs = 1100, fetchImpl = fetch } = opts;
  const out: Resolution[] = [];

  for (const [i, line] of lines.entries()) {
    const cands = await searchItunes(line, fetchImpl);
    out.push(decide(rank(cands, line), line));
    onProgress?.(i + 1, lines.length);
    if (delayMs > 0 && i < lines.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return out;
}
