# Race Playlist Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a song list pasted from any AI into a tempo-sequenced Apple Music playlist fitted to a goal race time, with no Apple Developer account.

**Architecture:** Resolution runs client-side against the keyless iTunes Search API (verified working cross-origin, so each user spends their own rate limit). BPM proxies through one Next.js route handler because Deezer is CORS-blocked (verified), and caches permanently at the CDN since BPM is a property of a track, not a user — no database. The sequencer is a pure function. Export sits behind a one-method interface with a deep-link fallback that always works and a browser extension that reads the Apple Music web player's own MusicKit instance.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19, TypeScript 5, Tailwind 4, Vitest 4, `@vercel/analytics` 2. Node 24.15.0, npm 10.9.0. Deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-09-07-race-playlist-builder-design.md`

## Global Constraints

- **Tokens never leave the browser.** No server route may read, store, proxy, log or forward an Apple developer token or music user token. The BPM proxy touches Deezer only.
- **Never silently drop a track.** A track that fails BPM lookup or cadence matching appears in the output as unplaced, visibly.
- **Never silently auto-pick an ambiguous match.** Auto-accept requires score >= 55 and a margin >= 15 over second place; everything else goes to human review.
- iTunes Search is called client-side only, queued at 1.1s spacing.
- Deezer is called server-side only (CORS-blocked in browsers).
- SEO floor ships with the public surface in the same change: `sitemap.ts`, `robots.ts`, `public/llms.txt`, per-page title and meta description, canonical, OG image.
- No database, no auth, no stored user data.
- Outward-facing copy: no em dashes, no hype.

---

### Task 1: Scaffold, SEO floor, and a rendering home page

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Note:** `vitest.config.ts` is not needed yet. Vitest runs these node-environment tests on its defaults; Task 9 adds the config when jsdom and React rendering arrive.
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `public/llms.txt`
- Test: `src/app/__tests__/seo.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a Next.js app that builds; `SITE_URL` exported from `src/lib/site.ts`

- [ ] **Step 1: Create the project and install pinned dependencies**

```bash
cd C:/Projects/apple-music
npm init -y
npm install next@16.3.4 react@19 react-dom@19 @vercel/analytics@2
npm install -D typescript@5 @types/react@19 @types/node@24 tailwindcss@4 @tailwindcss/postcss@4 vitest@4 jsdom@25
```

- [ ] **Step 2: Write `src/lib/site.ts`, the Tailwind wiring, and base styles**

```ts
// src/lib/site.ts
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://racelist.vercel.app";
export const SITE_NAME = "Racelist";
export const SITE_TAGLINE = "Turn an AI song list into a race-paced Apple Music playlist";
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

```css
/* src/app/globals.css */
@import "tailwindcss";

:root {
  color-scheme: light dark;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.5;
}

main {
  max-width: 46rem;
  margin: 0 auto;
  padding: 2rem 1rem 6rem;
}
```

- [ ] **Step 3: Write the failing SEO test**

```ts
// src/app/__tests__/seo.test.ts
import { describe, it, expect } from "vitest";
import sitemap from "../sitemap";
import robots from "../robots";
import { SITE_URL } from "../../lib/site";

describe("seo floor", () => {
  it("sitemap lists the home page with an absolute url", () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].url).toBe(SITE_URL);
  });

  it("robots allows crawling and points at the sitemap", () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/app/__tests__/seo.test.ts`
Expected: FAIL, cannot resolve `../sitemap`

- [ ] **Step 5: Write `src/app/sitemap.ts` and `src/app/robots.ts`**

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
```

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 6: Write `public/llms.txt`**

```text
# Racelist

Turns a song list from any AI into a tempo-sequenced Apple Music playlist
fitted to a goal race time.

## What it does
- Resolves freeform song text to exact Apple Music catalog tracks
- Asks you to confirm anything ambiguous rather than guessing
- Looks up BPM and sequences the playlist to your cadence and goal finish time
- Exports to Apple Music, or to a tap-through list of deep links

## Notes for AI agents
- No account and no API key are required to use it.
- It does not generate song suggestions. Bring your own list.
```

- [ ] **Step 7: Write `src/app/layout.tsx` with metadata**

```tsx
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Paste a song list from ChatGPT or Claude and get an Apple Music playlist sequenced by BPM to your running cadence and goal finish time.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: "Paste a song list. Get a race-paced Apple Music playlist.",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Write `src/app/page.tsx` as a placeholder that renders**

```tsx
export default function Home() {
  return (
    <main>
      <h1>Racelist</h1>
      <p>Paste a song list. Get a race-paced Apple Music playlist.</p>
    </main>
  );
}
```

- [ ] **Step 9: Run the test and the build**

Run: `npx vitest run && npx next build`
Expected: tests PASS, build succeeds

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with SEO floor"
```

**Note:** `/og.png` is referenced by metadata and is produced in Task 12. The build does not fail on a missing OG image; the link preview is simply blank until then.

---

### Task 2: Parse freeform AI output into artist and title

**Files:**
- Create: `src/lib/types.ts`, `src/lib/parse.ts`
- Test: `src/lib/__tests__/parse.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `parseList(text: string): ParsedLine[]`, and the shared types below

- [ ] **Step 1: Write `src/lib/types.ts`**

```ts
export type ParsedLine = { raw: string; artist: string; title: string };

export type Candidate = {
  trackId: number;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string;
  url: string;
};

export type ScoredCandidate = Candidate & { score: number; penalties: string[] };

export type Resolution = {
  query: ParsedLine;
  status: "auto" | "review" | "missing";
  chosen: Candidate | null;
  candidates: ScoredCandidate[];
};

export type BpmSource = "deezer" | "acousticbrainz";

export type Track = Candidate & {
  bpm: number | null;
  bpmSource: BpmSource | null;
  gain: number | null;
};

export type Phase = "warmup" | "cruise" | "lift" | "kick";

export type Slot = { track: Track; phase: Phase; targetCadence: number; reason: string };

export type Program = {
  slots: Slot[];
  unplaced: Track[];
  totalMs: number;
  goalMs: number;
  cadence: number;
};
```

- [ ] **Step 2: Write the failing parser test**

