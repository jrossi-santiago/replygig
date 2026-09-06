import { CATEGORIES, CONFIG, type Category } from "./config";
import type { RawTweet } from "./getxapi";

const BASE = "https://api.x.ai/v1/chat/completions";

export type FilterVerdict = {
  is_real_ask: boolean;
  confidence: number;
  category: Category;
  urgency: "now" | "this_week" | "vague";
  crowded: boolean;
  reason: string;
};

const FILTER_SYSTEM = `You screen tweets for ReplyGig, a board of open asks on X.

A REAL ASK:
- The author wants help, a hire, a recommendation, or a vendor.
- The job is specific enough that a specialist could reply and be useful.
- The author is buying, not selling.

NOT a real ask:
- Engagement bait ("like if you agree", "reply with your best X").
- News commentary, quote-tweet dunks, jokes.
- Someone listing or promoting their own services.
- Recruiter spam blasting many roles at once; giveaways; crypto shilling.
- Vague growth questions ("how do I grow on Twitter").
- Corporate "we are hiring" posts that already have a pile of replies.

Set crowded=true when the thread already looks answered (many replies) so a new
reply would be buried.

Score confidence honestly. Below 0.7 is dropped, so do not inflate.

Reply with JSON only, no prose, no code fences:
{"is_real_ask":bool,"confidence":0.0,"category":"shopify|copy|design|dev|ads|other","urgency":"now|this_week|vague","crowded":bool,"reason":"one short line"}`;

function ageMinutes(d: Date): number {
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
}

function tweetBlock(t: RawTweet): string {
  return [
    `text: ${t.text.replace(/\s+/g, " ").slice(0, 600)}`,
    `author: @${t.author}${t.followers != null ? ` (${t.followers} followers)` : ""}`,
    `replies: ${t.replyCount}  likes: ${t.likeCount}  age: ${ageMinutes(t.tweetedAt)}m`,
  ].join("\n");
}

async function chat(
  system: string,
  user: string,
  maxTokens: number,
  model = process.env.XAI_MODEL_FILTER ?? "grok-4-1-fast"
): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY is not set");

  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`xAI ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");
  const from = startArr !== -1 && (start === -1 || startArr < start) ? startArr : start;
  if (from === -1) return null;
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  try {
    return JSON.parse(cleaned.slice(from, end + 1)) as T;
  } catch {
    return null;
  }
}

function coerce(v: Partial<FilterVerdict> | undefined, t: RawTweet): FilterVerdict {
  const category = (CATEGORIES as readonly string[]).includes(v?.category ?? "")
    ? (v!.category as Category)
    : "other";
  const urgency = ["now", "this_week", "vague"].includes(v?.urgency ?? "")
    ? (v!.urgency as FilterVerdict["urgency"])
    : "vague";
  return {
    is_real_ask: Boolean(v?.is_real_ask),
    confidence: Math.min(1, Math.max(0, Number(v?.confidence ?? 0))),
    category,
    urgency,
    // Trust the reply count over the model for crowding — it is a fact, not a judgement.
    crowded: Boolean(v?.crowded) || t.replyCount >= CONFIG.crowdedReplyCount,
    reason: String(v?.reason ?? "").slice(0, 200) || "no reason given",
  };
}

/// Call A — filter. Batched: one request screens many tweets, which is the
/// difference between $2 and $40 a month. Never send a raw search dump to a
/// big reasoning model; the fast model does this fine.
export async function filterTweets(
  tweets: RawTweet[],
  batchSize = 8
): Promise<{ verdicts: Map<string, FilterVerdict>; calls: number }> {
  const verdicts = new Map<string, FilterVerdict>();
  let calls = 0;

  for (let i = 0; i < tweets.length; i += batchSize) {
    const batch = tweets.slice(i, i + batchSize);
    const user = [
      `Screen these ${batch.length} tweets. Return a JSON array of ${batch.length} objects in the same order, one per tweet.`,
      "",
      ...batch.map((t, n) => `--- tweet ${n + 1} ---\n${tweetBlock(t)}`),
    ].join("\n");

    let parsed: Partial<FilterVerdict>[] | null = null;
    try {
      const raw = await chat(FILTER_SYSTEM, user, 120 * batch.length + 200);
      calls += 1;
      parsed = parseJson<Partial<FilterVerdict>[]>(raw);
    } catch (err) {
      calls += 1;
      console.error(`  grok filter batch failed: ${(err as Error).message}`);
    }

    batch.forEach((t, n) => {
      const v = Array.isArray(parsed) ? parsed[n] : undefined;
      verdicts.set(
        t.tweetId,
        v
          ? coerce(v, t)
          : { ...coerce(undefined, t), reason: "filter call failed — dropped" }
      );
    });
  }

  return { verdicts, calls };
}

/// Call B — draft reply. V0 has no subscriber, so the offer one-liner is a
/// parameter and this stays unused by the crawler until V1 wires up onboarding.
export async function draftReply(tweet: RawTweet, offerOneLiner: string): Promise<string> {
  const system = `You write one short reply to a tweet where someone is asking for help.

Rules:
- Under 280 characters. One reply, no options, no preamble.
- Sound like a person who does the work, not a salesperson.
- Reference the specific thing they asked for.
- No "I'd love to hop on a call", no emoji-padding, no "DM me!" as the whole reply.
- If it is natural, say one concrete thing you would do for them.
Return the reply text only.`;

  const raw = await chat(
    system,
    `Their tweet:\n${tweetBlock(tweet)}\n\nWho I am / what I sell: ${offerOneLiner}`,
    200,
    process.env.XAI_MODEL_DRAFT ?? process.env.XAI_MODEL_FILTER ?? "grok-4-1-fast"
  );
  return raw.trim().replace(/^["']|["']$/g, "").slice(0, 280);
}

export const GROK_CALL_COST = CONFIG.costs.grokPerCall;
