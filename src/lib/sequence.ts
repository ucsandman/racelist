import { cadenceFit } from "./cadence";
import type { Phase, Program, Slot, Track } from "./types";

export const PHASES: { phase: Phase; start: number; end: number; cadenceDelta: number }[] = [
  { phase: "warmup", start: 0, end: 0.08, cadenceDelta: -10 },
  { phase: "cruise", start: 0.08, end: 0.7, cadenceDelta: 0 },
  { phase: "lift", start: 0.7, end: 0.92, cadenceDelta: 3 },
  { phase: "kick", start: 0.92, end: 1, cadenceDelta: 5 },
];

const BUFFER = 1.08;

const PHASE_REASON: Record<Phase, string> = {
  warmup: "easing in, cadence below race pace",
  cruise: "settled at race cadence",
  lift: "the wall is around here, cadence lifted",
  kick: "final push, fastest cadence",
};

/**
 * There is no keyless energy metric for a track. For the lift and kick we rank on
 * two signals we can actually source: closeness to the elevated target cadence,
 * and Deezer's gain field, which is a loudness proxy, not a true energy score.
 */
function rankForPhase(tracks: Track[], targetCadence: number, favourLoud: boolean): Track[] {
  return [...tracks].sort((a, b) => {
    const fa = cadenceFit(a.bpm as number, targetCadence);
    const fb = cadenceFit(b.bpm as number, targetCadence);
    if (fa.distance !== fb.distance) return fa.distance - fb.distance;
    if (!favourLoud) return 0;
    return (b.gain ?? -99) - (a.gain ?? -99);
  });
}

// WIRE-DARK[Engine built bottom-up per the plan; page.tsx consumes buildProgram in Task 10.]
export function buildProgram(tracks: Track[], goalMs: number, cadence: number): Program {
  const withBpm = tracks.filter((t): t is Track & { bpm: number } => typeof t.bpm === "number");
  const unplaced = tracks.filter((t) => typeof t.bpm !== "number");

  if (withBpm.length === 0) {
    return { slots: [], unplaced: tracks.length ? unplaced : [], totalMs: 0, goalMs, cadence };
  }

  const budget = goalMs * BUFFER;
  const pool = new Set<Track>(withBpm);
  const slots: Slot[] = [];
  let totalMs = 0;

  for (const spec of PHASES) {
    const targetCadence = cadence + spec.cadenceDelta;
    const phaseBudget = (spec.end - spec.start) * budget;
    const favourLoud = spec.phase === "lift" || spec.phase === "kick";
    let phaseMs = 0;

    while (phaseMs < phaseBudget && pool.size > 0) {
      const [best] = rankForPhase([...pool], targetCadence, favourLoud);
      if (!best) break;
      pool.delete(best);
      const fit = cadenceFit(best.bpm as number, targetCadence);
      slots.push({
        track: best,
        phase: spec.phase,
        targetCadence,
        reason: `${PHASE_REASON[spec.phase]} — ${Math.round(best.bpm as number)} bpm${
          fit.multiplier === 2 ? " at double time" : ""
        }, target ${targetCadence} spm`,
      });
      phaseMs += best.durationMs;
      totalMs += best.durationMs;
    }
  }

  // Anything the phases could not absorb still belongs to the runner.
  return { slots, unplaced: [...unplaced, ...pool], totalMs, goalMs, cadence };
}
