import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Paste a song list from ChatGPT or Claude and get an Apple Music playlist sequenced by BPM to your running cadence and goal finish time.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: "Paste a song list. Get a race-paced Apple Music playlist.",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

// WIRE-DARK[Next.js App Router convention: the framework renders app/layout.tsx for every route, no import exists. Proven by next build emitting / in the route table.]
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