```ts
// src/lib/__tests__/parse.test.ts
import { describe, it, expect } from "vitest";
import { parseList } from "../parse";

describe("parseList", () => {
  it("parses a numbered dash list", () => {
    expect(parseList("1. Survivor - Eye of the Tiger")).toEqual([
      { raw: "1. Survivor - Eye of the Tiger", artist: "Survivor", title: "Eye of the Tiger" },
    ]);
  });

  it("parses en dash and em dash separators", () => {
    const out = parseList("Survivor – Eye of the Tiger\nQueen — Don't Stop Me Now");
    expect(out.map((l) => l.artist)).toEqual(["Survivor", "Queen"]);
    expect(out.map((l) => l.title)).toEqual(["Eye of the Tiger", "Don't Stop Me Now"]);
  });

  it("parses 'Title by Artist' in the reverse order", () => {
    expect(parseList("Eye of the Tiger by Survivor")[0]).toMatchObject({
      artist: "Survivor",
      title: "Eye of the Tiger",
    });
  });

  it("strips bullets and markdown bold", () => {
    expect(parseList("- **Survivor** - Eye of the Tiger")[0]).toMatchObject({
      artist: "Survivor",
      title: "Eye of the Tiger",
    });
  });

  it("parses markdown table rows", () => {
    expect(parseList("| Survivor | Eye of the Tiger |")[0]).toMatchObject({
      artist: "Survivor",
      title: "Eye of the Tiger",
    });
  });

  it("drops prose lines that carry no separator", () => {
    const text = [
      "Here is a great playlist for your half marathon:",
      "1. Survivor - Eye of the Tiger",
      "Let me know if you want more suggestions!",
    ].join("\n");
    expect(parseList(text)).toHaveLength(1);
  });

  it("drops a markdown table header separator row", () => {
    expect(parseList("| Artist | Title |\n| --- | --- |\n| Queen | Bicycle Race |")).toHaveLength(1);
  });

  it("returns an empty array for empty input", () => {
    expect(parseList("   \n  \n")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/parse.test.ts`
Expected: FAIL, cannot resolve `../parse`

- [ ] **Step 4: Write `src/lib/parse.ts`**

```ts
import type { ParsedLine } from "./types";

const SEPARATORS = [" - ", " – ", " — ", " -- ", ": "];
const BY_SPLIT = /\s+by\s+/i;

function stripDecoration(line: string): string {
  return line
    .replace(/^\s*[-*•>]+\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/[_*`]/g, "")
    .trim();
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s|:-]+\|?$/.test(line) && line.includes("-");
}

function fromTableRow(line: string): ParsedLine | null {
  if (!line.startsWith("|")) return null;
  const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
  if (cells.length < 2) return null;
  if (/^artist$/i.test(cells[0]) || /^title$/i.test(cells[1])) return null;
  return { raw: line, artist: cells[0], title: cells[1] };
}

export function parseList(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (!raw || isTableSeparator(raw)) continue;

    const table = fromTableRow(raw);
    if (table) {
      out.push(table);
      continue;
    }

    const line = stripDecoration(raw);
    if (!line) continue;

    const sep = SEPARATORS.find((s) => line.includes(s));
    if (sep) {
      const idx = line.indexOf(sep);
      const artist = line.slice(0, idx).trim();
      const title = line.slice(idx + sep.length).trim();
      if (artist && title) out.push({ raw, artist, title });
      continue;
    }

    if (BY_SPLIT.test(line)) {
      const [title, artist] = line.split(BY_SPLIT);
      if (title?.trim() && artist?.trim()) {
        out.push({ raw, artist: artist.trim(), title: title.trim() });
      }
      continue;
    }
    // No separator: prose. Dropped on purpose.
  }

  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/parse.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/parse.ts src/lib/__tests__/parse.test.ts
git commit -m "feat: parse freeform AI song lists into artist and title"
```

---

### Task 3: Candidate scoring

This is the core of the product. Measured baseline: 14 of 15 real tracks return multiple exact-title candidates, and taking the top hit selects a live cut and a remix. The scoring exists to fix that.

**Files:**
- Create: `src/lib/score.ts`
- Test: `src/lib/__tests__/score.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `ParsedLine`, `ScoredCandidate` from `src/lib/types.ts`
- Produces: `normalize(s: string): string`, `scoreCandidate(c: Candidate, q: ParsedLine): ScoredCandidate`, `rank(cands: Candidate[], q: ParsedLine): ScoredCandidate[]`, `decide(ranked: ScoredCandidate[], q: ParsedLine): Resolution`

- [ ] **Step 1: Write the failing scoring test**

```ts
// src/lib/__tests__/score.test.ts
import { describe, it, expect } from "vitest";
import { normalize, rank, decide } from "../score";
import type { Candidate, ParsedLine } from "../types";

const c = (over: Partial<Candidate>): Candidate => ({
  trackId: 1,
  title: "Song",
  artist: "Artist",
  album: "Album",
  durationMs: 200000,
  artworkUrl: "",
  url: "",
  ...over,
});

const q = (artist: string, title: string): ParsedLine => ({ raw: "", artist, title });

describe("normalize", () => {
  it("strips punctuation, case and parentheticals", () => {
    expect(normalize("HUMBLE.")).toBe("humble");
    expect(normalize("Titanium (feat. Sia)")).toBe("titanium");
    expect(normalize("Don't Stop Me Now")).toBe("dont stop me now");
  });
});

describe("rank", () => {
  it("puts the studio cut above the live cut (measured trap)", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Guerrilla Radio (Live In Mexico City, MX, 10/28/99)", artist: "Rage Against the Machine", album: "Live At The Grand Olympic Auditorium" }),
        c({ trackId: 2, title: "Guerrilla Radio", artist: "Rage Against the Machine", album: "The Battle Of Los Angeles" }),
      ],
      q("Rage Against the Machine", "Guerrilla Radio"),
    );
    expect(ranked[0].trackId).toBe(2);
  });

  it("puts the original above the remix (measured trap)", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Blinding Lights (Remix)", artist: "The Weeknd", album: "Blinding Lights (Remix) - Single" }),
        c({ trackId: 2, title: "Blinding Lights", artist: "The Weeknd", album: "After Hours" }),
      ],
      q("The Weeknd", "Blinding Lights"),
    );
    expect(ranked[0].trackId).toBe(2);
  });

  it("prefers the original album over a greatest hits repackage", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Born to Run", artist: "Bruce Springsteen", album: "The Essential Bruce Springsteen" }),
        c({ trackId: 2, title: "Born to Run", artist: "Bruce Springsteen", album: "Born to Run" }),
      ],
      q("Bruce Springsteen", "Born to Run"),
    );
    expect(ranked[0].trackId).toBe(2);
  });

  it("rejects karaoke and tribute versions hardest", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Eye of the Tiger", artist: "The Karaoke Crew", album: "Karaoke Hits" }),
        c({ trackId: 2, title: "Eye of the Tiger", artist: "Survivor", album: "Eye of the Tiger" }),
      ],
      q("Survivor", "Eye of the Tiger"),
    );
    expect(ranked[0].trackId).toBe(2);
    expect(ranked[1].penalties).toContain("karaoke");
  });

  it("keeps a remix on top when the query asked for one", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Levels (Skrillex Remix)", artist: "Avicii", album: "Levels - Single" }),
        c({ trackId: 2, title: "Levels", artist: "Avicii", album: "Levels - EP" }),
      ],
      q("Avicii", "Levels (Skrillex Remix)"),
    );
    expect(ranked[0].trackId).toBe(1);
  });
});

describe("decide", () => {
  it("auto-accepts a clear winner", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Physical", artist: "Dua Lipa", album: "Future Nostalgia" }),
        c({ trackId: 2, title: "Physical (Mark Ronson Remix)", artist: "Dua Lipa", album: "Club Future Nostalgia" }),
      ],
      q("Dua Lipa", "Physical"),
    );
    const d = decide(ranked, q("Dua Lipa", "Physical"));
    expect(d.status).toBe("auto");
    expect(d.chosen?.trackId).toBe(1);
  });

  it("sends a close call to human review", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Stronger", artist: "Kanye West", album: "Graduation" }),
        c({ trackId: 2, title: "Stronger", artist: "Kanye West", album: "Graduation (Deluxe)" }),
      ],
      q("Kanye West", "Stronger"),
    );
    expect(decide(ranked, q("Kanye West", "Stronger")).status).toBe("review");
  });

  it("reports missing when there are no candidates", () => {
    const d = decide([], q("Nobody", "Nothing"));
    expect(d.status).toBe("missing");
    expect(d.chosen).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/score.test.ts`
