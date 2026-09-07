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

The Apple Music web player is not a documented integration point. Apple can
change or restrict it at any time. If that happens the extension reports the
failure and Racelist falls back to the deep link list, which always works.
