// WIRE-DARK[Next.js App Router convention: the framework renders app/page.tsx at /, no import exists. Proven by next build emitting / in the route table.]
export default function Home() {
  return (
    <main>
      <h1>Racelist</h1>
      <p>Paste a song list. Get a race-paced Apple Music playlist.</p>
    </main>
  );
}
