import { NextResponse } from "next/server";
import { runCrawl } from "@/lib/crawl";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/// Vercel Cron hits this. Protected by CRON_SECRET so nobody can spend our
/// GetXAPI budget for us.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runCrawl();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
