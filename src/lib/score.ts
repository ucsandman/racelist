import type { Candidate, ParsedLine, Resolution, ScoredCandidate } from "./types";

const LIVE = /\b(live|concert|unplugged|bbc session|acoustic session)\b/i;
const REMIX = /\b(remix|rework|re-?edit|radio edit|extended mix|club mix|instrumental)\b/i;
const FAKE = /\b(karaoke|tribute|made popular by|in the style of|cover version|originally performed)\b/i;
const COMPILATION = /\b(greatest hits|the essential|very best|best of|collection|anthology|now that's what)\b/i;

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

// WIRE-DARK[Engine built bottom-up per the plan; resolveAll consumes decide in Task 4.]
export function decide(ranked: ScoredCandidate[], query: ParsedLine): Resolution {
  if (ranked.length === 0) {
    return { query, status: "missing", chosen: null, candidates: [] };
  }
  const top = ranked[0];
  const margin = ranked.length > 1 ? top.score - ranked[1].score : Infinity;
  const auto = top.score >= 55 && margin >= 15;
  return {
    query,
    status: auto ? "auto" : "review",
    chosen: auto ? top : null,
    candidates: ranked,
  };
}
