"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Nav link with an active-state cue driven by the current pathname. Keeps
 * the Header a server component — only the link list itself is client, so
 * auth-aware branches upstream stay on the server.
 *
 * Active match is startsWith so nested paths (e.g. /studies/[id]/intake)
 * correctly light up a parent nav entry (/dashboard). Exact-match for "/"
 * is special-cased so every page isn't "active" for home.
 */
export function NavLink({
  href,
  children,
  className,
  activeClassName = "text-foreground",
  inactiveClassName = "text-muted-foreground hover:text-foreground",
  /**
   * How the path is matched against the current pathname.
   *   - "exact" → equal strings (default for "/")
   *   - "startsWith" → matches the link or any child route (default elsewhere)
   */
  match,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  match?: "exact" | "startsWith";
}) {
  const pathname = usePathname() ?? "/";
  const mode = match ?? (href === "/" ? "exact" : "startsWith");
  const active =
    mode === "exact" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href as never}
      className={cn(
        "font-medium transition-colors",
        active ? activeClassName : inactiveClassName,
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
