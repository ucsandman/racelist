// The only piece that can reach both sides. The Racelist page talks to
// bridge.js, bridge.js talks to here, and here injects into the Apple Music
// tab's MAIN world, which is the only place window.MusicKit exists.
//
// Tokens are read inside that tab and used from that tab. Nothing is stored,
// logged, or sent anywhere outside the browser.

const APPLE_URL = "https://music.apple.com/";
const APPLE_MATCH = "https://music.apple.com/*";

async function findAppleTab() {
  const tabs = await chrome.tabs.query({ url: APPLE_MATCH });
  return tabs[0] ?? null;
}

/**
 * Injected into the Apple Music tab in the MAIN world. Verified target:
 * window.MusicKit v3.2636.0 exposes getInstance(), and a signed-in instance
 * carries both the developer token and the music user token.
 */
async function createInPage(playlistName, trackIds) {
  const mk = window.MusicKit && window.MusicKit.getInstance();
  if (!mk) return { type: "error", message: "Reload the Apple Music tab and try again." };
  if (!mk.isAuthorized) return { type: "error", message: "Sign in to Apple Music in that tab first." };

  try {
    const res = await fetch("https://api.music.apple.com/v1/me/library/playlists", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mk.developerToken}`,
        "Music-User-Token": mk.musicUserToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attributes: { name: playlistName, description: "Built with Racelist" },
        relationships: {
          tracks: { data: trackIds.map((id) => ({ id: String(id), type: "songs" })) },
        },
      }),
    });

    if (!res.ok) {
      return { type: "error", message: `Apple Music returned ${res.status}.` };
    }

    const body = await res.json();
    const id = body && body.data && body.data[0] && body.data[0].id;
    return {
      type: "created",
      playlistUrl: id ? `https://music.apple.com/library/playlist/${id}` : undefined,
    };
  } catch (err) {
    return { type: "error", message: String(err && err.message ? err.message : err) };
  }
}

async function handle(message) {
  if (message.type === "ping") return { type: "pong" };

  let tab = await findAppleTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: APPLE_URL, active: false });
    // Give the web player time to boot MusicKit before injecting.
    await new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 15000);
    });
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: createInPage,
    args: [message.playlistName, message.trackIds],
  });

  return result?.result ?? { type: "error", message: "The Apple Music tab did not respond." };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ type: "error", message: String(err) }));
  return true; // keep the channel open for the async reply
});
