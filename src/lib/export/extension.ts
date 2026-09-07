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

/**
 * Talks to the browser extension over postMessage. The extension does the
 * privileged work inside the user's own Apple Music tab; no token ever reaches
 * this code or our server. Every failure degrades to the deep link fallback.
 */
// WIRE-DARK[Engine built bottom-up per the plan; ExportPanel consumes this in Task 12.]
export const extensionExporter: Exporter & {
  isAvailable(timeoutMs?: number): Promise<boolean>;
  export(program: Program, playlistName: string, timeoutMs?: number): Promise<ExportResult>;
} = {
  id: "extension",
  label: "Create the playlist in Apple Music",

  async isAvailable(timeoutMs: number = 600) {
    const reply = await ask({ type: "ping" }, timeoutMs);
    return reply?.type === "pong";
  },

  async export(program: Program, playlistName: string, timeoutMs: number = 30000) {
    const trackIds = program.slots.map((s) => String(s.track.trackId));
    const reply = await ask({ type: "create", playlistName, trackIds }, timeoutMs);

    if (!reply) {
      return {
        ok: false,
        message: "The extension is not responding. Use the deep link list instead.",
      };
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
