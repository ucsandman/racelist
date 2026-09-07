"use client";

import { useState } from "react";

const DISTANCES = [
  { label: "Half marathon", miles: 13.1 },
  { label: "10K", miles: 6.2 },
  { label: "Marathon", miles: 26.2 },
];

// WIRE-DARK[Rendered by page.tsx later in this task.]
export function RaceSettings({ onBuild }: { onBuild: (goalMs: number, cadence: number) => void }) {
  const [miles, setMiles] = useState(13.1);
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(0);
  const [cadence, setCadence] = useState(175);

  const goalMs = (hours * 60 + minutes) * 60 * 1000;
  const field =
    "rounded border border-black/15 px-2 py-1 dark:border-white/20 dark:bg-transparent";

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Your race</h2>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          Distance
          <select
            value={miles}
            onChange={(e) => setMiles(Number(e.target.value))}
            className={`mt-1 ${field}`}
          >
            {DISTANCES.map((d) => (
              <option key={d.label} value={d.miles}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          Goal time
          <span className="mt-1 flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={9}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className={`w-16 ${field}`}
              aria-label="Goal hours"
            />
            <span aria-hidden>h</span>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className={`w-16 ${field}`}
              aria-label="Goal minutes"
            />
            <span aria-hidden>m</span>
          </span>
        </label>

        <label className="flex flex-col text-sm">
          Cadence (steps per minute)
          <input
            type="number"
            min={140}
            max={200}
            value={cadence}
            onChange={(e) => setCadence(Number(e.target.value))}
            className={`mt-1 w-24 ${field}`}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => onBuild(goalMs, cadence)}
        disabled={goalMs === 0}
        className="mt-4 rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        Build the program
      </button>
    </section>
  );
}
