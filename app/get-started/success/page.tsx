import Link from "next/link";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export const metadata = { title: "Payment received" };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="rounded-full border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/40">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-6 w-6 text-emerald-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Payment received</h1>
      <p className="mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Check your inbox — we sent a sign-in link to continue. Your study will start once you upload
        your three documents.
      </p>
      {params.session_id ? (
        <p className="mt-4 font-mono text-[10px] tracking-widest text-zinc-400 uppercase">
          Receipt ref {params.session_id.slice(-10)}
        </p>
      ) : null}
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Back home
      </Link>
    </main>
  );
}
