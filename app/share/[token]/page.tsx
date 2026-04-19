import type { Route } from "next";
import { redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";
import { Card, CardContent } from "@/components/ui/card";
import { getOptionalAuth } from "@/lib/auth/require";
import { acceptShareByToken } from "@/lib/studies/share";

export const metadata = { title: "Accept shared study" };

type Props = { params: Promise<{ token: string }> };

export default async function AcceptSharePage({ params }: Props) {
  const { token } = await params;
  const ctx = await getOptionalAuth();

  // Not signed in — send them to sign-in, then back here.
  if (!ctx) {
    const nextPath = `/share/${encodeURIComponent(token)}`;
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}` as Route);
  }

  try {
    const { studyId } = await acceptShareByToken(token, {
      id: ctx.user.id,
      role: ctx.user.role,
      email: ctx.user.email,
    });
    redirect(`/studies/${studyId}/view` as Route);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("NEXT_REDIRECT")) {
      // Next's redirect throws — let it propagate.
      throw err;
    }
    const message = err instanceof Error ? err.message : "Could not accept this invitation.";
    return <AcceptFailurePage message={message} />;
  }
}

function AcceptFailurePage({ message }: { message: string }) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-border/60 bg-background/60 border-b backdrop-blur">
        <Container size="xl" className="flex h-16 items-center">
          <BrandMark />
        </Container>
      </header>
      <div className="flex flex-1 items-center justify-center py-16">
        <Container size="sm">
          <Card>
            <CardContent className="space-y-6 p-8">
              <Alert variant="destructive">
                <AlertTitle>We couldn&rsquo;t open that share.</AlertTitle>
                <AlertDescription className="mt-2">{message}</AlertDescription>
              </Alert>
              <p className="text-muted-foreground text-sm">
                Ask the person who sent it to re-share — the link may have been revoked, or it was
                accepted on a different account.
              </p>
              <div className="flex gap-3">
                <Button asChild variant="outline">
                  <a href="/dashboard">Go to dashboard</a>
                </Button>
                <Button asChild variant="ghost">
                  <a href="mailto:support@costseg.app">Contact support</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Container>
      </div>
    </main>
  );
}
