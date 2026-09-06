# ReplyGig

Open asks on X, before the replies pile up.

A live board of tweets like *"anyone know a good Shopify dev?"* — real gigs that go
cold in about an hour. We watch X, throw out the junk, and show you the ask while
the thread is still winnable.

**Status: V0 spike.** No auth, no payments, no drafts. The point of V0 is to prove
the pipe: search → dedup → Grok filter → a board of real asks.

## What exists

| Path | What it is |
| --- | --- |
| `/preview` | Public board, last 20 keepers. Filters: hide crowded, max age. |
| `/admin/costs` | GetXAPI + Grok call counts and estimated spend, per day and month. |
| `/api/cron/crawl` | The crawler. `Authorization: Bearer $CRON_SECRET`. |

Pipeline lives in `lib/crawl.ts`. The one hardcoded niche is `lib/queryPack.ts` —
edit it there, it is meant to be tuned in code, not by customers.

## Run it

```bash
cp .env.example .env      # fill in GETXAPI_KEY, XAI_API_KEY, DATABASE_URL
npm install
npm run db:push
npm run db:seed           # 4 fake listings, so you can look at /preview with no keys
npm run dev               # http://localhost:3000/preview
```

Then, with real keys:

```bash
npm run crawl             # one full search -> filter -> listings run, prints the cost
```

In production, Vercel Cron hits `/api/cron/crawl` every 5 minutes (`vercel.json`).
Set `CRON_SECRET` in the Vercel project and Vercel sends it as a bearer token.

## The V0 gate

If ~50 raw tweets yield fewer than 5 real asks, **tighten the queries before
building more UI.** `npm run crawl` and `/admin/costs` both say so out loud when
that happens.

## Cost shape

- GetXAPI advanced search: ~$0.001/call, ~20 tweets. 8 queries per run.
- Dedup happens against `TweetCache` *before* Grok, so we never pay to re-read a tweet.
- Grok filter is batched (8 tweets per call) on the fast model.
- Target for one niche: under $80/mo. `/admin/costs` projects the month.

## Rules this build follows

- Human sends the reply. Nothing is ever posted from anyone's X account.
- One shared search per niche. No per-customer queries.
- Asks older than 6 hours are hidden; 15+ replies is "crowded" and hidden unless asked for.
- Dedup on tweet id.
- No scheduling, analytics, follower graphs, or sponsors.

## Not built yet (V1)

Marketing page, Whop checkout, auth, onboarding one-liner, per-user Grok drafts,
digest + alert emails, mark-as-replied, admin query-pack editor. `lib/grok.ts`
already has the draft call (`draftReply`) and the schema already has `User` and
`Draft`, so V1 does not need a rewrite.
