import Link from "next/link";

export function Header() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 w-full border-b border-zinc-200/70 backdrop-blur dark:border-zinc-800/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-foreground font-semibold tracking-tight hover:opacity-80">
          Cost Seg
        </Link>
        <nav className="flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
          <a href="#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#estimator" className="hover:text-foreground">
            Estimate savings
          </a>
        </nav>
      </div>
    </header>
  );
}
