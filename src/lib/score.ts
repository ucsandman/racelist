import type { Candidate, ParsedLine, Resolution, ScoredCandidate } from "./types";

const LIVE = /\b(live|concert|unplugged|bbc session|acoustic session)\b/i;
const REMIX = /\b(remix|rework|re-?edit|radio edit|extended mix|club mix|instrumental)\b/i;
const FAKE =
  /\b(karaoke|tribute|made popular by|made famous by|in the style of|cover version|originally performed|lullaby|8-?bit|string quartet|piano versions?|versions? of)\b/i;
// A demo, alternate take or sped-up edit is a different recording of the same song.
// It scored identically to the real track until the measured Mr. Brightside case exposed it.
const ALTERNATE = /\b(demo|rough mix|alternate (take|version)|sped[- ]?up|slowed)\b/i;
const COMPILATION = /\b(greatest hits|the essential|very best|best of|collection|anthology|now that's what)\b/i;

/**
 * Same cleanup as normalize but parentheticals stay. normalize() folds
 * "Physical (feat. Troye Sivan)" onto "Physical", which is right for fuzzy
 * matching and wrong for deciding whether two rows are one recording: on live
 * data those two are 193s and 194s, so a duration check alone called them
 * identical and auto-picked the featuring version.
 */
export function literalTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .replace(/\bfeat\.?\b.*$/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// WIRE-DARK[Engine built bottom-up per the plan; resolveAll consumes scoring in Task 4.]
export function scoreCandidate(cand: Candidate, query: ParsedLine): ScoredCandidate {
  const penalties: string[] = [];
  let score = 0;

  const nTitle = normalize(cand.title);
  const nQueryTitle = normalize(query.title);
  const nArtist = normalize(cand.artist);
  const nQueryArtist = normalize(query.artist);

  if (nTitle === nQueryTitle) score += 40;
  else if (nTitle.startsWith(nQueryTitle) || nQueryTitle.startsWith(nTitle)) score += 20;

  // An exact literal match beats a fuzzy one decisively. Without this, a plain
  // "Physical" and "Physical (feat. Troye Sivan)" both scored 65 and the
  // featuring version won on sort order.
  if (literalTitle(cand.title) === literalTitle(query.title)) score += 15;

  if (nArtist === nQueryArtist) score += 25;
  else if (nArtist.includes(nQueryArtist) || nQueryArtist.includes(nArtist)) score += 15;

  const haystack = `${cand.title} ${cand.album}`;
  const queryWantsRemix = REMIX.test(query.title);
  const queryWantsLive = LIVE.test(query.title);

  if (FAKE.test(haystack) || FAKE.test(cand.artist)) {
    score -= 40;
    penalties.push("karaoke");
  }
  if (LIVE.test(haystack) && !queryWantsLive) {
    score -= 30;
    penalties.push("live");
  }
  if (REMIX.test(haystack) && !queryWantsRemix) {
    score -= 25;
    penalties.push("remix");
  }
  if (ALTERNATE.test(haystack) && !ALTERNATE.test(query.title)) {
    score -= 30;
    penalties.push("alternate");
  }
  if (COMPILATION.test(cand.album)) {
    score -= 10;
    penalties.push("compilation");
  }
  if (normalize(cand.album) === nQueryTitle) score += 10;

  if (queryWantsRemix && REMIX.test(cand.title)) score += 30;
  if (queryWantsLive && LIVE.test(haystack)) score += 30;

  return { ...cand, score, penalties };
}

// WIRE-DARK[Engine built bottom-up per the plan; resolveAll consumes rank in Task 4.]
export function rank(cands: Candidate[], query: ParsedLine): ScoredCandidate[] {
  return cands
    .map((c) => scoreCandidate(c, query))
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs);
}

/**
 * The same recording is routinely sold on several albums: an original, a
 * remaster, two soundtracks and a hits compilation. Those are interchangeable
 * and asking a human to choose between them buys nothing. Same normalized
 * title plus near-identical runtime means same recording.
 */
function sameRecording(a: Candidate, b: Candidate): boolean {
  if (literalTitle(a.title) !== literalTitle(b.title)) return false;
  const tolerance = Math.max(a.durationMs * 0.03, 3000);
  return Math.abs(a.durationMs - b.durationMs) <= tolerance;
}

// WIRE-DARK[Engine built bottom-up per the plan; resolveAll consumes decide in Task 4.]
export function decide(ranked: ScoredCandidate[], query: ParsedLine): Resolution {
  if (ranked.length === 0) {
    return { query, status: "missing", chosen: null, candidates: [] };
  }

  const top = ranked[0];
  const review: Resolution = { query, status: "review", chosen: null, candidates: ranked };

  // Never auto-accept a cut we already flagged, or a weak match.
  if (top.penalties.length > 0 || top.score < 55) return review;

  // A close rival is only harmless if it is the same recording on another album.
  // Anything else genuinely different, a feat. version or a distinct take, needs a human.
  const closeRivals = ranked.slice(1).filter((c) => c.score > top.score - 10);
  const interchangeable = closeRivals.every(
    (r) => r.penalties.length === 0 && sameRecording(top, r),
  );

  return interchangeable
    ? { query, status: "auto", chosen: top, candidates: ranked }
    : review;
}
