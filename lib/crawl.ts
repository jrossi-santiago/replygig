import { CONFIG } from "./config";
import { prisma } from "./db";
import { advancedSearch, type RawTweet } from "./getxapi";
import { filterTweets } from "./grok";
import { ACTIVE_PACK, type QueryPack } from "./queryPack";

export type CrawlSummary = {
  niche: string;
  queries: number;
  apiCalls: number;
  grokCalls: number;
  tweetsSeen: number;
  tweetsNew: number;
  keepers: number;
  estimatedCost: number;
  errors: string[];
};

async function ensureNiche(pack: QueryPack) {
  return prisma.niche.upsert({
    where: { slug: pack.slug },
    update: { name: pack.name, queryPack: pack.queries, active: true },
    create: { slug: pack.slug, name: pack.name, queryPack: pack.queries, active: true },
  });
}

function tooOld(t: RawTweet): boolean {
  return Date.now() - t.tweetedAt.getTime() > CONFIG.maxAgeHours * 3600_000;
}

/// search -> dedup -> Grok filter -> listings.
/// Dedup happens BEFORE Grok so we never pay to re-read a tweet.
export async function runCrawl(pack: QueryPack = ACTIVE_PACK): Promise<CrawlSummary> {
  const niche = await ensureNiche(pack);
  const summary: CrawlSummary = {
    niche: pack.slug,
    queries: pack.queries.length,
    apiCalls: 0,
    grokCalls: 0,
    tweetsSeen: 0,
    tweetsNew: 0,
    keepers: 0,
    estimatedCost: 0,
    errors: [],
  };

  // 1. Search. One page per query — fat queries, few calls.
  const seen = new Map<string, RawTweet>();
  for (const query of pack.queries) {
    try {
      const res = await advancedSearch(query, { product: "Latest" });
      summary.apiCalls += res.calls;
      summary.tweetsSeen += res.tweets.length;
      for (const t of res.tweets) {
        if (tooOld(t)) continue; // an ask older than the window is already lost
        if (!seen.has(t.tweetId)) seen.set(t.tweetId, t);
      }
    } catch (err) {
      summary.apiCalls += 1;
      summary.errors.push(`search failed: ${(err as Error).message}`);
    }
  }

  // 2. Dedup against what we already processed on an earlier run.
  const ids = [...seen.keys()];
  const known = ids.length
    ? await prisma.tweetCache.findMany({
        where: { tweetId: { in: ids } },
        select: { tweetId: true, filteredAt: true },
      })
    : [];
  const alreadyFiltered = new Set(known.filter((k) => k.filteredAt).map((k) => k.tweetId));
  const fresh = ids.filter((id) => !alreadyFiltered.has(id)).map((id) => seen.get(id)!);
  summary.tweetsNew = fresh.length;

  // Cache every raw tweet we saw; refresh reply counts on the ones we knew.
  for (const t of seen.values()) {
    await prisma.tweetCache.upsert({
      where: { tweetId: t.tweetId },
      update: { replyCount: t.replyCount, likeCount: t.likeCount },
      create: {
        tweetId: t.tweetId,
        author: t.author,
        authorName: t.authorName,
        followers: t.followers,
        text: t.text,
        url: t.url,
        replyCount: t.replyCount,
        likeCount: t.likeCount,
        tweetedAt: t.tweetedAt,
        rawJson: t.raw as object,
      },
    });
  }

  // 3. Grok filter, batched.
  if (fresh.length) {
    const { verdicts, calls } = await filterTweets(fresh);
    summary.grokCalls += calls;

    for (const t of fresh) {
      const v = verdicts.get(t.tweetId);
      if (!v) continue;
      await prisma.tweetCache.update({
        where: { tweetId: t.tweetId },
        data: { filteredAt: new Date() },
      });

      const keep = v.is_real_ask && v.confidence >= CONFIG.minConfidence;
      const status = !keep ? "rejected" : v.crowded ? "crowded" : "open";
      if (keep) summary.keepers += 1;

      const data = {
        nicheId: niche.id,
        category: v.category,
        urgency: v.urgency,
        confidence: v.confidence,
        grokReason: v.reason,
        crowded: v.crowded,
        status,
        expiresAt: new Date(t.tweetedAt.getTime() + CONFIG.listingTtlHours * 3600_000),
      } as const;

      // Rejects are stored too, so /admin can review what the filter threw out.
      await prisma.listing.upsert({
        where: { tweetId: t.tweetId },
        update: data,
        create: { tweetId: t.tweetId, ...data },
      });
    }
  }

  // 4. Expire anything past its window.
  await prisma.listing.updateMany({
    where: { status: { in: ["open", "crowded"] }, expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });

  summary.estimatedCost =
    summary.apiCalls * CONFIG.costs.getxapiPerCall + summary.grokCalls * CONFIG.costs.grokPerCall;

  await prisma.eventLog.create({
    data: {
      apiCalls: summary.apiCalls,
      grokCalls: summary.grokCalls,
      tweetsSeen: summary.tweetsSeen,
      tweetsNew: summary.tweetsNew,
      keepers: summary.keepers,
      estimatedCost: summary.estimatedCost,
      note: summary.errors.length ? summary.errors.join(" | ").slice(0, 500) : null,
    },
  });

  return summary;
}
