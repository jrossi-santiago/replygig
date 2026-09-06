import "dotenv/config";
import { prisma } from "../lib/db";
import { runCrawl } from "../lib/crawl";
import { ACTIVE_PACK } from "../lib/queryPack";

async function main() {
  console.log(`crawling niche: ${ACTIVE_PACK.slug} (${ACTIVE_PACK.queries.length} queries)`);
  const s = await runCrawl(ACTIVE_PACK);

  console.log("");
  console.log(`  raw tweets seen : ${s.tweetsSeen}`);
  console.log(`  new (deduped)   : ${s.tweetsNew}`);
  console.log(`  keepers         : ${s.keepers}`);
  console.log(`  getxapi calls   : ${s.apiCalls}`);
  console.log(`  grok calls      : ${s.grokCalls}`);
  console.log(`  est. cost       : $${s.estimatedCost.toFixed(4)}`);
  for (const e of s.errors) console.log(`  ! ${e}`);

  // The V0 gate: bad yield means fix the queries, not the UI.
  if (s.tweetsSeen >= 50 && s.keepers < 5) {
    console.log("");
    console.log(
      `WARNING: ${s.tweetsSeen} raw tweets yielded only ${s.keepers} real asks.\n` +
        "Tighten lib/queryPack.ts before building more UI."
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
