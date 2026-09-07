import { describe, it, expect } from "vitest";
import { parseList } from "../parse";

describe("parseList", () => {
  it("parses a numbered dash list", () => {
    expect(parseList("1. Survivor - Eye of the Tiger")).toEqual([
      { raw: "1. Survivor - Eye of the Tiger", artist: "Survivor", title: "Eye of the Tiger" },
    ]);
  });

  it("parses en dash and em dash separators", () => {
    const out = parseList("Survivor – Eye of the Tiger\nQueen — Don't Stop Me Now");
    expect(out.map((l) => l.artist)).toEqual(["Survivor", "Queen"]);
    expect(out.map((l) => l.title)).toEqual(["Eye of the Tiger", "Don't Stop Me Now"]);
  });

  it("parses 'Title by Artist' in the reverse order", () => {
    expect(parseList("Eye of the Tiger by Survivor")[0]).toMatchObject({
      artist: "Survivor",
      title: "Eye of the Tiger",
    });
  });

  it("strips bullets and markdown bold", () => {
    expect(parseList("- **Survivor** - Eye of the Tiger")[0]).toMatchObject({
      artist: "Survivor",
      title: "Eye of the Tiger",
    });
  });

  it("parses markdown table rows", () => {
    expect(parseList("| Survivor | Eye of the Tiger |")[0]).toMatchObject({
      artist: "Survivor",
      title: "Eye of the Tiger",
    });
  });

  it("drops prose lines that carry no separator", () => {
    const text = [
      "Here is a great playlist for your half marathon:",
      "1. Survivor - Eye of the Tiger",
      "Let me know if you want more suggestions!",
    ].join("\n");
    expect(parseList(text)).toHaveLength(1);
  });

  it("drops a markdown table header separator row", () => {
    expect(parseList("| Artist | Title |\n| --- | --- |\n| Queen | Bicycle Race |")).toHaveLength(1);
  });

  it("returns an empty array for empty input", () => {
    expect(parseList("   \n  \n")).toEqual([]);
  });
});
