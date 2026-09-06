import Link from "next/link";
import { CONFIG } from "@/lib/config";
import { prisma } from "@/lib/db";
import { CopyButton } from "./CopyButton";

export const dynamic = "force-dynamic";

type Search = { crowded?: string; hours?: string };

function ageLabel(d: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default async function Preview({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const showCrowded = sp.crowded === "1";
  const hours = Number(sp.hours) > 0 ? Number(sp.hours) : CONFIG.maxAgeHours;
  const since = new Date(Date.now() - hours * 3600_000);

  const listings = await prisma.listing.findMany({
    where: {
      status: showCrowded ? { in: ["open", "crowded"] } : "open",
      tweet: { tweetedAt: { gte: since } },
    },
    include: { tweet: true, niche: true },
    orderBy: { tweet: { tweetedAt: "desc" } },
    take: CONFIG.previewLimit,
  });

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">ReplyGig · preview</h1>
        <p className="mt-1 text-sm text-stone-600">
          People on X asking for work you could do. Newest first, last {hours} hours.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <FilterLink href={`/preview?hours=${hours}`} active={!showCrowded}>
          Open only
        </FilterLink>
        <FilterLink href={`/preview?hours=${hours}&crowded=1`} active={showCrowded}>
          Show crowded
        </FilterLink>
        <span className="mx-1 self-center text-stone-300">|</span>
        {[1, 6, 24].map((h) => (
          <FilterLink
            key={h}
            href={`/preview?hours=${h}${showCrowded ? "&crowded=1" : ""}`}
            active={hours === h}
          >
            {h}h
          </FilterLink>
        ))}
      </nav>

      {listings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-600">
          Nothing open right now. That&rsquo;s normal. Asks cluster in US morning.
        </p>
      ) : (
        <ul className="space-y-4">
          {listings.map((l) => {
            const t = l.tweet;
            const url = `https://x.com/i/web/status/${t.tweetId}`;
            return (
              <li
                key={l.id}
                className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      l.crowded
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {l.crowded
                      ? `Crowded · ${t.replyCount} replies`
                      : `Open · ${ageLabel(t.tweetedAt)} · ${t.replyCount} ${
                          t.replyCount === 1 ? "reply" : "replies"
                        }`}
                  </span>
                  <span className="text-stone-500">@{t.author}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-stone-500">{l.category}</span>
                </div>

                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-900">
                  {t.text}
                </p>

                <p className="mt-3 border-l-2 border-stone-200 pl-3 text-sm text-stone-600">
                  <span className="font-medium text-stone-700">Why this is a gig: </span>
                  {l.grokReason}
                </p>

                <div className="mt-4 flex gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700"
                  >
                    Open on X
                  </a>
                  <CopyButton text={url} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-xs text-stone-500">
        V0 spike. No accounts, no drafts yet.{" "}
        <Link href="/admin/costs" className="underline">
          Costs
        </Link>
      </p>
    </main>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-1.5 ${
        active
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-300 text-stone-700 hover:bg-stone-100"
      }`}
    >
      {children}
    </Link>
  );
}
