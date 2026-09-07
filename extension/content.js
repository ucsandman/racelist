// Runs in the MAIN world on music.apple.com so it can read the page's own
// MusicKit instance. Verified present: window.MusicKit v3.2636.0 exposes
// getInstance(), and a signed-in instance carries both the developer token and
// the music user token. Tokens are used here and never sent anywhere.
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
      const id = body && body.data && body.data[0] && body.data[0].id;
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