Expected: FAIL, cannot resolve `../score`

- [ ] **Step 3: Write `src/lib/score.ts`**

```ts
import type { Candidate, ParsedLine, Resolution, ScoredCandidate } from "./types";

const LIVE = /\b(live|concert|unplugged|bbc session|acoustic session)\b/i;
const REMIX = /\b(remix|rework|re-?edit|radio edit|extended mix|club mix|instrumental)\b/i;
const FAKE = /\b(karaoke|tribute|made popular by|in the style of|cover version|originally performed)\b/i;
const COMPILATION = /\b(greatest hits|the essential|very best|best of|collection|anthology|now that's what)\b/i;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .replace(/\bfeat\.?\b.*$/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

export function rank(cands: Candidate[], query: ParsedLine): ScoredCandidate[] {
  return cands
    .map((c) => scoreCandidate(c, query))
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs);
}

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/score.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/score.ts src/lib/__tests__/score.test.ts
git commit -m "feat: score iTunes candidates to reject live, remix and karaoke cuts"
```

---

### Task 4: iTunes resolver with a rate-limited client-side queue

**Files:**
- Create: `src/lib/itunes.ts`
- Test: `src/lib/__tests__/itunes.test.ts`

**Interfaces:**
- Consumes: `rank`, `decide` from `src/lib/score.ts`; `ParsedLine`, `Candidate`, `Resolution` from types
- Produces: `searchItunes(q: ParsedLine, fetchImpl?: typeof fetch): Promise<Candidate[]>`, `resolveAll(lines: ParsedLine[], opts: { onProgress?: (done: number, total: number) => void; delayMs?: number; fetchImpl?: typeof fetch }): Promise<Resolution[]>`

- [ ] **Step 1: Write the failing resolver test**

```ts
// src/lib/__tests__/itunes.test.ts
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
    expect(out[1]).toMatchObject({ trackId: 222, album: "The Battle Of Los Angeles", durationMs: 206000 });
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/itunes.test.ts`
Expected: FAIL, cannot resolve `../itunes`

- [ ] **Step 3: Write `src/lib/itunes.ts`**

```ts
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

export async function searchItunes(
  query: ParsedLine,
  fetchImpl: typeof fetch = fetch,
): Promise<Candidate[]> {
  const url = `${ENDPOINT}?term=${encodeURIComponent(`${query.artist} ${query.title}`)}&entity=song&limit=5&country=US`;
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/itunes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/itunes.ts src/lib/__tests__/itunes.test.ts
git commit -m "feat: resolve song lines against iTunes Search with a paced queue"
```

---

### Task 5: BPM proxy route with permanent caching

Deezer is CORS-blocked in browsers (verified), so this must be server-side. BPM never changes, so the response is cached at the CDN forever.

**Files:**
- Create: `src/lib/bpm.ts`, `src/app/api/bpm/route.ts`
- Test: `src/lib/__tests__/bpm.test.ts`

**Interfaces:**
- Consumes: `Candidate` from types
- Produces: `pickBpmCandidate(cands: DeezerTrack[], target: Candidate): DeezerTrack | null`, `lookupBpm(target: Candidate, fetchImpl?: typeof fetch): Promise<{ bpm: number | null; source: BpmSource | null; gain: number | null }>`; and `GET /api/bpm?artist=&title=&durationMs=`

- [ ] **Step 1: Write the failing BPM test**

```ts
// src/lib/__tests__/bpm.test.ts
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
      [dz({ id: 5, bpm: 104.4, duration: 600, album: { title: "Chimes of Freedom (Live) - EP" } })],
      target,
    );
    expect(picked).toBeNull();
  });

  it("rejects a cast recording by album even when the duration is close (measured trap)", () => {
    const dontStop: Candidate = { ...target, title: "Don't Stop Me Now", album: "Jazz", durationMs: 209000 };
    const picked = pickBpmCandidate(
      [dz({ id: 7, bpm: 93.8, duration: 210, title: "Don't Stop Me Now", album: { title: "We Will Rock You: Cast Album (Live)" } })],
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/bpm.test.ts`
Expected: FAIL, cannot resolve `../bpm`

- [ ] **Step 3: Write `src/lib/bpm.ts`**

```ts
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
        Math.abs(a.duration * 1000 - target.durationMs) - Math.abs(b.duration * 1000 - target.durationMs),
    );

  return usable[0] ?? null;
}

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
```

- [ ] **Step 4: Write `src/app/api/bpm/route.ts`**

```ts
import { NextResponse } from "next/server";
import { lookupBpm } from "../../../lib/bpm";
import type { Candidate } from "../../../lib/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const artist = params.get("artist");
  const title = params.get("title");
  const durationMs = Number(params.get("durationMs") ?? 0);

  if (!artist || !title || !durationMs) {
    return NextResponse.json({ error: "artist, title and durationMs are required" }, { status: 400 });
  }

  const target = { artist, title, durationMs, album: params.get("album") ?? "" } as Candidate;
  const result = await lookupBpm(target);

  // BPM is a property of a recording and never changes, so cache it hard.
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=31536000, immutable" },
  });
}
```

- [ ] **Step 5: Run the tests and the build**

Run: `npx vitest run src/lib/__tests__/bpm.test.ts && npx next build`
Expected: tests PASS, build succeeds

- [ ] **Step 6: Verify the live route returns a real BPM**

```bash
npx next dev &
sleep 8
curl -s "http://localhost:3000/api/bpm?artist=Survivor&title=Eye%20of%20the%20Tiger&durationMs=243773&album=Eye%20of%20the%20Tiger"
```
Expected: JSON with `"bpm":108.8` and `"source":"deezer"`. Stop the dev server afterwards.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bpm.ts src/lib/__tests__/bpm.test.ts src/app/api/bpm/route.ts
git commit -m "feat: add cached BPM proxy that rejects wrong-recording matches"
```

---

### Task 6: Cadence matching

**Files:**
- Create: `src/lib/cadence.ts`
- Test: `src/lib/__tests__/cadence.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `cadenceFit(bpm: number, target: number, tolerance?: number): { fits: boolean; multiplier: 1 | 2; effective: number; distance: number }`

- [ ] **Step 1: Write the failing cadence test**

