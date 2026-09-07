// Runs on the Racelist page in the ISOLATED world, which is the only world with
// access to chrome.runtime. The page itself cannot reach the Apple Music tab,
// so this relays the page's window messages to the background worker and posts
// the answer back.
(function () {
  "use strict";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "racelist") return;
    if (data.type !== "ping" && data.type !== "create") return;

    chrome.runtime.sendMessage(
      { type: data.type, playlistName: data.playlistName, trackIds: data.trackIds },
      (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage(
            {
              source: "racelist-ext",
              type: "error",
              message: chrome.runtime.lastError.message || "The extension could not respond.",
            },
            "*",
          );
          return;
        }
        window.postMessage({ source: "racelist-ext", ...response }, "*");
      },
    );
  });
})();
