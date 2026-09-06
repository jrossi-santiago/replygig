/// Tunables for V0. Everything the hard rules mention lives here, not scattered.
export const CONFIG = {
  /// Kill stale listings: nothing older than this shows on the board.
  maxAgeHours: 6,
  /// A tweet with this many replies or more is "crowded" — the thread is spent.
  crowdedReplyCount: 15,
  /// Grok filter drops anything below this.
  minConfidence: 0.7,
  /// A keeper stays live this long from the moment the tweet was posted.
  listingTtlHours: 6,
  /// Board page size.
  previewLimit: 20,
  /// Cost accounting, for /admin/costs. Estimates, not invoices.
  costs: {
    getxapiPerCall: 0.001,
    /// Rough per-tweet Grok filter cost on the fast model.
    grokPerCall: 0.0004,
  },
} as const;

export const CATEGORIES = ["shopify", "copy", "design", "dev", "ads", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
