import type { Metadata } from "next";
import Link from "next/link";
import { CodeEntry } from "@/components/CodeEntry";
import { GitHubLink } from "@/components/site/GitHubLink";
import { APP_NAME } from "@/shared/app";
import { currentUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plant Pathology · Trivia Pig", description: "A classroom quiz for plant disease diagnosis. One projector, one host, and one phone per team." };

export default async function Home() {
  const user = await currentUser();
  const hostHref = user ? "/dashboard" : "/login";
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="btn-primary sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50">Skip to content</a>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" className="flex items-center gap-3 font-bold"><span aria-hidden className="text-3xl">🐷</span><span>{APP_NAME}</span></Link>
        <Link href={hostHref} className="text-sm font-semibold text-gold underline-offset-4 hover:underline">{user ? "Your boards →" : "Host sign in →"}</Link>
      </header>
      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-10 lg:grid-cols-[1.5fr_1fr] lg:py-16">
        <section className="relative">
          <div className="mb-6 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#b8efb2]"><span className="h-px w-12 bg-current" /> Plant pathology classroom</div>
          <h1 className="max-w-2xl text-5xl font-bold leading-[1.06] tracking-tight sm:text-7xl">Spot the signs.<br /><span className="text-gold">Make the diagnosis.</span></h1>
          <p className="mt-7 max-w-xl text-xl leading-relaxed text-white/85">Bring the lab to the big screen. Discuss the evidence with your team, buzz in, and put your plant pathology knowledge to work.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={hostHref} className="btn-primary min-h-14 px-6 text-lg">Host a classroom game</Link>
            <Link href="/display" className="btn-ghost min-h-14 px-6">Open projector display</Link>
          </div>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/75">2–6 teams · one phone per team · buzz-in and all-play<br />Only the host signs in. Team phones use the four-letter room code.</p>
        </section>
        <section aria-labelledby="join-heading" className="relative rounded-[2rem] border border-[#6e9273] bg-[#153c2d] p-7 shadow-2xl shadow-black/20 sm:p-9">
          <div aria-hidden className="mb-8 flex items-center gap-2 text-[#b8efb2]">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M35 8C14 6 6 14 10 27c12 8 26-1 25-19Z" stroke="currentColor" strokeWidth="2.5"/><path d="M7 37 28 16m-10 9-1-8m7 2 8 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Field team check-in</span>
          </div>
          <h2 id="join-heading" className="text-3xl font-bold">Ready to join?</h2>
          <p className="mb-6 mt-3 leading-relaxed text-white/85">Enter the code on the projector. Choose an available team and give it a name.</p>
          <CodeEntry target="/play" cta="Find my classroom" focus={false} />
          <p className="mt-5 text-sm leading-relaxed text-white/75">Use one phone for your whole team. Keep the page open to preserve your seat and score.</p>
        </section>
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-7 text-sm text-white/75">
        <span>A plant pathology adaptation of Trivia Pig · MIT licensed</span>
        <div className="flex flex-wrap items-center gap-5"><a href="/offline.html" download="plant-pathology-offline.html" className="text-gold underline underline-offset-4">Download offline rescue</a><GitHubLink /></div>
      </footer>
    </div>
  );
}