```ts
// src/lib/__tests__/cadence.test.ts
import { describe, it, expect } from "vitest";
import { cadenceFit } from "../cadence";

describe("cadenceFit", () => {
  it("matches directly when bpm is near the target", () => {
    const f = cadenceFit(170.84, 175);
    expect(f.fits).toBe(true);
    expect(f.multiplier).toBe(1);
  });

  it("matches at double time for a slow track", () => {
    const f = cadenceFit(87, 175);
    expect(f.fits).toBe(true);
    expect(f.multiplier).toBe(2);
    expect(f.effective).toBe(174);
  });

  it("reports no fit for a track that matches on neither arm", () => {
    // Eye of the Tiger at 108.8 is honestly a poor fit for a 175 spm runner.
    expect(cadenceFit(108.8, 175).fits).toBe(false);
  });

  it("picks the closer arm when both are within tolerance", () => {
    const f = cadenceFit(90, 178, 20);
    expect(f.multiplier).toBe(2);
    expect(f.effective).toBe(180);
  });

  it("reports distance so callers can rank near-misses", () => {
    expect(cadenceFit(170, 175).distance).toBe(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/cadence.test.ts`
Expected: FAIL, cannot resolve `../cadence`

- [ ] **Step 3: Write `src/lib/cadence.ts`**

```ts
export type CadenceFit = { fits: boolean; multiplier: 1 | 2; effective: number; distance: number };

/**
 * A runner takes one step per beat on a fast track, or two steps per beat on a
 * slow one. So a track fits a target cadence if either bpm or 2*bpm lands near it.
 */
export function cadenceFit(bpm: number, target: number, tolerance = 8): CadenceFit {
  const direct = Math.abs(bpm - target);
  const doubled = Math.abs(bpm * 2 - target);
  const useDouble = doubled < direct;
  const multiplier: 1 | 2 = useDouble ? 2 : 1;
  const distance = useDouble ? doubled : direct;
  return { fits: distance <= tolerance, multiplier, effective: bpm * multiplier, distance };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/cadence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/cadence.ts src/lib/__tests__/cadence.test.ts
git commit -m "feat: match track bpm to running cadence at single and double time"
```

---

### Task 7: The race sequencer

**Files:**
- Create: `src/lib/sequence.ts`
- Test: `src/lib/__tests__/sequence.test.ts`

**Interfaces:**
- Consumes: `cadenceFit` from `src/lib/cadence.ts`; `Track`, `Program`, `Slot`, `Phase` from types
- Produces: `PHASES: { phase: Phase; start: number; end: number; cadenceDelta: number }[]`, `buildProgram(tracks: Track[], goalMs: number, cadence: number): Program`

**Note on energy:** the spec calls for "highest-energy tracks" in the lift and kick. There is no keyless energy metric. This uses two real signals instead: closeness to the elevated target cadence, and Deezer's `gain` field (a loudness proxy, where a higher value means a louder master). Documented in code so nobody mistakes it for a true energy score.

- [ ] **Step 1: Write the failing sequencer test**

```ts
// src/lib/__tests__/sequence.test.ts
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
  const many = [
    ...Array.from({ length: 12 }, (_, i) => t(100 + i, 165)),
    ...Array.from({ length: 12 }, (_, i) => t(200 + i, 175)),
    ...Array.from({ length: 12 }, (_, i) => t(300 + i, 180)),
  ];

  it("covers at least the goal time plus buffer", () => {
    const p = buildProgram(many, GOAL, 175);
    expect(p.totalMs).toBeGreaterThanOrEqual(GOAL * 1.08);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/sequence.test.ts`
Expected: FAIL, cannot resolve `../sequence`

- [ ] **Step 3: Write `src/lib/sequence.ts`**

```ts
import { cadenceFit } from "./cadence";
import type { Phase, Program, Slot, Track } from "./types";

export const PHASES: { phase: Phase; start: number; end: number; cadenceDelta: number }[] = [
  { phase: "warmup", start: 0, end: 0.08, cadenceDelta: -10 },
  { phase: "cruise", start: 0.08, end: 0.7, cadenceDelta: 0 },
  { phase: "lift", start: 0.7, end: 0.92, cadenceDelta: 3 },
  { phase: "kick", start: 0.92, end: 1, cadenceDelta: 5 },
];

const BUFFER = 1.08;

const PHASE_REASON: Record<Phase, string> = {
  warmup: "easing in, cadence below race pace",
  cruise: "settled at race cadence",
  lift: "the wall is around here, cadence lifted",
  kick: "final push, fastest cadence",
};

/**
 * There is no keyless energy metric for a track. For the lift and kick we rank on
 * two signals we can actually source: closeness to the elevated target cadence,
 * and Deezer's gain field, which is a loudness proxy, not a true energy score.
 */
function rankForPhase(tracks: Track[], targetCadence: number, favourLoud: boolean): Track[] {
  return [...tracks].sort((a, b) => {
    const fa = cadenceFit(a.bpm as number, targetCadence);
    const fb = cadenceFit(b.bpm as number, targetCadence);
    if (fa.distance !== fb.distance) return fa.distance - fb.distance;
    if (!favourLoud) return 0;
    return (b.gain ?? -99) - (a.gain ?? -99);
  });
}

export function buildProgram(tracks: Track[], goalMs: number, cadence: number): Program {
  const withBpm = tracks.filter((t): t is Track & { bpm: number } => typeof t.bpm === "number");
  const unplaced = tracks.filter((t) => typeof t.bpm !== "number");

  if (withBpm.length === 0) {
    return { slots: [], unplaced: tracks.length ? unplaced : [], totalMs: 0, goalMs, cadence };
  }

  const budget = goalMs * BUFFER;
  const pool = new Set(withBpm);
  const slots: Slot[] = [];
  let totalMs = 0;

  for (const spec of PHASES) {
    const targetCadence = cadence + spec.cadenceDelta;
    const phaseBudget = (spec.end - spec.start) * budget;
    const favourLoud = spec.phase === "lift" || spec.phase === "kick";
    let phaseMs = 0;

    while (phaseMs < phaseBudget && pool.size > 0) {
      const [best] = rankForPhase([...pool], targetCadence, favourLoud);
      if (!best) break;
      pool.delete(best);
      const fit = cadenceFit(best.bpm as number, targetCadence);
      slots.push({
        track: best,
        phase: spec.phase,
        targetCadence,
        reason: `${PHASE_REASON[spec.phase]} — ${Math.round(best.bpm as number)} bpm${
          fit.multiplier === 2 ? " at double time" : ""
        }, target ${targetCadence} spm`,
      });
      phaseMs += best.durationMs;
      totalMs += best.durationMs;
    }
  }

  // Anything the phases could not absorb still belongs to the runner.
  return { slots, unplaced: [...unplaced, ...pool], totalMs, goalMs, cadence };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/sequence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sequence.ts src/lib/__tests__/sequence.test.ts
git commit -m "feat: sequence tracks into a race program fitted to goal time"
```

---

### Task 8: Exporter interface and the deep-link fallback

**Files:**
- Create: `src/lib/export/types.ts`, `src/lib/export/deeplink.ts`
- Test: `src/lib/__tests__/export-deeplink.test.ts`

