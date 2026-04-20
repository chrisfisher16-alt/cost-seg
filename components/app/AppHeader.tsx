import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/shared/BrandMark";
import { NavLink } from "@/components/shared/NavLink";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthContext } from "@/lib/auth/require";

export function AppHeader({ ctx }: { ctx: AuthContext }) {
  const { user } = ctx;
  const initial = (user.name?.[0] ?? user.email[0] ?? "?").toUpperCase();
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            {user.role === "CPA" ? (
              <Badge variant="info" size="sm" className="hidden sm:inline-flex">
                CPA
              </Badge>
            ) : null}
          </div>
          <nav className="hidden items-center gap-6 text-sm sm:flex">
            <NavLink href="/dashboard">Dashboard</NavLink>
            {user.role === "ADMIN" ? (
              <NavLink href="/admin" match="exact">
                Admin
              </NavLink>
            ) : null}
            {user.role === "ENGINEER" ? (
              <NavLink href="/admin/engineer-queue">Engineer queue</NavLink>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                aria-label={`Account menu for ${user.name ?? user.email}`}
              >
                <span
                  aria-hidden
                  className="bg-primary text-primary-foreground inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                >
                  {initial}
                </span>
                <span className="hidden max-w-[160px] truncate text-sm sm:inline">
                  {user.name ?? user.email}
                </span>
                <ChevronDownIcon aria-hidden className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-foreground truncate text-sm font-medium tracking-normal normal-case">
                    {user.name ?? "Signed in"}
                  </span>
                  <span className="text-muted-foreground truncate text-xs font-normal tracking-normal normal-case">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <UserIcon className="mr-2 h-4 w-4" aria-hidden />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={signOutAction}>
                  <button type="submit" className="text-destructive flex w-full items-center">
                    <LogOutIcon className="mr-2 h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
