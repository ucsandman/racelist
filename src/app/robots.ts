import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// WIRE-DARK[Next.js metadata convention: the framework calls app/robots.ts to emit /robots.txt. Proven by next build emitting /robots.txt in the route table.]
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
