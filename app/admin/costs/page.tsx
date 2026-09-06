import { CONFIG } from "@/lib/config";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function Costs() {
  const today = startOfDay();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayAgg, monthAgg, runs, keepersToday, rejectedToday] = await Promise.all([
    prisma.eventLog.aggregate({
      where: { runAt: { gte: today } },
      _sum: { apiCalls: true, grokCalls: true, estimatedCost: true, tweetsSeen: true },
    }),
    prisma.eventLog.aggregate({
      where: { runAt: { gte: monthStart } },
      _sum: { estimatedCost: true, apiCalls: true, grokCalls: true },
    }),
    prisma.eventLog.findMany({ orderBy: { runAt: "desc" }, take: 20 }),
    prisma.listing.count({ where: { createdAt: { gte: today }, status: { not: "rejected" } } }),
    prisma.listing.count({ where: { createdAt: { gte: today }, status: "rejected" } }),
  ]);

  const seen = todayAgg._sum.tweetsSeen ?? 0;
  // Straight-line the month so an $80 budget is a number, not a vibe.
  const dayOfMonth = today.getDate();
  const projected = ((monthAgg._sum.estimatedCost ?? 0) / dayOfMonth) * 30;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Costs</h1>
      <p className="mt-1 text-sm text-stone-600">
        Estimates at ${CONFIG.costs.getxapiPerCall}/GetXAPI call and $
        {CONFIG.costs.grokPerCall}/Grok call. Budget target: under $80/mo.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="GetXAPI calls today" value={todayAgg._sum.apiCalls ?? 0} />
        <Stat label="Grok calls today" value={todayAgg._sum.grokCalls ?? 0} />
        <Stat label="Spend today" value={`$${(todayAgg._sum.estimatedCost ?? 0).toFixed(3)}`} />
        <Stat
          label="Month to date"
          value={`$${(monthAgg._sum.estimatedCost ?? 0).toFixed(2)}`}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Raw tweets today" value={seen} />
        <Stat label="Keepers today" value={keepersToday} />
        <Stat label="Rejected today" value={rejectedToday} />
        <Stat
          label="Projected month"
          value={`$${projected.toFixed(2)}`}
          warn={projected > 80}
        />
      </div>

      {seen >= 50 && keepersToday < 5 && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {seen} raw tweets today produced only {keepersToday} real asks. Tighten the query pack
          before building more UI.
        </p>
      )}

      <h2 className="mt-10 mb-2 text-sm font-semibold text-stone-700">Last 20 runs</h2>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {["Run", "Seen", "New", "Keepers", "API", "Grok", "Cost", "Note"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-500">
                  No crawl runs yet. Run <code>npm run crawl</code>.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 whitespace-nowrap text-stone-600">
                    {r.runAt.toISOString().slice(5, 16).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2">{r.tweetsSeen}</td>
                  <td className="px-3 py-2">{r.tweetsNew}</td>
                  <td className="px-3 py-2">{r.keepers}</td>
                  <td className="px-3 py-2">{r.apiCalls}</td>
                  <td className="px-3 py-2">{r.grokCalls}</td>
                  <td className="px-3 py-2">${r.estimatedCost.toFixed(4)}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-xs text-red-700">
                    {r.note}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 ${
        warn ? "border-red-300 bg-red-50" : "border-stone-200"
      }`}
    >
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
