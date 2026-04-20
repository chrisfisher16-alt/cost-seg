import Link from "next/link";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/shared/BrandMark";
import { NavLink } from "@/components/shared/NavLink";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/Container";
import type { AuthContext } from "@/lib/auth/require";

export function AdminHeader({ ctx }: { ctx: AuthContext }) {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <Container size="full" className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-5">
          <BrandMark />
          <Badge variant="warning" size="sm">
            Admin
          </Badge>
          <nav className="hidden items-center gap-5 text-sm sm:flex">
            {/*
             * /admin matches /admin AND any nested admin route under startsWith.
             * Force exact so "Pipeline" doesn't light up when on
             * /admin/engineer-queue or /admin/studies/[id].
             */}
            <NavLink href="/admin" match="exact">
              Pipeline
            </NavLink>
            <NavLink href="/admin/engineer-queue">Engineer queue</NavLink>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden />
              My dashboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="text-muted-foreground hidden text-xs sm:block">{ctx.user.email}</span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" leadingIcon={<LogOutIcon />}>
              Sign out
            </Button>
          </form>
        </div>
      </Container>
    </header>
  );
}
