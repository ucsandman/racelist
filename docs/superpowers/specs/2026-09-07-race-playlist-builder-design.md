# Race Playlist Builder — Design

Date: 2026-09-07
Status: approved for planning
Working name: Racelist (provisional; final name chosen at build time)

## Problem

Someone asks ChatGPT or Claude for a half-marathon playlist, gets thirty song
titles, and then has to hand-search each one in Apple Music. The ask is to
remove the copy-pasting.

The obvious answers do not work. Shortcuts cannot see the Apple Music catalog —
its Find Music action reads only the local library, and the iTunes actions the
popular community shortcut relied on were removed in iOS 18. The Apple Music API
solves it in one call but requires a paid Apple Developer Program membership.

The interesting part is that removing the copy-pasting is not the valuable part.
iOS 26.4 already ships Playlist Playground, which generates a playlist from a
description. What it cannot do is take a list you already have and engineer it
into a race: sequenced by tempo, fitted to a goal finish time, with the hard
tracks placed where the race gets hard.

## What is proven

Every load-bearing mechanism was probed live on 2026-09-07, not assumed.

**Track resolution is free.** The iTunes Search API is keyless and returns Apple
Music catalog track IDs, album, duration, artwork and music.apple.com URLs.
Measured: 15 of 15 realistic run-playlist tracks resolved.

**Ambiguity is the real problem, and it is near-universal.** 14 of those 15
returned multiple exact-title candidates — remaster against original against
live against greatest-hits against radio edit. Taking the top hit selected
Guerrilla Radio (Live In Mexico City) and Blinding Lights (Remix). Any design
that silently auto-picks is wrong most of the time.

**BPM is free but has holes.** Deezer's keyless API returned usable BPM for 11 of
15; where present it is accurate (Blinding Lights 170.84, Guerrilla Radio 103.6,
Stronger 103.88 all match reality). Scanning further Deezer candidates recovered
all 4 misses — but from the wrong recordings: Mr. Brightside's 144.56 came off a
Royal Albert Hall live album, Don't Stop Me Now returned 154.85 and also 93.8
from a We Will Rock You cast recording. Accepting the first non-zero value would
sequence a race off the wrong performance. AcousticBrainz still answers keylessly
(152.47 for Mr. Brightside) but returned a 504 on the first call.

**The keyless export path works.** On music.apple.com, window.MusicKit v3.2636.0
is exposed with a working getInstance(). The returned instance carries a readable
268-character developer token. Signed out, isAuthorized is false and no user
token is present; in a signed-in session both are available, which is enough to
call POST /v1/me/library/playlists with no developer account.

## Constraints and posture

The developer token belongs to Apple's web player, not to us. The decision taken
is to ship this as an open-source browser extension that runs inside the user's
own signed-in Apple Music tab.

**Hard rule: tokens never leave the user's browser. Our server never reads,
stores, proxies or transmits Apple's developer token or any music user token.**

This keeps the posture at "a user automating their own logged-in session" rather
than "a service harvesting Apple's credentials". It is more work than proxying
and the rule holds anyway. Apple can rotate or scope the token at any time, so
the export layer is designed to be replaceable and a manual fallback always
ships alongside it.

## Non-goals

- Generating song suggestions. The user brings a list from their own AI. Apple
  already ships Playlist Playground for the generate-from-vibe case.
- Supporting Spotify or other services in v1.
- Any server-side account, login or stored user data.
- Paying for an Apple Developer Program membership.

## Architecture

Four units. The fourth is the unstable one and is isolated behind an interface
for exactly that reason.

### 1. Resolver

Freeform AI output in, confirmed Apple Music catalog tracks out.

Parsing accepts what models actually emit: numbered lists, "Artist - Title",
"Title by Artist", markdown bullets, tables, and surrounding prose.

Each line queries iTunes Search for five candidates, then scores:

    +40  exact normalized title match (punctuation, feat., parentheticals stripped)
    +25  artist match, normalized, tolerant of feat. collaborations
    +10  original studio album or a single/EP matching the title
     +5  version matches the user's explicit/clean preference
    -10  compilation album (Greatest Hits, Essential, Very Best, Collection)
    -25  Remix, Rework, Edit in title, unless the query asked for it
    -30  Live, Concert, Unplugged, MTV in title or album
    -40  Karaoke, Tribute, Cover Version, Made Popular By, In the Style Of

Auto-accept requires top score >= 55 and a margin over second place >= 15.
Everything else goes to human review. This is the direct answer to the measured
14-of-15 ambiguity rate: the scoring exists to get that number down, and the
review queue catches what it cannot.

