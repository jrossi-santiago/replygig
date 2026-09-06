/// V0 runs ONE hardcoded niche. Edit these as you learn — the pack is meant to
/// be tuned in code, not authored by customers (that stays true through V1).
///
/// Rules of thumb baked in below:
///   - Exclude retweets and replies; we want the original ask.
///   - English first.
///   - Few fat queries beat many tiny ones. Each one costs a call.
///   - Quality filters live in code after Grok too, not only in the string.

export type QueryPack = {
  slug: string;
  name: string;
  queries: string[];
};

const EXCLUDE = "-filter:retweets -filter:replies lang:en";

export const INDIE_SAAS_SERVICES: QueryPack = {
  slug: "indie-saas-services",
  name: "Indie SaaS & freelance services",
  queries: [
    `"anyone know" (copywriter OR designer OR shopify OR developer OR "landing page") ${EXCLUDE}`,
    `"looking for" (freelancer OR agency OR "shopify expert" OR copywriter OR "web designer") ${EXCLUDE}`,
    `("who is the best" OR "who's the best") (designer OR developer OR copywriter OR agency) ${EXCLUDE}`,
    `"need a" (dev OR developer OR designer OR writer OR freelancer) -course -giveaway -job ${EXCLUDE}`,
    `"recommend a" (freelancer OR agency OR developer OR designer OR copywriter) ${EXCLUDE}`,
    `("any recommendations for" OR "can anyone recommend") (developer OR designer OR agency OR copywriter) ${EXCLUDE}`,
    `("hire a" OR "hiring a") (freelancer OR contractor OR designer OR developer) -"we are hiring" ${EXCLUDE}`,
    `("shopify" OR "webflow" OR "framer") ("need help" OR "anyone good" OR "looking for someone") ${EXCLUDE}`,
  ],
};

export const QUERY_PACKS: QueryPack[] = [INDIE_SAAS_SERVICES];

/// V0 crawls exactly one niche.
export const ACTIVE_PACK = INDIE_SAAS_SERVICES;