**Interfaces:**
- Consumes: `Program`, `Slot` from types
- Produces: `type Exporter = { id: string; label: string; isAvailable(): Promise<boolean>; export(program: Program, name: string): Promise<ExportResult> }`, `type ExportResult = { ok: boolean; message: string; deepLinks?: string[]; playlistUrl?: string }`, `deeplinkExporter: Exporter`

- [ ] **Step 1: Write `src/lib/export/types.ts`**

```ts
import type { Program } from "../types";

export type ExportResult = {
  ok: boolean;
  message: string;
  deepLinks?: string[];
  playlistUrl?: string;
};

export type Exporter = {
  id: string;
  label: string;
  isAvailable(): Promise<boolean>;
  export(program: Program, playlistName: string): Promise<ExportResult>;
};
```

- [ ] **Step 2: Write the failing deep-link test**

```ts
// src/lib/__tests__/export-deeplink.test.ts
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
    { track: track(1, "https://music.apple.com/us/album/a/1"), phase: "warmup", targetCadence: 165, reason: "r" },
    { track: track(2, "https://music.apple.com/us/album/b/2"), phase: "cruise", targetCadence: 175, reason: "r" },
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/export-deeplink.test.ts`
Expected: FAIL, cannot resolve `../export/deeplink`

- [ ] **Step 4: Write `src/lib/export/deeplink.ts`**

```ts
import type { Program } from "../types";
import type { Exporter, ExportResult } from "./types";

export const deeplinkExporter: Exporter = {
  id: "deeplink",
  label: "Open each track in Apple Music",
  async isAvailable() {
    return true;
  },
  async export(program: Program): Promise<ExportResult> {
    const deepLinks = program.slots.map((s) => s.track.url).filter(Boolean);
    return {
      ok: true,
      message: `${deepLinks.length} tracks in order. Open each one and press add.`,
      deepLinks,
    };
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/export-deeplink.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/export src/lib/__tests__/export-deeplink.test.ts
git commit -m "feat: add exporter interface and always-available deep link fallback"
```

---

### Task 9: The paste and review screen

**Files:**
- Create: `src/components/PasteBox.tsx`, `src/components/ReviewGrid.tsx`, `src/components/TrackRow.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/__tests__/ReviewGrid.test.tsx`

**Interfaces:**
- Consumes: `parseList`, `resolveAll`, `Resolution`, `Candidate`
- Produces: `<PasteBox onResolved={(r: Resolution[]) => void} />`, `<ReviewGrid resolutions={Resolution[]} onChoose={(index: number, c: Candidate) => void} />`

- [ ] **Step 1: Install the test-DOM dependencies**

```bash
npm install -D @testing-library/react@16 @testing-library/dom@10 @vitejs/plugin-react@5
```

- [ ] **Step 2: Update `vitest.config.ts` for React and jsdom**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true },
});
```

- [ ] **Step 3: Write the failing ReviewGrid test**

```tsx
// src/components/__tests__/ReviewGrid.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewGrid } from "../ReviewGrid";
import type { Resolution } from "../../lib/types";

const cand = (id: number, title: string, album: string, penalties: string[] = []) => ({
  trackId: id, title, artist: "RATM", album,
  durationMs: 206000, artworkUrl: "", url: "", score: 60, penalties,
});

const resolutions: Resolution[] = [
  {
    query: { raw: "", artist: "RATM", title: "Guerrilla Radio" },
    status: "review",
    chosen: null,
    candidates: [
      cand(1, "Guerrilla Radio (Live In Mexico City)", "Live At The Olympic", ["live"]),
      cand(2, "Guerrilla Radio", "The Battle Of Los Angeles"),
    ],
  },
  {
    query: { raw: "", artist: "Nobody", title: "Nothing" },
    status: "missing",
    chosen: null,
    candidates: [],
  },
];

