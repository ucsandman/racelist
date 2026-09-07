import { describe, it, expect } from "vitest";
import sitemap from "../sitemap";
import robots from "../robots";
import { SITE_URL } from "../../lib/site";

describe("seo floor", () => {
  it("sitemap lists the home page with an absolute url", () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].url).toBe(SITE_URL);
  });

  it("robots allows crawling and points at the sitemap", () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" });
  });
});
