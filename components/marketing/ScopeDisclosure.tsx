export function ScopeDisclosure({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs leading-relaxed text-zinc-500">
        This is a planning estimate — not a complete cost segregation study under IRS Pub 5653. Do
        not rely on it for a tax filing without CPA review.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-amber-200/70 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold">Important scope disclosure.</p>
      <p className="mt-1">
        This is a planning and modeling estimate produced by software. It is not a complete cost
        segregation study under the IRS Cost Segregation Audit Techniques Guide (Publication 5653).
        Do not file a tax return relying on this number without your CPA&rsquo;s independent review.
      </p>
    </div>
  );
}