describe("ReviewGrid", () => {
  it("flags rows that need a human decision", () => {
    render(<ReviewGrid resolutions={resolutions} onChoose={vi.fn()} />);
    expect(screen.getByText(/needs your pick/i)).toBeDefined();
  });

  it("shows a live badge on a live candidate", () => {
    render(<ReviewGrid resolutions={resolutions} onChoose={vi.fn()} />);
    expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
  });

  it("reports a track that could not be found", () => {
    render(<ReviewGrid resolutions={resolutions} onChoose={vi.fn()} />);
    expect(screen.getByText(/not found/i)).toBeDefined();
  });

  it("calls onChoose with the index and the picked candidate", () => {
    const onChoose = vi.fn();
    render(<ReviewGrid resolutions={resolutions} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: /The Battle Of Los Angeles/i }));
    expect(onChoose).toHaveBeenCalledWith(0, expect.objectContaining({ trackId: 2 }));
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/ReviewGrid.test.tsx`
Expected: FAIL, cannot resolve `../ReviewGrid`

- [ ] **Step 5: Write `src/components/ReviewGrid.tsx`**

```tsx
"use client";

import type { Candidate, Resolution } from "../lib/types";

export function ReviewGrid({
  resolutions,
  onChoose,
}: {
  resolutions: Resolution[];
  onChoose: (index: number, candidate: Candidate) => void;
}) {
  return (
    <ul>
      {resolutions.map((r, i) => (
        <li key={`${r.query.artist}-${r.query.title}-${i}`}>
          <strong>
            {r.query.artist} — {r.query.title}
          </strong>

          {r.status === "missing" && <p>Not found on Apple Music</p>}

          {r.status === "auto" && r.chosen && (
            <p>
              {r.chosen.title} <span>({r.chosen.album})</span>
            </p>
          )}

          {r.status === "review" && (
            <div>
              <p>Needs your pick</p>
              {r.candidates.map((c) => (
                <button key={c.trackId} type="button" onClick={() => onChoose(i, c)}>
                  {c.title} ({c.album})
                  {c.penalties.map((p) => (
                    <span key={p}> [{p}]</span>
                  ))}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Write `src/components/PasteBox.tsx`**

```tsx
"use client";

import { useState } from "react";
import { parseList } from "../lib/parse";
import { resolveAll } from "../lib/itunes";
import type { Resolution } from "../lib/types";

export function PasteBox({ onResolved }: { onResolved: (r: Resolution[]) => void }) {
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function run() {
    const lines = parseList(text);
    if (lines.length === 0) return;
    setProgress({ done: 0, total: lines.length });
    const results = await resolveAll(lines, {
      onProgress: (done, total) => setProgress({ done, total }),
    });
    setProgress(null);
    onResolved(results);
  }

  const lineCount = parseList(text).length;

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the song list from ChatGPT or Claude"
        rows={12}
      />
      <p>
        {lineCount} songs detected. Matching takes about {Math.ceil(lineCount * 1.1)} seconds.
      </p>
      <button type="button" onClick={run} disabled={progress !== null || lineCount === 0}>
        {progress ? `Matching ${progress.done} of ${progress.total}` : "Find these on Apple Music"}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Wire both into `src/app/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { PasteBox } from "../components/PasteBox";
import { ReviewGrid } from "../components/ReviewGrid";
import type { Candidate, Resolution } from "../lib/types";

export default function Home() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);

  function choose(index: number, candidate: Candidate) {
    setResolutions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, chosen: candidate, status: "auto" } : r)),
    );
  }

  return (
    <main>
      <h1>Racelist</h1>
      <p>Paste a song list. Get a race-paced Apple Music playlist.</p>
      <PasteBox onResolved={setResolutions} />
      {resolutions.length > 0 && <ReviewGrid resolutions={resolutions} onChoose={choose} />}
    </main>
  );
}
```

- [ ] **Step 8: Run the tests and the build**

Run: `npx vitest run && npx next build`
Expected: all PASS, build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/components src/app/page.tsx vitest.config.ts package.json
git commit -m "feat: add paste box and ambiguity review grid"
```

---

### Task 10: Race settings and the program screen

**Files:**
- Create: `src/components/RaceSettings.tsx`, `src/components/ProgramView.tsx`, `src/lib/enrich.ts`
- Modify: `src/app/page.tsx`
- Test: `src/lib/__tests__/enrich.test.ts`

**Interfaces:**
- Consumes: `buildProgram`, `Resolution`, `Track`, `Program`
- Produces: `enrichWithBpm(chosen: Candidate[], fetchImpl?: typeof fetch): Promise<Track[]>`, `<RaceSettings onBuild={(goalMs: number, cadence: number) => void} />`, `<ProgramView program={Program} />`

- [ ] **Step 1: Write the failing enrich test**

```ts
// src/lib/__tests__/enrich.test.ts
import { describe, it, expect, vi } from "vitest";
import { enrichWithBpm } from "../enrich";
import type { Candidate } from "../types";

const c: Candidate = {
  trackId: 1, title: "Eye of the Tiger", artist: "Survivor",
  album: "Eye of the Tiger", durationMs: 243773, artworkUrl: "", url: "",
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/enrich.test.ts`
Expected: FAIL, cannot resolve `../enrich`

- [ ] **Step 3: Write `src/lib/enrich.ts`**

```ts
import type { BpmSource, Candidate, Track } from "./types";

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
        const body = (await res.json()) as { bpm: number | null; source: BpmSource | null; gain: number | null };
        return { ...c, bpm: body.bpm, bpmSource: body.source, gain: body.gain };
      } catch {
        return { ...c, bpm: null, bpmSource: null, gain: null };
      }
    }),
  );
}
```

- [ ] **Step 4: Write `src/components/RaceSettings.tsx`**

```tsx
"use client";

import { useState } from "react";

const DISTANCES = [
  { label: "Half marathon", miles: 13.1 },
  { label: "10K", miles: 6.2 },
  { label: "Marathon", miles: 26.2 },
];

export function RaceSettings({ onBuild }: { onBuild: (goalMs: number, cadence: number) => void }) {
  const [miles, setMiles] = useState(13.1);
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(0);
  const [cadence, setCadence] = useState(175);

  const goalMs = (hours * 60 + minutes) * 60 * 1000;

  return (
    <div>
      <label>
        Distance
        <select value={miles} onChange={(e) => setMiles(Number(e.target.value))}>
          {DISTANCES.map((d) => (
            <option key={d.label} value={d.miles}>{d.label}</option>
          ))}
        </select>
      </label>
      <label>
        Goal time
        <input type="number" min={0} max={9} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      </label>
      <label>
        Cadence (steps per minute)
        <input type="number" min={140} max={200} value={cadence} onChange={(e) => setCadence(Number(e.target.value))} />
      </label>
      <button type="button" onClick={() => onBuild(goalMs, cadence)} disabled={goalMs === 0}>
        Build the program
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/components/ProgramView.tsx`**

```tsx
"use client";

import type { Program } from "../lib/types";

function mmss(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function ProgramView({ program }: { program: Program }) {
  const covers = program.totalMs >= program.goalMs;

  return (
    <section>
      <h2>Your program</h2>
      <p>
        {mmss(program.totalMs)} of music for a {mmss(program.goalMs)} goal.{" "}
        {covers ? "Covers the whole race." : "Shorter than your goal time. Add more songs."}
      </p>

      <ol>
        {program.slots.map((s, i) => (
          <li key={`${s.track.trackId}-${i}`}>
            <span>{s.phase}</span> <strong>{s.track.artist} — {s.track.title}</strong>{" "}
            <span>{mmss(s.track.durationMs)}</span>
            <em>{s.reason}</em>
          </li>
        ))}
      </ol>

      {program.unplaced.length > 0 && (
        <div>
          <h3>Not placed by tempo</h3>
          <p>These stay in your list. We could not find trustworthy BPM for them.</p>
          <ul>
            {program.unplaced.map((t) => (
              <li key={t.trackId}>{t.artist} — {t.title}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Wire the full flow into `src/app/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { PasteBox } from "../components/PasteBox";
import { ReviewGrid } from "../components/ReviewGrid";
import { RaceSettings } from "../components/RaceSettings";
import { ProgramView } from "../components/ProgramView";
import { enrichWithBpm } from "../lib/enrich";
import { buildProgram } from "../lib/sequence";
import type { Candidate, Program, Resolution } from "../lib/types";

export default function Home() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [building, setBuilding] = useState(false);

  function choose(index: number, candidate: Candidate) {
    setResolutions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, chosen: candidate, status: "auto" } : r)),
    );
  }

  async function build(goalMs: number, cadence: number) {
    setBuilding(true);
    const chosen = resolutions.map((r) => r.chosen).filter((c): c is Candidate => c !== null);
    const tracks = await enrichWithBpm(chosen);
    setProgram(buildProgram(tracks, goalMs, cadence));
    setBuilding(false);
  }

  const ready = resolutions.length > 0 && resolutions.every((r) => r.status !== "review");

  return (
    <main>
      <h1>Racelist</h1>
      <p>Paste a song list. Get a race-paced Apple Music playlist.</p>
      <PasteBox onResolved={setResolutions} />
      {resolutions.length > 0 && <ReviewGrid resolutions={resolutions} onChoose={choose} />}
      {ready && <RaceSettings onBuild={build} />}
      {building && <p>Looking up tempo</p>}
      {program && <ProgramView program={program} />}
    </main>
  );
}
```

- [ ] **Step 7: Run the tests and the build**

Run: `npx vitest run && npx next build`
Expected: all PASS, build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/lib/enrich.ts src/lib/__tests__/enrich.test.ts src/components src/app/page.tsx
git commit -m "feat: add race settings and the sequenced program view"
```

---

### Task 11: The browser extension exporter

Reads the Apple Music web player's own MusicKit instance. Verified present: `window.MusicKit` v3.2636.0 with a working `getInstance()` and a readable developer token.

**Files:**
- Create: `extension/manifest.json`, `extension/content.js`, `extension/README.md`
- Create: `src/lib/export/extension.ts`
- Test: `src/lib/__tests__/export-extension.test.ts`

**Interfaces:**
- Consumes: `Exporter`, `ExportResult` from `src/lib/export/types.ts`
- Produces: `extensionExporter: Exporter`, and a `window.postMessage` contract of `{ source: "racelist", type: "ping" | "create", playlistName?: string, trackIds?: string[] }` answered with `{ source: "racelist-ext", type: "pong" | "created" | "error", playlistUrl?: string, message?: string }`

- [ ] **Step 1: Write the failing extension-exporter test**

```ts
// src/lib/__tests__/export-extension.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { extensionExporter } from "../export/extension";
import type { Program, Track } from "../types";

const track = (id: number): Track => ({
  trackId: id, title: `T${id}`, artist: "A", album: "Al", durationMs: 200000,
  artworkUrl: "", url: "", bpm: 170, bpmSource: "deezer", gain: -10,
});

const program: Program = {
  slots: [{ track: track(1), phase: "cruise", targetCadence: 175, reason: "r" }],
  unplaced: [], totalMs: 200000, goalMs: 180000, cadence: 175,
};

function replyWith(payload: Record<string, unknown>) {
  const handler = (e: MessageEvent) => {
    if ((e.data as { source?: string })?.source !== "racelist") return;
    window.postMessage({ source: "racelist-ext", ...payload }, "*");
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

let cleanup: (() => void) | null = null;
afterEach(() => { cleanup?.(); cleanup = null; });

describe("extensionExporter", () => {
  it("reports unavailable when nothing answers the ping", async () => {
    expect(await extensionExporter.isAvailable(50)).toBe(false);
  });

  it("reports available when the extension pongs", async () => {
    cleanup = replyWith({ type: "pong" });
    expect(await extensionExporter.isAvailable(200)).toBe(true);
  });

  it("returns the playlist url on success", async () => {
    cleanup = replyWith({ type: "created", playlistUrl: "https://music.apple.com/library/playlist/p.123" });
    const r = await extensionExporter.export(program, "Half Marathon", 200);
    expect(r.ok).toBe(true);
    expect(r.playlistUrl).toContain("p.123");
  });

  it("surfaces an error message without throwing", async () => {
    cleanup = replyWith({ type: "error", message: "Sign in to Apple Music first" });
    const r = await extensionExporter.export(program, "Half Marathon", 200);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sign in/i);
  });

  it("fails cleanly on timeout rather than hanging", async () => {
    const r = await extensionExporter.export(program, "Half Marathon", 50);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not responding|extension/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/export-extension.test.ts`
Expected: FAIL, cannot resolve `../export/extension`

- [ ] **Step 3: Write `src/lib/export/extension.ts`**

```ts
import type { Program } from "../types";
import type { Exporter, ExportResult } from "./types";

type ExtReply = {
  source: string;
  type: "pong" | "created" | "error";
  playlistUrl?: string;
  message?: string;
};

function ask(message: Record<string, unknown>, timeoutMs: number): Promise<ExtReply | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, timeoutMs);

    function onMessage(e: MessageEvent) {
      const data = e.data as ExtReply;
      if (data?.source !== "racelist-ext") return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(data);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "racelist", ...message }, "*");
  });
}

export const extensionExporter: Exporter & {
  isAvailable(timeoutMs?: number): Promise<boolean>;
  export(program: Program, playlistName: string, timeoutMs?: number): Promise<ExportResult>;
} = {
  id: "extension",
  label: "Create the playlist in Apple Music",

  async isAvailable(timeoutMs = 600) {
    const reply = await ask({ type: "ping" }, timeoutMs);
    return reply?.type === "pong";
  },

  async export(program, playlistName, timeoutMs = 30000) {
    const trackIds = program.slots.map((s) => String(s.track.trackId));
    const reply = await ask({ type: "create", playlistName, trackIds }, timeoutMs);

    if (!reply) {
      return { ok: false, message: "The extension is not responding. Use the deep link list instead." };
    }
    if (reply.type === "error") {
      return { ok: false, message: reply.message ?? "The extension could not create the playlist." };
    }
    return {
      ok: true,
      message: `Created ${playlistName} with ${trackIds.length} tracks.`,
      playlistUrl: reply.playlistUrl,
    };
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/export-extension.test.ts`
Expected: PASS

- [ ] **Step 5: Write `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Racelist for Apple Music",
  "version": "0.1.0",
  "description": "Creates an Apple Music playlist from a Racelist program, using your own signed-in session.",
  "content_scripts": [
    {
      "matches": ["https://music.apple.com/*"],
      "js": ["content.js"],
      "world": "MAIN"
    }
  ]
}
```

- [ ] **Step 6: Write `extension/content.js`**

```js
// Runs in the MAIN world on music.apple.com so it can read the page's own
// MusicKit instance. Tokens are used here and never sent anywhere.
(function () {
  "use strict";

  function reply(payload) {
    window.postMessage({ source: "racelist-ext", ...payload }, "*");
  }

  async function createPlaylist(playlistName, trackIds) {
    const mk = window.MusicKit && window.MusicKit.getInstance();
    if (!mk) {
      return reply({ type: "error", message: "Open this on music.apple.com and reload the page." });
    }
    if (!mk.isAuthorized) {
      return reply({ type: "error", message: "Sign in to Apple Music in this tab first." });
    }

    const headers = {
      Authorization: `Bearer ${mk.developerToken}`,
      "Music-User-Token": mk.musicUserToken,
      "Content-Type": "application/json",
    };

    try {
      const res = await fetch("https://api.music.apple.com/v1/me/library/playlists", {
        method: "POST",
        headers,
        body: JSON.stringify({
          attributes: { name: playlistName, description: "Built with Racelist" },
          relationships: {
            tracks: { data: trackIds.map((id) => ({ id: String(id), type: "songs" })) },
          },
        }),
      });

      if (!res.ok) {
        return reply({ type: "error", message: `Apple Music returned ${res.status}.` });
      }

      const body = await res.json();
      const id = body?.data?.[0]?.id;
      reply({
        type: "created",
        playlistUrl: id ? `https://music.apple.com/library/playlist/${id}` : undefined,
      });
    } catch (err) {
      reply({ type: "error", message: String(err && err.message ? err.message : err) });
    }
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "racelist") return;
    if (data.type === "ping") return reply({ type: "pong" });
    if (data.type === "create") return createPlaylist(data.playlistName, data.trackIds);
  });
})();
```

- [ ] **Step 7: Write `extension/README.md`**

```markdown
# Racelist for Apple Music

