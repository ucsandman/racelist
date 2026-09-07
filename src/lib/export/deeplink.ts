import type { Program } from "../types";
import type { Exporter, ExportResult } from "./types";

/**
 * The fallback that always works. No extension, no account, no Apple developer
 * token. Apple has broken the automated paths twice, so this one ships beside
 * whatever automation is current.
 */
// WIRE-DARK[Engine built bottom-up per the plan; ExportPanel consumes this in Task 12.]
export const deeplinkExporter: Exporter = {
  id: "deeplink",
  label: "Open each track in Apple Music",
  async isAvailable() {
    return true;
  },
  async export(program: Program): Promise<ExportResult> {
    const deepLinks = program.slots.map((s) => s.track.url).filter(Boolean);
    return {
      ok: true,
      message: `${deepLinks.length} tracks in order. Open each one and press add.`,
      deepLinks,
    };
  },
};
