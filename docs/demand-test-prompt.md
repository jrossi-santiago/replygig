# Demand test — run this before spending on API keys

Paste the block below into Grok (or any model with live X search). It answers the
only question that matters before V1: **do enough real asks exist in a 4-hour
window to justify a live board?**

Read the result as supply data:

- 5+ real asks in 4 hours -> live board is real, Pro at $79 is defensible.
- Needs 12 hours to find 5 -> this is a digest product. Starter at $29 is the business.
- Under 5 in 12 hours for a niche -> wrong niche, or the phrasings are wrong.

Run it three times: US morning, US evening, and a weekend. Then move the winning
phrasings into `lib/queryPack.ts` and the junk-producing ones out.

Caveat: models are unreliable at strict time filtering and will sometimes invent
permalinks. Spot-check two or three links before trusting the count.

---

```
You have live access to X (Twitter) search. Do a real search — do not answer from memory.

TASK
Find posts from the last 4 hours where someone is asking to hire, or asking for a
recommendation for, a freelancer/agency/contractor. Real buying intent, not chatter.

WHAT COUNTS (all four must be true)
1. The author wants help, a hire, a rec, or a vendor — they are BUYING, not selling.
2. The job is specific enough that a specialist could reply and be useful.
3. It's an original post, not a reply or retweet, in English.
4. Posted within the last 4 hours.

WHAT DOES NOT COUNT — exclude these even if the wording looks close
- Anyone advertising their own services, portfolio, or availability.
- "We're hiring" corporate job posts and recruiter threads listing multiple roles.
- Engagement bait ("reply with your best X", "like if you agree"), giveaways, crypto.
- News commentary, quote-tweet dunks, jokes.
- Vague growth questions like "how do I grow on Twitter".
- Posts that already have 15+ replies — the thread is spent.

SEARCH LIKE THIS (run several, these are starting points, vary the phrasing)
- "anyone know" (copywriter OR designer OR shopify OR developer OR "landing page")
- "looking for" (freelancer OR agency OR "shopify expert" OR copywriter)
- "who's the best" / "who is the best" (designer OR developer OR agency)
- "need a" (dev OR designer OR writer OR freelancer) -course -giveaway
- "recommend a" (freelancer OR agency OR developer OR designer)
- "can anyone recommend" / "any recommendations for" + (developer OR designer OR agency)

OUTPUT
A table, newest first, with one row per post:
| # | Link | @handle | Posted (mins ago) | Replies | The ask (verbatim, trimmed) | Category | Why it's a real gig (one line) |

Every Link must be a real permalink you actually found in search results. Do not
construct, guess, or reconstruct URLs. If you are not certain a link is real, drop
the row.

Then, below the table, tell me honestly:
- How many raw posts you looked at to get these.
- How many were real asks vs. junk.
- The three phrasings that produced the best hit rate, and the three that produced
  the most junk.

IF YOU FIND FEWER THAN 5
Do not pad the list to reach 5. Say plainly how many you found, then widen the
window to the last 12 hours and show those separately, clearly labeled. I would
rather know the real supply than see a full table.
```
