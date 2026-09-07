"use client";

import { useEffect, useState } from "react";
import { deeplinkExporter } from "../lib/export/deeplink";
import { extensionExporter } from "../lib/export/extension";
import type { ExportResult } from "../lib/export/types";
import type { Program } from "../lib/types";

// WIRE-DARK[Rendered by page.tsx in this same task.]
export function ExportPanel({ program }: { program: Program }) {
  const [hasExtension, setHasExtension] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Race playlist");

  useEffect(() => {
    extensionExporter.isAvailable().then(setHasExtension);
  }, []);

  async function run(fn: () => Promise<ExportResult>) {
    setBusy(true);
    setResult(await fn());
    setBusy(false);
  }

  const button =
    "rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black";
  const ghost =
    "rounded-lg border border-black/20 px-4 py-2 font-medium disabled:opacity-40 dark:border-white/25";

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Send it to Apple Music</h2>

      <label className="mt-3 flex flex-col text-sm">
        Playlist name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-72 rounded border border-black/15 px-2 py-1 dark:border-white/20 dark:bg-transparent"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasExtension ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => extensionExporter.export(program, name))}
            className={button}
          >
            {extensionExporter.label}
          </button>
        ) : (
          <p className="text-sm opacity-70">
            Install the Racelist browser extension for one-click creation, or use the list below.
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => deeplinkExporter.export(program, name))}
          className={ghost}
        >
          {deeplinkExporter.label}
        </button>
      </div>

      {result && (
        <div className="mt-4">
          <p className="text-sm">{result.message}</p>
          {result.playlistUrl && (
            <a className="text-sm underline" href={result.playlistUrl}>
              Open the playlist
            </a>
          )}
          {result.deepLinks && (
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {result.deepLinks.map((href, i) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noreferrer" className="underline">
                    {i + 1}. {program.slots[i]?.track.artist} — {program.slots[i]?.track.title}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
