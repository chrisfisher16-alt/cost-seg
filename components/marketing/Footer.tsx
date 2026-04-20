import Link from "next/link";
import { ArrowUpIcon, MailIcon } from "lucide-react";

import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";

const FOOTER_SECTIONS: Array<{
  title: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}> = [
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/samples", label: "Sample reports" },
      { href: "/compare", label: "Compare providers" },
      { href: "/#estimator", label: "Free estimator" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/about", label: "About" },
      { href: "/partners", label: "For CPAs" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Trust & compliance",
    links: [
      { href: "/legal/scope-disclosure", label: "Scope disclosure" },
      { href: "/legal/methodology", label: "Methodology" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-border/60 bg-muted/30 mt-24 border-t">
      <Container size="xl" className="py-14">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="space-y-5">
            <BrandMark size="lg" />
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Cost segregation studies in minutes, not six weeks. Modeling reports for planning,
              engineer-signed studies for filing.
            </p>
            <div className="space-y-2 text-sm">
              <a
                href="mailto:support@costseg.app"
                className="text-foreground/80 hover:text-foreground inline-flex items-center gap-2 transition-colors"
              >
                <MailIcon className="h-3.5 w-3.5" aria-hidden />
                support@costseg.app
              </a>
            </div>
            <p className="text-muted-foreground text-xs">
              © {new Date().getFullYear()} Cost Seg. All rights reserved.
            </p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                  {section.title}
                </p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href as never}
                        className="text-foreground/80 hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-border/60 mt-12 flex flex-wrap items-start justify-between gap-6 border-t pt-6">
          <p className="text-muted-foreground max-w-4xl text-xs leading-relaxed">
            Estimates and AI Reports are planning tools produced by software. They are not
            engineered cost segregation studies under IRS Publication 5653 and should not be relied
            on for tax filings without CPA review. Engineer-Reviewed studies are signed by a
            US-licensed Professional Engineer contracted by Cost Seg. All product names and
            trademarks referenced on this site are property of their respective owners; no
            affiliation or endorsement is implied.
          </p>
          <a
            href="#main-content"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-xs font-medium underline-offset-4 transition-colors hover:underline"
          >
            <ArrowUpIcon className="h-3 w-3" aria-hidden />
            Back to top
          </a>
        </div>
      </Container>
    </footer>
  );
}
