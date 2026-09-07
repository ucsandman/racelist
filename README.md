# Racelist

Paste a song list from any AI. Get an Apple Music playlist sequenced by tempo to
your running cadence and goal finish time.

It does not pick songs for you. iOS 26.4's Playlist Playground already generates
a playlist from a description. What it cannot do is take a list you already have
and engineer it into a race, which is what this does.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 68 tests
npm run build
```

Node 24. If `npm install` fails with `Cannot read properties of null (reading
'edgesOut')`, the global npm is too old for this dependency graph; the committed
lockfile was generated with `npx npm@latest install` and `npm ci` works fine.

## How it works

**Resolver** turns freeform text into exact Apple Music catalog tracks using the
keyless iTunes Search API, from the browser, so every user spends their own rate
limit. Scoring rejects live cuts, remixes, demos, karaoke and novelty covers.
Anything genuinely ambiguous stops for a human pick rather than guessing.

Measured on 15 real tracks: 13 auto-accepted, 2 sent to review, 0 wrong picks.
A naive top-hit baseline took 3 bad cuts, including a live recording of
Guerrilla Radio and a remix of Blinding Lights.

**Tempo** looks up BPM through `/api/bpm`, which proxies Deezer because Deezer is
CORS-blocked in browsers. BPM belongs to a recording rather than a user, so the
response is cached at the CDN for a year and there is no database. A candidate
is only trusted when its runtime matches and its album is not a live or remix
cut, because scanning for any non-zero BPM otherwise returns the wrong
recording.

**Sequencer** builds warm up, cruise, the wall and kick against your goal time,
matching each track on either bpm or 2x bpm since a runner takes one step per
beat on a fast track and two on a slow one. A track with no trustworthy BPM is
never dropped; it comes back listed as not placed by tempo.

**Exporter** is one interface with two implementations. The browser extension in
`extension/` creates the playlist inside your own signed-in Apple Music tab. The
deep link list always works and needs no extension, no account and no Apple
developer token.

## The extension and your credentials

The extension reads the tokens the Apple Music web player already holds in the
page and calls Apple's API from your tab. Nothing leaves your browser, and this
project's server never sees, stores or proxies those tokens.

This is not a documented integration point. Apple can change or restrict the web
player at any time, which is why the export layer sits behind an interface and
the deep link fallback ships beside it. See `extension/README.md`.

## Layout

```
src/lib/parse.ts       freeform text to artist and title
src/lib/score.ts       candidate scoring and the auto-accept decision
src/lib/itunes.ts      keyless catalog search, paced at 1.1s
src/lib/bpm.ts         Deezer lookup with wrong-recording rejection
src/lib/cadence.ts     bpm to steps per minute, single and double time
src/lib/sequence.ts    the race program
src/lib/export/        exporter interface, deep links, extension bridge
src/app/api/bpm/       the cached BPM proxy
extension/             browser extension, unpacked
docs/superpowers/      design spec and implementation plan
```
