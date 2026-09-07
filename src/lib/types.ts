export type ParsedLine = { raw: string; artist: string; title: string };

export type Candidate = {
  trackId: number;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl: string;
  url: string;
};

export type ScoredCandidate = Candidate & { score: number; penalties: string[] };

export type Resolution = {
  query: ParsedLine;
  status: "auto" | "review" | "missing";
  chosen: Candidate | null;
  candidates: ScoredCandidate[];
};

export type BpmSource = "deezer" | "acousticbrainz";

export type Track = Candidate & {
  bpm: number | null;
  bpmSource: BpmSource | null;
  gain: number | null;
};

export type Phase = "warmup" | "cruise" | "lift" | "kick";

export type Slot = { track: Track; phase: Phase; targetCadence: number; reason: string };

export type Program = {
  slots: Slot[];
  unplaced: Track[];
  totalMs: number;
  goalMs: number;
  cadence: number;
};
