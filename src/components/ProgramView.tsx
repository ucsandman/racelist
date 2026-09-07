"use client";

import type { Phase, Program } from "../lib/types";

function mmss(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

const PHASE_LABEL: Record<Phase, string> = {
  warmup: "Warm up",
  cruise: "Cruise",
  lift: "The wall",
  kick: "Kick",
};

// WIRE-DARK[Rendered by page.tsx later in this task.]
export function ProgramView({ program }: { program: Program }) {
  const covers = program.totalMs >= program.goalMs;
  const bpms = program.slots.map((s) => s.track.bpm ?? 0).filter(Boolean);
  const maxBpm = Math.max(...bpms, 1);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Your program</h2>
      <p className="text-sm opacity-70">
        {mmss(program.totalMs)} of music for a {mmss(program.goalMs)} goal.{" "}
        {covers ? "Covers the whole race." : "Shorter than your goal time. Add more songs."}
      </p>

      {bpms.length > 0 && (
        <div
          className="mt-4 flex h-16 items-end gap-0.5"
          role="img"
          aria-label={`Tempo curve across ${program.slots.length} tracks`}
        >
          {program.slots.map((s, i) => (
            <div
              key={`bar-${s.track.trackId}-${i}`}
              title={`${s.track.title} — ${Math.round(s.track.bpm ?? 0)} bpm`}
              style={{ height: `${((s.track.bpm ?? 0) / maxBpm) * 100}%` }}
              className="flex-1 rounded-t bg-black/25 dark:bg-white/30"
            />
          ))}
        </div>
      )}

      <ol className="mt-4 flex flex-col gap-2">
        {program.slots.map((s, i) => (
          <li
            key={`${s.track.trackId}-${i}`}
            className="rounded-lg border border-black/10 p-3 dark:border-white/15"
          >
            <div className="flex items-baseline gap-2">
              <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs uppercase tracking-wide dark:bg-white/10">
                {PHASE_LABEL[s.phase]}
              </span>
              <strong className="text-sm">
                {s.track.artist} — {s.track.title}
              </strong>
              <span className="ml-auto text-xs opacity-60">{mmss(s.track.durationMs)}</span>
            </div>
            <p className="mt-1 text-xs opacity-60">{s.reason}</p>
          </li>
        ))}
      </ol>

      {program.unplaced.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium">Not placed by tempo</h3>
          <p className="text-sm opacity-70">
            These stay in your list. We could not find trustworthy BPM for them.
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {program.unplaced.map((t) => (
              <li key={t.trackId}>
                {t.artist} — {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
