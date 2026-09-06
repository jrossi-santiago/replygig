import { CONFIG } from "./config";

const BASE = "https://api.getxapi.com";

export type RawTweet = {
  tweetId: string;
  author: string;
  authorName: string | null;
  followers: number | null;
  text: string;
  url: string;
  replyCount: number;
  likeCount: number;
  tweetedAt: Date;
  raw: unknown;
};

export type SearchResult = {
  tweets: RawTweet[];
  nextCursor: string | null;
  hasNextPage: boolean;
  calls: number;
};

function pick<T>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/// GetXAPI mirrors the common X shape but field names vary a little between
/// endpoints, so read defensively rather than trusting one spelling.
export function normalizeTweet(t: Record<string, unknown>): RawTweet | null {
  const id = pick<string | number>(t, ["id", "id_str", "tweetId", "rest_id"]);
  const text = pick<string>(t, ["text", "full_text", "fullText"]);
  if (id === undefined || !text) return null;

  const author = (pick<Record<string, unknown>>(t, ["author", "user", "core"]) ??
    {}) as Record<string, unknown>;
  const handle =
    pick<string>(author, ["userName", "username", "screen_name", "screenName"]) ??
    pick<string>(t, ["username", "screen_name"]) ??
    "unknown";
  const createdRaw =
    pick<string | number>(t, ["createdAt", "created_at", "date", "timestamp"]) ?? Date.now();
  const created = new Date(createdRaw as string | number);

  return {
    tweetId: String(id),
    author: handle,
    authorName: pick<string>(author, ["name", "displayName"]) ?? null,
    followers: (() => {
      const f = pick<number | string>(author, ["followers", "followers_count", "followersCount"]);
      return f === undefined ? null : num(f);
    })(),
    text: String(text),
    url: pick<string>(t, ["url", "twitterUrl"]) ?? `https://x.com/i/web/status/${id}`,
    replyCount: num(pick(t, ["replyCount", "reply_count"])),
    likeCount: num(pick(t, ["likeCount", "like_count", "favorite_count"])),
    tweetedAt: Number.isNaN(created.getTime()) ? new Date() : created,
    raw: t,
  };
}

function tweetsFrom(body: unknown): Record<string, unknown>[] {
  const b = body as Record<string, unknown>;
  const candidates = [b?.tweets, b?.data, b?.results, (b?.data as Record<string, unknown>)?.tweets];
  for (const c of candidates) if (Array.isArray(c)) return c as Record<string, unknown>[];
  return [];
}

/// One page of advanced search. ~20 tweets, ~$0.001. Caller pages, not us —
/// V0 takes a page or two per query and moves on.
export async function advancedSearch(
  query: string,
  opts: { cursor?: string; product?: "Latest" | "Top" } = {}
): Promise<SearchResult> {
  const key = process.env.GETXAPI_KEY;
  if (!key) throw new Error("GETXAPI_KEY is not set");

  const url = new URL("/twitter/tweet/advanced_search", BASE);
  url.searchParams.set("query", query);
  url.searchParams.set("queryType", opts.product ?? "Latest");
  url.searchParams.set("product", opts.product ?? "Latest");
  if (opts.cursor) url.searchParams.set("cursor", opts.cursor);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, "x-api-key": key },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GetXAPI ${res.status}: ${body.slice(0, 300)}`);
  }

  const body = (await res.json()) as Record<string, unknown>;
  const tweets = tweetsFrom(body)
    .map((t) => normalizeTweet(t))
    .filter((t): t is RawTweet => t !== null);

  const nextCursor =
    (pick<string>(body, ["next_cursor", "nextCursor", "cursor"]) as string | undefined) ?? null;

  return {
    tweets,
    nextCursor: nextCursor || null,
    hasNextPage: Boolean(pick<boolean>(body, ["has_next_page", "hasNextPage"]) ?? nextCursor),
    calls: 1,
  };
}

export const GETXAPI_CALL_COST = CONFIG.costs.getxapiPerCall;
