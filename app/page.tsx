import Link from "next/link";

/// V0 has no marketing site — that is V1. This is a signpost.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">ReplyGig</h1>
      <p className="text-stone-600">
        Open asks on X, before the replies pile up. V0 spike — no accounts, no payments.
      </p>
      <div className="flex gap-3 text-sm">
        <Link href="/preview" className="rounded-lg bg-stone-900 px-4 py-2 font-medium text-white">
          See the board
        </Link>
        <Link href="/admin/costs" className="rounded-lg border border-stone-300 px-4 py-2">
          Costs
        </Link>
      </div>
    </main>
  );
}