Output per track: catalog ID, title, artist, album, duration, artwork URL,
music.apple.com URL, confidence, and the candidates that lost.

### 2. Tempo

BPM for each resolved track.

Deezer first. On a zero, scan further Deezer candidates but accept one only if
its duration is within 5 percent or 8 seconds of the resolved Apple Music track
AND its album does not score as live or remix under the resolver's own scoring.
One matching engine, used twice. AcousticBrainz via MusicBrainz is a third-string
fallback and never a dependency.

Cadence matching, for target cadence C and tolerance tol:

    matches(bpm, C) = |bpm - C| <= tol  OR  |2*bpm - C| <= tol

The doubling arm is what lets an 85 BPM track work at 170 steps per minute. A
track that matches on neither arm is not a cadence fit, and the tool says so
rather than hiding it — Eye of the Tiger at 108.8 is honestly a poor fit for a
175 spm runner, and that is useful information.

Tracks with no trustworthy BPM stay in the playlist as unplaced. Never silently
dropped.

### 3. Sequencer

Goal finish time and target cadence in, an ordered program out. For a half
marathon at goal time T:

    Warmup   0 to 8% of T      cadence ramps from C-10 to C
    Cruise   8% to 70% of T    cadence C
    Lift     70% to 92% of T   cadence C+3, highest-energy tracks — this is the wall
    Kick     final 8% of T     cadence C+5, the biggest tracks

Total playlist duration must be at least 1.08 * T so a slow day does not run out
of music. Every slot carries a one-line reason for why that track sits there.

### 4. Exporter

A single interface: (orderedTracks) => deliverable.

Primary implementation is the browser extension. It runs in the user's Apple
Music tab, reads MusicKit.getInstance(), creates the playlist and adds the
tracks in order. If MusicKit is absent, or isAuthorized is false, or any call
fails, it degrades to the fallback with a plain explanation rather than an error.

Fallback implementation is an ordered deep-link list the user taps through. It
always works, needs no extension and no account, and is fully verifiable without
an Apple Music subscription.

## Human surface

A web page, not a CLI. Paste box, then a review grid showing artwork, duration,
a Live badge and the losing candidates for anything ambiguous, then race
settings, then the built program with its BPM curve, then one export button.

Per the workspace standard this is a public web surface, so the SEO floor ships
in the same change: sitemap, robots.txt, llms.txt, real title and meta
description per indexable page, canonical, OG image, noindex on any non-indexable
route. Title wording comes from a treg keyword lookup, not from guesses. Search
Console, Bing import and Vercel Web Analytics are registered in the session that
deploys it.

## Error handling

- iTunes Search rate limit is roughly 20 requests per minute. The client queues
  at 1.1 second spacing, shows progress, and is resumable. A 30-song list takes
  about 35 seconds and the UI says so up front.
- Deezer failure or a rejected candidate degrades that track to unplaced.
- Zero iTunes results renders a not-found row with a manual search box.
- Extension unavailable or unauthorized falls back to deep links with an
  explanation, never a stack trace.

## Testing

- Resolver scoring runs against a fixture set built from the 15 measured tracks
  plus the two known traps. Asserts the studio Guerrilla Radio beats the Mexico
  City live cut and the original Blinding Lights beats the remix.
- Tempo asserts the Born to Run 104.4 live candidate is rejected on duration and
  148.7 is accepted, and that the Don't Stop Me Now 93.8 cast recording is
  rejected.
- Sequencer is property-tested: output duration >= 1.08 * T, phases in order,
  cadence non-decreasing across phase boundaries.
- Exporter is contract-tested against a fake MusicKit. The real path is verified
  end to end in a browser with the operator signed in, before it is called done.

## Deliverables

1. The web app, deployed, with the SEO floor and analytics registered.
2. The browser extension, open source, tokens client-side only.
3. A reply to the r/AI_Agents thread, drafted through the wes-voice skill. Its
   substance is the correction the thread needs: Find Music cannot see the
   catalog, the popular shortcut has been broken since iOS 18, and here is what
   works instead.

## Risks

- Apple rotates or scopes the web-player developer token and the extension
  breaks. Mitigated by the exporter interface and the always-available fallback.
- Deezer BPM coverage drops or the API closes. Mitigated by AcousticBrainz and by
  degrading to unplaced rather than failing.
- Apple extends Playlist Playground to accept a supplied tracklist, which would
  erase the import half of the value. The sequencing half survives that.
