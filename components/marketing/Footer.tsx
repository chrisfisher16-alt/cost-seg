export function Footer() {
  return (
    <footer className="border-t border-zinc-200/70 bg-zinc-50/40 py-10 text-sm text-zinc-500 dark:border-zinc-800/70 dark:bg-zinc-950/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Cost Seg. All rights reserved.</p>
        <p className="max-w-xl text-xs leading-relaxed">
          Estimates and AI Reports are planning tools produced by software. They are not engineered
          cost segregation studies under IRS Publication 5653 and should not be relied on for tax
          filings without CPA review.
        </p>
      </div>
    </footer>
  );
}
