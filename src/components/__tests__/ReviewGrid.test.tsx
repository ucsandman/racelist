import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewGrid } from "../ReviewGrid";
import type { Resolution } from "../../lib/types";

const cand = (id: number, title: string, album: string, penalties: string[] = []) => ({
  trackId: id,
  title,
  artist: "RATM",
  album,
  durationMs: 206000,
  artworkUrl: "",
  url: "",
  score: 60,
  penalties,
});

const resolutions: Resolution[] = [
  {
    query: { raw: "", artist: "RATM", title: "Guerrilla Radio" },
    status: "review",
    chosen: null,
    candidates: [
      cand(1, "Guerrilla Radio (Live In Mexico City)", "Live At The Olympic", ["live"]),
      cand(2, "Guerrilla Radio", "The Battle Of Los Angeles"),
    ],
  },
  {
    query: { raw: "", artist: "Nobody", title: "Nothing" },
    status: "missing",
    chosen: null,
    candidates: [],
  },
];

describe("ReviewGrid", () => {
  it("flags rows that need a human decision", () => {
    render(<ReviewGrid resolutions={resolutions} onChoose={vi.fn()} />);
    expect(screen.getByText(/needs your pick/i)).toBeDefined();
  });

  it("shows a live badge on a live candidate", () => {
    render(<ReviewGrid resolutions={resolutions} onChoose={vi.fn()} />);
    expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
  });

  it("reports a track that could not be found", () => {
    render(<ReviewGrid resolutions={resolutions} onChoose={vi.fn()} />);
    expect(screen.getByText(/not found/i)).toBeDefined();
  });

  it("calls onChoose with the index and the picked candidate", () => {
    const onChoose = vi.fn();
    render(<ReviewGrid resolutions={resolutions} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: /The Battle Of Los Angeles/i }));
    expect(onChoose).toHaveBeenCalledWith(0, expect.objectContaining({ trackId: 2 }));
  });
});
