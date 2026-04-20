import Link from "next/link";
import { ArrowLeftIcon, CompassIcon } from "lucide-react";

import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Not found" };

/**
 * Global 404. Rendered whenever `notFound()` is called or a route doesn't
 * match. Uses a minimal header (no auth-aware nav) so it works whether or
 * not the visitor is signed in.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border/60 bg-background/60 border-b backdrop-blur">
        <Container size="xl" className="flex h-16 items-center">
          <BrandMark />
        </Container>
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-6 py-16">
        <Container size="md">
          <Card>
            <CardContent className="space-y-6 p-10 text-center">
              <div className="bg-muted text-muted-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                <CompassIcon className="h-6 w-6" aria-hidden />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Page not found.</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  That URL doesn&rsquo;t point anywhere we know. Probably a typo, maybe a page
                  we&rsquo;ve moved. Jump to one of these, or head home and start from there.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild leadingIcon={<ArrowLeftIcon />}>
                  <Link href="/">Back to home</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/pricing">See pricing</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/samples">Sample reports</Link>
                </Button>
              </div>
              <p className="text-muted-foreground border-border/60 border-t pt-5 text-xs">
                Followed a link that should work? Let us know at{" "}
                <a
                  href={`mailto:${BRAND.email.support}`}
                  className="text-foreground font-medium underline-offset-2 hover:underline"
                >
                  {BRAND.email.support}
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </Container>
      </main>
    </div>
  );
}