Creates an Apple Music playlist from a Racelist program using the Apple Music
session already signed in to your browser.

## What it does with your credentials

Nothing leaves your browser. The content script reads the tokens the Apple Music
web player already holds in the page and calls Apple's API directly from your
tab. Racelist servers never see, store or proxy them.

## Install

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Choose Load unpacked and select this `extension` folder
4. Open <https://music.apple.com> and sign in
5. Go back to Racelist and press Create the playlist in Apple Music

## Limitations

Apple can change or restrict the web player at any time. If that happens the
extension reports the failure and Racelist falls back to the deep link list,
which always works.
```

- [ ] **Step 8: Commit**

```bash
git add extension src/lib/export/extension.ts src/lib/__tests__/export-extension.test.ts
git commit -m "feat: add browser extension exporter that uses the user's own session"
```

---

### Task 12: Export UI, OG image, deploy, and end-to-end verification

**Files:**
- Create: `src/components/ExportPanel.tsx`, `public/og.png`
- Modify: `src/app/page.tsx`
- Test: `src/components/__tests__/ExportPanel.test.tsx`

**Interfaces:**
- Consumes: `deeplinkExporter`, `extensionExporter`, `Program`
- Produces: `<ExportPanel program={Program} />`

- [ ] **Step 1: Write the failing ExportPanel test**

```tsx
// src/components/__tests__/ExportPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ExportPanel } from "../ExportPanel";
import type { Program, Track } from "../../lib/types";

