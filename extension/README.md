# Racelist for Apple Music

Creates an Apple Music playlist from a Racelist program using the Apple Music
session already signed in to your browser.

## What it does with your credentials

Nothing leaves your browser. The tokens the Apple Music web player already holds
are read inside your own Apple Music tab and used to call Apple's API from that
tab. They are never stored, logged, or sent to a Racelist server.

## How the pieces fit

The Racelist page and Apple Music are different tabs on different origins, so
the page cannot talk to Apple Music directly. Three parts bridge that gap:

- `bridge.js` runs on the Racelist page and relays its messages to the worker.
  It is the only part that can see the page, and it never touches a token.
- `background.js` finds or opens an Apple Music tab and injects the call.
- The injected function runs in that tab's MAIN world, the only place
  `window.MusicKit` exists, reads the tokens and posts the playlist.

## Install

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Choose Load unpacked and select this `extension` folder
4. Open <https://music.apple.com> and sign in
5. Go back to Racelist and press Create the playlist in Apple Music

The extension recognises Racelist on `localhost` and on
`https://racelist.vercel.app`. If you deploy it somewhere else, add that origin
to `content_scripts.matches` in `manifest.json`.

## Limitations

The Apple Music web player is not a documented integration point. Apple can
change or restrict it at any time. If that happens the extension reports the
failure and Racelist falls back to the deep link list, which always works.
