import "dotenv/config";
import { prisma } from "../lib/db";
import { ACTIVE_PACK } from "../lib/queryPack";

/// Fake-then-real: seeds the niche and a few plausible listings so /preview can
/// be built and reviewed before a single API key exists. Safe to re-run; the
/// fake rows all use tweet ids prefixed `demo-` and are replaced each time.
const DEMO = [
  {
    author: "mayaruns",
    authorName: "Maya",
    text: "anyone know a good shopify dev? our checkout is breaking on mobile and our current guy has ghosted us for 2 weeks",
    replyCount: 2,
    likeCount: 4,
    minutesAgo: 7,
    category: "shopify",
    urgency: "now",
    confidence: 0.93,
    reason: "Store owner with a broken checkout, wants a dev now.",
  },
  {
    author: "devon_builds",
    authorName: "Devon",
    text: "looking for a freelance copywriter who actually understands B2B SaaS. our landing page converts at 0.8% and I think the words are the problem",
    replyCount: 5,
    likeCount: 11,
    minutesAgo: 34,
    category: "copy",
    urgency: "this_week",
    confidence: 0.89,
    reason: "Wants to hire a SaaS copywriter for a specific page.",
  },
  {
    author: "priyacodes",
    authorName: "Priya",
    text: "need a designer to take our figma from 'engineer made this' to something we can put on the homepage. paid, this week ideally",
    replyCount: 1,
    likeCount: 2,
    minutesAgo: 52,
    category: "design",
    urgency: "now",
    confidence: 0.91,
    reason: "Paid design work, explicit timeline.",
  },
  {
    author: "growthgrant",
    authorName: "Grant",
    text: "who's the best person to run google ads for a $40k MRR b2b product? happy to pay properly, tired of agencies that outsource it",
    replyCount: 19,
    likeCount: 40,
    minutesAgo: 120,
    category: "ads",
    urgency: "this_week",
    confidence: 0.84,
    reason: "Real budget, but the thread already has 19 replies.",
  },
];

async function main() {
  const niche = await prisma.niche.upsert({
    where: { slug: ACTIVE_PACK.slug },
    update: { name: ACTIVE_PACK.name, queryPack: ACTIVE_PACK.queries, active: true },
    create: {
      slug: ACTIVE_PACK.slug,
      name: ACTIVE_PACK.name,
      queryPack: ACTIVE_PACK.queries,
      active: true,
    },
  });

  for (const [i, d] of DEMO.entries()) {
    const tweetId = `demo-${i + 1}`;
    const tweetedAt = new Date(Date.now() - d.minutesAgo * 60_000);
    const crowded = d.replyCount >= 15;

    await prisma.tweetCache.upsert({
      where: { tweetId },
      update: { tweetedAt, replyCount: d.replyCount },
      create: {
        tweetId,
        author: d.author,
        authorName: d.authorName,
        followers: 1200 + i * 300,
        text: d.text,
        url: `https://x.com/i/web/status/${tweetId}`,
        replyCount: d.replyCount,
        likeCount: d.likeCount,
        tweetedAt,
        rawJson: { demo: true },
        filteredAt: new Date(),
      },
    });

    const data = {
      nicheId: niche.id,
      category: d.category,
      urgency: d.urgency,
      confidence: d.confidence,
      grokReason: d.reason,
      crowded,
      status: crowded ? ("crowded" as const) : ("open" as const),
      expiresAt: new Date(tweetedAt.getTime() + 6 * 3600_000),
    };

    await prisma.listing.upsert({
      where: { tweetId },
      update: data,
      create: { tweetId, ...data },
    });
  }

  console.log(`seeded ${DEMO.length} demo listings for niche ${niche.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
