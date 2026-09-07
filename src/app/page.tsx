"use client";

import { useState } from "react";
import { PasteBox } from "../components/PasteBox";
import { ReviewGrid } from "../components/ReviewGrid";
import type { Candidate, Resolution } from "../lib/types";

// WIRE-DARK[Next.js App Router convention: the framework renders app/page.tsx at /, no import exists. Proven by next build emitting / in the route table.]
export default function Home() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);

  function choose(index: number, candidate: Candidate) {
    setResolutions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, chosen: candidate, status: "auto" } : r)),
    );
  }

  return (
    <main>
      <h1 className="text-2xl font-semibold">Racelist</h1>
      <p className="opacity-70">Paste a song list. Get a race-paced Apple Music playlist.</p>
      <PasteBox onResolved={setResolutions} />
      {resolutions.length > 0 && <ReviewGrid resolutions={resolutions} onChoose={choose} />}
    </main>
  );
}
