import { BadgeCheckIcon, LockIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";

const POINTS = [
  {
    icon: ShieldCheckIcon,
    title: "IRS Pub 5653-aligned",
    body: "Methodology follows the Audit Techniques Guide: Residual Estimation + RCNLD, Rev. Proc. 87-56, Treas. Reg. §1.167(a)-1.",
  },
  {
    icon: BadgeCheckIcon,
    title: "Engineer-signed option",
    body: "Licensed US Professional Engineer review and signature on every Tier-2 study. Audit-defensible under the ATG.",
  },
  {
    icon: LockIcon,
    title: "Your documents stay private",
    body: "Encrypted storage, signed-URL access, and full audit trail. Only you and your assigned engineer see them.",
  },
  {
    icon: ZapIcon,
    title: "Transparent AI pipeline",
    body: "Every classification traces back to a source document and a written rationale. No black-box numbers.",
  },
];

export function TrustStrip() {
  return (
    <section className="border-border/60 bg-muted/30 border-y py-12">
      <Container size="xl">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point) => (
            <li key={point.title} className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                <point.icon className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold">{point.title}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
