import { describe, it, expect } from "vitest";
import { normalize, rank, decide } from "../score";
import type { Candidate, ParsedLine } from "../types";

const c = (over: Partial<Candidate>): Candidate => ({
  trackId: 1,
  title: "Song",
  artist: "Artist",
  album: "Album",
  durationMs: 200000,
  artworkUrl: "",
  url: "",
  ...over,
});

const q = (artist: string, title: string): ParsedLine => ({ raw: "", artist, title });

describe("normalize", () => {
  it("strips punctuation, case and parentheticals", () => {
    expect(normalize("HUMBLE.")).toBe("humble");
    expect(normalize("Titanium (feat. Sia)")).toBe("titanium");
    expect(normalize("Don't Stop Me Now")).toBe("dont stop me now");
  });
});

describe("rank", () => {
  it("puts the studio cut above the live cut (measured trap)", () => {
    const ranked = rank(
      [
        c({
          trackId: 1,
          title: "Guerrilla Radio (Live In Mexico City, MX, 10/28/99)",
          artist: "Rage Against the Machine",
          album: "Live At The Grand Olympic Auditorium",
        }),
        c({
          trackId: 2,
          title: "Guerrilla Radio",
          artist: "Rage Against the Machine",
          album: "The Battle Of Los Angeles",
        }),
      ],
      q("Rage Against the Machine", "Guerrilla Radio"),
    );
    expect(ranked[0].trackId).toBe(2);
  });

  it("puts the original above the remix (measured trap)", () => {
    const ranked = rank(
      [
        c({
          trackId: 1,
          title: "Blinding Lights (Remix)",
          artist: "The Weeknd",
          album: "Blinding Lights (Remix) - Single",
        }),
        c({ trackId: 2, title: "Blinding Lights", artist: "The Weeknd", album: "After Hours" }),
      ],
      q("The Weeknd", "Blinding Lights"),
    );
    expect(ranked[0].trackId).toBe(2);
  });

  it("prefers the original album over a greatest hits repackage", () => {
    const ranked = rank(
      [
        c({
          trackId: 1,
          title: "Born to Run",
          artist: "Bruce Springsteen",
          album: "The Essential Bruce Springsteen",
        }),
        c({ trackId: 2, title: "Born to Run", artist: "Bruce Springsteen", album: "Born to Run" }),
      ],
      q("Bruce Springsteen", "Born to Run"),
    );
    expect(ranked[0].trackId).toBe(2);
  });

  it("rejects karaoke and tribute versions hardest", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Eye of the Tiger", artist: "The Karaoke Crew", album: "Karaoke Hits" }),
        c({ trackId: 2, title: "Eye of the Tiger", artist: "Survivor", album: "Eye of the Tiger" }),
      ],
      q("Survivor", "Eye of the Tiger"),
    );
    expect(ranked[0].trackId).toBe(2);
    expect(ranked[1].penalties).toContain("karaoke");
  });

  it("keeps a remix on top when the query asked for one", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Levels (Skrillex Remix)", artist: "Avicii", album: "Levels - Single" }),
        c({ trackId: 2, title: "Levels", artist: "Avicii", album: "Levels - EP" }),
      ],
      q("Avicii", "Levels (Skrillex Remix)"),
    );
    expect(ranked[0].trackId).toBe(1);
  });
});

describe("decide", () => {
  it("auto-accepts a clear winner", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Physical", artist: "Dua Lipa", album: "Future Nostalgia" }),
        c({
          trackId: 2,
          title: "Physical (Mark Ronson Remix)",
          artist: "Dua Lipa",
          album: "Club Future Nostalgia",
        }),
      ],
      q("Dua Lipa", "Physical"),
    );
    const d = decide(ranked, q("Dua Lipa", "Physical"));
    expect(d.status).toBe("auto");
    expect(d.chosen?.trackId).toBe(1);
  });

  it("sends a close call to human review", () => {
    const ranked = rank(
      [
        c({ trackId: 1, title: "Stronger", artist: "Kanye West", album: "Graduation" }),
        c({ trackId: 2, title: "Stronger", artist: "Kanye West", album: "Graduation (Deluxe)" }),
      ],
      q("Kanye West", "Stronger"),
    );
    expect(decide(ranked, q("Kanye West", "Stronger")).status).toBe("review");
  });

  it("reports missing when there are no candidates", () => {
    const d = decide([], q("Nobody", "Nothing"));
    expect(d.status).toBe("missing");
    expect(d.chosen).toBeNull();
  });
});
