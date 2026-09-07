import { NextResponse } from "next/server";
import { lookupBpm } from "../../../lib/bpm";
import type { Candidate } from "../../../lib/types";

// WIRE-DARK[Next.js route convention: the framework serves app/api/bpm/route.ts at /api/bpm. enrichWithBpm calls it in Task 10.]
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const artist = params.get("artist");
  const title = params.get("title");
  const durationMs = Number(params.get("durationMs") ?? 0);

  if (!artist || !title || !durationMs) {
    return NextResponse.json(
      { error: "artist, title and durationMs are required" },
      { status: 400 },
    );
  }

  const target = { artist, title, durationMs, album: params.get("album") ?? "" } as Candidate;
  const result = await lookupBpm(target);

  // BPM is a property of a recording and never changes, so cache it hard.
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=31536000, immutable" },
  });
}
