"use client";

import { useState } from "react";
import { parseList } from "../lib/parse";
import { resolveAll } from "../lib/itunes";
import type { Resolution } from "../lib/types";

// WIRE-DARK[Rendered by page.tsx in Task 10 once race settings land.]
export function PasteBox({ onResolved }: { onResolved: (r: Resolution[]) => void }) {
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const lineCount = parseList(text).length;

  async function run() {
    const lines = parseList(text);
    if (lines.length === 0) return;
    setProgress({ done: 0, total: lines.length });
    const results = await resolveAll(lines, {
      onProgress: (done, total) => setProgress({ done, total }),
    });
    setProgress(null);
    onResolved(results);
  }

  return (
    <div className="mt-6">
      <label htmlFor="songs" className="block text-sm font-medium">
        Your song list
      </label>
      <textarea
        id="songs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Paste the list from ChatGPT or Claude\n\n1. Survivor - Eye of the Tiger\n2. The Killers - Mr. Brightside"}
        rows={12}
        className="mt-2 w-full rounded-lg border border-black/15 p-3 font-mono text-sm dark:border-white/20 dark:bg-transparent"
      />
      <p className="mt-1 text-sm opacity-70">
        {lineCount} songs detected.
        {lineCount > 0 && ` Matching takes about ${Math.ceil(lineCount * 1.1)} seconds.`}
      </p>
      <button
        type="button"
        onClick={run}
        disabled={progress !== null || lineCount === 0}
        className="mt-3 rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {progress ? `Matching ${progress.done} of ${progress.total}` : "Find these on Apple Music"}
      </button>
    </div>
  );
}
