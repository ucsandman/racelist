import type { Program } from "../types";

export type ExportResult = {
  ok: boolean;
  message: string;
  deepLinks?: string[];
  playlistUrl?: string;
};

export type Exporter = {
  id: string;
  label: string;
  isAvailable(): Promise<boolean>;
  export(program: Program, playlistName: string): Promise<ExportResult>;
};
