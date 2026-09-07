import type { ParsedLine } from "./types";

const SEPARATORS = [" - ", " – ", " — ", " -- ", ": "];
const BY_SPLIT = /\s+by\s+/i;

function stripDecoration(line: string): string {
  return line
    .replace(/^\s*[-*•>]+\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/[_*`]/g, "")
    .trim();
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s|:-]+\|?$/.test(line) && line.includes("-");
}

function fromTableRow(line: string): ParsedLine | null {
  if (!line.startsWith("|")) return null;
  const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
  if (cells.length < 2) return null;
  if (/^artist$/i.test(cells[0]) || /^title$/i.test(cells[1])) return null;
  return { raw: line, artist: cells[0], title: cells[1] };
}

// WIRE-DARK[Engine built bottom-up per the plan; PasteBox consumes parseList in Task 9.]
export function parseList(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (!raw || isTableSeparator(raw)) continue;

    const table = fromTableRow(raw);
    if (table) {
      out.push(table);
      continue;
    }

    const line = stripDecoration(raw);
    if (!line) continue;

    const sep = SEPARATORS.find((s) => line.includes(s));
    if (sep) {
      const idx = line.indexOf(sep);
      const artist = line.slice(0, idx).trim();
      const title = line.slice(idx + sep.length).trim();
      if (artist && title) out.push({ raw, artist, title });
      continue;
    }

    if (BY_SPLIT.test(line)) {
      const [title, artist] = line.split(BY_SPLIT);
      if (title?.trim() && artist?.trim()) {
        out.push({ raw, artist: artist.trim(), title: title.trim() });
      }
      continue;
    }
    // No separator: prose. Dropped on purpose.
  }

  return out;
}