const track: Track = {
  trackId: 1, title: "T", artist: "A", album: "Al", durationMs: 200000,
  artworkUrl: "", url: "https://music.apple.com/us/album/a/1",
  bpm: 170, bpmSource: "deezer", gain: -10,
};

const program: Program = {
  slots: [{ track, phase: "cruise", targetCadence: 175, reason: "r" }],
  unplaced: [], totalMs: 200000, goalMs: 180000, cadence: 175,
};

describe("ExportPanel", () => {
  it("always offers the deep link fallback", async () => {
    render(<ExportPanel program={program} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /open each track/i })).toBeDefined());
  });

  it("explains how to get the one-click option when no extension answers", async () => {
    render(<ExportPanel program={program} />);
    await waitFor(() => expect(screen.getByText(/extension/i)).toBeDefined());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/ExportPanel.test.tsx`
Expected: FAIL, cannot resolve `../ExportPanel`

- [ ] **Step 3: Write `src/components/ExportPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { deeplinkExporter } from "../lib/export/deeplink";
import { extensionExporter } from "../lib/export/extension";
import type { ExportResult } from "../lib/export/types";
import type { Program } from "../lib/types";

export function ExportPanel({ program }: { program: Program }) {
  const [hasExtension, setHasExtension] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [name, setName] = useState("Race playlist");

  useEffect(() => {
    extensionExporter.isAvailable().then(setHasExtension);
  }, []);

  return (
    <section>
      <h2>Send it to Apple Music</h2>

      <label>
        Playlist name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {hasExtension ? (
        <button type="button" onClick={async () => setResult(await extensionExporter.export(program, name))}>
          {extensionExporter.label}
        </button>
      ) : (
        <p>
          Install the Racelist browser extension for one-click creation, or use the list below.
        </p>
      )}

      <button type="button" onClick={async () => setResult(await deeplinkExporter.export(program, name))}>
        {deeplinkExporter.label}
      </button>

      {result && (
        <div>
          <p>{result.message}</p>
          {result.playlistUrl && <a href={result.playlistUrl}>Open the playlist</a>}
          {result.deepLinks && (
            <ol>
              {result.deepLinks.map((href, i) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noreferrer">
                    {i + 1}. {program.slots[i]?.track.artist} — {program.slots[i]?.track.title}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Render `<ExportPanel program={program} />` in `src/app/page.tsx` directly after `<ProgramView />`**

```tsx
{program && <ProgramView program={program} />}
{program && <ExportPanel program={program} />}
```

Add the import at the top:

```tsx
import { ExportPanel } from "../components/ExportPanel";
```

- [ ] **Step 5: Create `public/og.png` at 1200x630**

Use the marketing-studio `/og-assets` skill, or any 1200x630 PNG carrying the product name and the line "Paste a song list. Get a race-paced Apple Music playlist."

- [ ] **Step 6: Run the full suite and build**

Run: `npx vitest run && npx next build`
Expected: all tests PASS, build succeeds

- [ ] **Step 7: Deploy to Vercel**

```bash
npx vercel --prod
```

Then set `NEXT_PUBLIC_SITE_URL` in the Vercel project to the production URL and redeploy so the sitemap, robots and canonical emit absolute production URLs.

- [ ] **Step 8: Register search and analytics in this same session**

Follow `~/.claude/skills/preflight/references/search-registration.md`:
- Google Search Console property, verified by meta tag, sitemap submitted, home URL inspected
- Bing Webmaster Tools imported from Search Console
- Vercel Web Analytics enabled and confirmed receiving hits

- [ ] **Step 9: End-to-end verification with a real Apple Music account**

This is the gate. Do not report the feature complete before it passes.

1. Load the unpacked extension from `extension/`
2. Open <https://music.apple.com> and sign in
3. Open the deployed site, paste this exact list:

```text
1. Survivor - Eye of the Tiger
2. The Killers - Mr. Brightside
3. Foo Fighters - The Pretender
4. Eminem - Lose Yourself
5. Kendrick Lamar - HUMBLE.
```

4. Confirm any rows the resolver flags for review
5. Set a 2:00:00 goal and 175 cadence, build the program
6. Press Create the playlist in Apple Music
7. Open Apple Music and confirm the playlist exists with the tracks in program order

Record the outcome. If the extension path fails, confirm the deep-link fallback renders all five links in order, and report the extension failure rather than hiding it.

- [ ] **Step 10: Commit**

```bash
git add src/components/ExportPanel.tsx src/components/__tests__/ExportPanel.test.tsx src/app/page.tsx public/og.png
git commit -m "feat: add export panel, OG image and ship"
```

---

## Post-implementation: the Reddit reply

Not a code task. After the site is live, draft the r/AI_Agents reply **through the `wes-voice` skill first**, then post. Its substance:

- `Find Music` in Shortcuts reads only the local library, so the top-voted answer quietly fails for any song not already saved
- The popular TXT-to-Apple-Music shortcut has been broken since iOS 18, per its own README
- The confirmation step RocketSeven called for is needed more than the thread realises: 14 of 15 real tracks returned multiple exact-title matches
- iOS 26.4's Playlist Playground already covers the generate-from-a-description case
- What is left, and what the tool does, is sequencing a list you already have to a goal time and cadence

Lead with the correction, not the link. Follow the platform rules in the wes-voice `references/platforms.md` for Reddit.

## Self-review

**Spec coverage:** Resolver Task 2-4. Tempo Task 5-6. Sequencer Task 7. Exporter Task 8, 11. Human surface Task 9, 10, 12. SEO floor Task 1, registration Task 12 step 8. Error handling covered by the failure tests in Tasks 4, 5, 10, 11 and the fallback in Task 12. Testing strategy realised as the per-task TDD cycles. Deliverable 3, the Reddit reply, is the post-implementation section.

**Deviation from the spec:** the spec asks for "highest-energy tracks" in the lift and kick. No keyless energy metric exists, so Task 7 ranks on cadence closeness plus Deezer's `gain` loudness proxy and documents that substitution in the code.

**Type consistency:** `Candidate`, `ScoredCandidate`, `Resolution`, `Track`, `Slot`, `Program`, `Phase`, `BpmSource` are defined once in Task 2 and used unchanged after. `cadenceFit` returns the same shape everywhere it is consumed. The exporter contract is identical across Tasks 8, 11 and 12.
