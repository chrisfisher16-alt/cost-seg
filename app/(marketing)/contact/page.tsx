import type { Metadata } from "next";
import { MailIcon, MessageSquareIcon, PhoneIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <section className="pt-20 pb-24 sm:pt-28">
      <Container size="md" className="text-center">
        <Badge
          variant="outline"
          size="default"
          className="border-primary/30 bg-primary/5 text-primary mx-auto"
        >
          Contact
        </Badge>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          We read every message.
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
          Product questions, sales, press, partnerships — pick the channel that fits and we&rsquo;ll
          be back within one business day.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              Icon: MailIcon,
              label: "Email",
              value: "support@segra.tax",
              href: "mailto:support@segra.tax",
            },
            {
              Icon: MessageSquareIcon,
              label: "Sales",
              value: "sales@segra.tax",
              href: "mailto:sales@segra.tax",
            },
            { Icon: PhoneIcon, label: "Phone", value: "Coming soon", href: undefined },
          ].map(({ Icon, label, value, href }) => (
            <Card key={label}>
              <CardContent className="space-y-2 p-6 text-center">
                <div className="bg-primary/10 text-primary mx-auto inline-flex h-10 w-10 items-center justify-center rounded-lg">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                  {label}
                </p>
                {href ? (
                  <a
                    href={href}
                    className="text-foreground hover:text-primary block text-sm font-medium"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="text-foreground text-sm font-medium">{value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
