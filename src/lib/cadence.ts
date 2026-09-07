export type CadenceFit = { fits: boolean; multiplier: 1 | 2; effective: number; distance: number };

/**
 * A runner takes one step per beat on a fast track, or two steps per beat on a
 * slow one. So a track fits a target cadence if either bpm or 2*bpm lands near it.
 */
// WIRE-DARK[Engine built bottom-up per the plan; buildProgram consumes cadenceFit in Task 7.]
export function cadenceFit(bpm: number, target: number, tolerance = 8): CadenceFit {
  const direct = Math.abs(bpm - target);
  const doubled = Math.abs(bpm * 2 - target);
  const useDouble = doubled < direct;
  const multiplier: 1 | 2 = useDouble ? 2 : 1;
  const distance = useDouble ? doubled : direct;
  return { fits: distance <= tolerance, multiplier, effective: bpm * multiplier, distance };
}
