import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import type { AuthContext } from "@/lib/auth/require";

export function AdminHeader({ ctx }: { ctx: AuthContext }) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b border-zinc-200/70 backdrop-blur dark:border-zinc-800/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Cost Seg
          </Link>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] tracking-widest text-amber-900 uppercase dark:bg-amber-950/60 dark:text-amber-200">
            Admin
          </span>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/admin" className="hover:text-foreground">
              Pipeline
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              My dashboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-zinc-500 sm:block">{ctx.user.email}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="hover:text-foreground text-sm text-zinc-600 transition dark:text-zinc-400"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
