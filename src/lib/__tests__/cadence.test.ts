import { describe, it, expect } from "vitest";
import { cadenceFit } from "../cadence";

describe("cadenceFit", () => {
  it("matches directly when bpm is near the target", () => {
    const f = cadenceFit(170.84, 175);
    expect(f.fits).toBe(true);
    expect(f.multiplier).toBe(1);
  });

  it("matches at double time for a slow track", () => {
    const f = cadenceFit(87, 175);
    expect(f.fits).toBe(true);
    expect(f.multiplier).toBe(2);
    expect(f.effective).toBe(174);
  });

  it("reports no fit for a track that matches on neither arm", () => {
    // Eye of the Tiger at 108.8 is honestly a poor fit for a 175 spm runner.
    expect(cadenceFit(108.8, 175).fits).toBe(false);
  });

  it("picks the closer arm when both are within tolerance", () => {
    const f = cadenceFit(90, 178, 20);
    expect(f.multiplier).toBe(2);
    expect(f.effective).toBe(180);
  });

  it("reports distance so callers can rank near-misses", () => {
    expect(cadenceFit(170, 175).distance).toBe(5);
  });
});
