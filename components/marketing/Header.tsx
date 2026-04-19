import Link from "next/link";
import { MenuIcon } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/shared/BrandMark";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getOptionalAuth } from "@/lib/auth/require";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/samples", label: "Sample reports" },
  { href: "/compare", label: "Compare" },
  { href: "/faq", label: "FAQ" },
] as const;

export async function Header() {
  const ctx = await getOptionalAuth();
  const signedIn = Boolean(ctx);

  return (
    <header className="border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        <BrandMark size="default" />
        <nav className="hidden items-center gap-7 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href as never}
              className="text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          {signedIn ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <form action={signOutAction} className="hidden sm:block">
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/pricing">Get started</Link>
          </Button>
          <MobileNav signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}

function MobileNav({ signedIn }: { signedIn: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open menu" className="md:hidden">
          <MenuIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>
            <BrandMark asLink={false} />
          </SheetTitle>
          <SheetDescription>AI cost segregation studies.</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href as never}
              className="hover:bg-secondary rounded-md px-3 py-2 text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-border my-2 border-t" />
          {signedIn ? (
            <Link
              href="/dashboard"
              className="hover:bg-secondary rounded-md px-3 py-2 text-sm font-medium"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="hover:bg-secondary rounded-md px-3 py-2 text-sm font-medium"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/pricing"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium"
          >
            Get started
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
