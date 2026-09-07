"use client";

import { useState } from "react";
import { PasteBox } from "../components/PasteBox";
import { ReviewGrid } from "../components/ReviewGrid";
import { RaceSettings } from "../components/RaceSettings";
import { ProgramView } from "../components/ProgramView";
import { ExportPanel } from "../components/ExportPanel";
import { enrichWithBpm } from "../lib/enrich";
import { buildProgram } from "../lib/sequence";
import type { Candidate, Program, Resolution } from "../lib/types";

// WIRE-DARK[Next.js App Router convention: the framework renders app/page.tsx at /, no import exists. Proven by next build emitting / in the route table.]
export default function Home() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [building, setBuilding] = useState(false);

  function choose(index: number, candidate: Candidate) {
    setResolutions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, chosen: candidate, status: "auto" } : r)),
    );
  }

  async function build(goalMs: number, cadence: number) {
    setBuilding(true);
    const chosen = resolutions.map((r) => r.chosen).filter((c): c is Candidate => c !== null);
    const tracks = await enrichWithBpm(chosen);
    setProgram(buildProgram(tracks, goalMs, cadence));
    setBuilding(false);
  }

  const ready = resolutions.length > 0 && resolutions.every((r) => r.status !== "review");

  return (
    <main>
      <h1 className="text-2xl font-semibold">Racelist</h1>
      <p className="opacity-70">Paste a song list. Get a race-paced Apple Music playlist.</p>

      <PasteBox onResolved={setResolutions} />
      {resolutions.length > 0 && <ReviewGrid resolutions={resolutions} onChoose={choose} />}
      {ready && <RaceSettings onBuild={build} />}
      {building && <p className="mt-4 text-sm opacity-70">Looking up tempo</p>}
      {program && <ProgramView program={program} />}
      {program && <ExportPanel program={program} />}
    </main>
  );
}
