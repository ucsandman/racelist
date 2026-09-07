"use client";

import type { Candidate, Resolution } from "../lib/types";

function mmss(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// WIRE-DARK[Rendered by page.tsx in Task 10 once race settings land.]
export function ReviewGrid({
  resolutions,
  onChoose,
}: {
  resolutions: Resolution[];
  onChoose: (index: number, candidate: Candidate) => void;
}) {
  const needing = resolutions.filter((r) => r.status === "review").length;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Matches</h2>
      <p className="text-sm opacity-70">
        {needing === 0
          ? "Everything matched cleanly."
          : `${needing} of ${resolutions.length} need your pick. The rest matched cleanly.`}
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {resolutions.map((r, i) => (
          <li
            key={`${r.query.artist}-${r.query.title}-${i}`}
            className="rounded-lg border border-black/10 p-3 dark:border-white/15"
          >
            <div className="text-sm opacity-60">
              {r.query.artist} — {r.query.title}
            </div>

            {r.status === "missing" && (
              <p className="mt-1 text-sm font-medium">Not found on Apple Music</p>
            )}

            {r.status === "auto" && r.chosen && (
              <div className="mt-1 flex items-center gap-2">
                {r.chosen.artworkUrl && (
                  <img src={r.chosen.artworkUrl} alt="" width={40} height={40} className="rounded" />
                )}
                <div>
                  <div className="font-medium">{r.chosen.title}</div>
                  <div className="text-xs opacity-60">
                    {r.chosen.album} · {mmss(r.chosen.durationMs)}
                  </div>
                </div>
              </div>
            )}

            {r.status === "review" && (
              <div className="mt-2">
                <p className="text-sm font-medium">Needs your pick</p>
                <div className="mt-2 flex flex-col gap-2">
                  {r.candidates.map((c) => (
                    <button
                      key={c.trackId}
                      type="button"
                      onClick={() => onChoose(i, c)}
                      className="flex items-center gap-2 rounded border border-black/10 p-2 text-left hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                    >
                      {c.artworkUrl && (
                        <img src={c.artworkUrl} alt="" width={32} height={32} className="rounded" />
                      )}
                      <span>
                        <span className="block text-sm">{c.title}</span>
                        <span className="block text-xs opacity-60">
                          {c.album} · {mmss(c.durationMs)}
                        </span>
                      </span>
                      {c.penalties.map((p) => (
                        <span
                          key={p}
                          className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-xs uppercase tracking-wide"
                        >
                          {p}
                        </span>
                      ))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
