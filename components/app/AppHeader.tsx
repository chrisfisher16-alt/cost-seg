import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import type { AuthContext } from "@/lib/auth/require";

export function AppHeader({ ctx }: { ctx: AuthContext }) {
  const { user } = ctx;
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b border-zinc-200/70 backdrop-blur dark:border-zinc-800/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Cost Seg
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            {user.role === "ADMIN" ? (
              <Link href="/admin" className="hover:text-foreground">
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-zinc-500 sm:block">{user.email}</span>
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
