import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, ClockIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";

import { DiyForm } from "@/components/intake/DiyForm";
import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";

export const metadata: Metadata = {
  title: "DIY Self-Serve study",
  description: "Enter your basis and land value — we generate your cost seg PDF instantly.",
};

type Props = { params: Promise<{ id: string }> };

async function loadStudy(studyId: string) {
  try {
    return await getPrisma().study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        userId: true,
        tier: true,
        status: true,
        pricePaidCents: true,
        createdAt: true,
        property: {
          select: {
            address: true,
            city: true,
            state: true,
            zip: true,
            purchasePrice: true,
            acquiredAt: true,
            propertyType: true,
            squareFeet: true,
            yearBuilt: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export default async function DiyIntakePage({ params }: Props) {
  const { id } = await params;
  const { user } = await requireAuth(`/studies/${id}/diy`);

  const study = await loadStudy(id);
  if (!study) notFound();
  assertOwnership(user, { userId: study.userId });

  if (study.tier !== "DIY") {
    notFound();
  }

  const entry = CATALOG[study.tier];
  const rawAddress = study.property.address.startsWith("(provided") ? "" : study.property.address;

  return (
    <Container size="xl" className="py-10 sm:py-14">
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title="Generate your DIY study"
        description="Two quick sections — property details, then basis + land value. Your PDF arrives instantly."
        meta={
          <>
            <Badge variant="default" size="sm">
              {entry.label}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {formatCents(study.pricePaidCents)} paid · Started{" "}
              {study.createdAt.toLocaleDateString()}
            </span>
          </>
        }
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <CardContent className="p-7">
              <DiyForm
                studyId={study.id}
                initial={{
                  address: rawAddress,
                  city: study.property.city,
                  state: study.property.state === "XX" ? "" : study.property.state,
                  zip: study.property.zip,
                  purchasePriceDollars:
                    Number(study.property.purchasePrice) > 0
                      ? Number(study.property.purchasePrice).toString()
                      : "",
                  acquiredAt: study.property.acquiredAt.toISOString().slice(0, 10),
                  propertyType: study.property.propertyType,
                  squareFeet: study.property.squareFeet,
                  yearBuilt: study.property.yearBuilt,
                }}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <SparklesIcon className="text-primary h-5 w-5" aria-hidden />
              <p className="text-sm font-medium">How DIY works</p>
              <ul className="text-muted-foreground space-y-2 text-xs leading-relaxed">
                <li>1. Enter basis + land value from your records.</li>
                <li>2. We allocate across MACRS classes using our property-type library.</li>
                <li>3. Your PDF generates instantly and emails to you.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="space-y-3 p-5">
              <ClockIcon className="text-primary h-4 w-4" aria-hidden />
              <p className="text-sm font-medium">Need the numbers?</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Your <strong>closing disclosure</strong> has the purchase price and capitalized
                closing costs. Your <strong>county assessor record</strong> shows the separate land
                value — search for your address on your county assessor&rsquo;s website.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="space-y-3 p-5">
              <ShieldCheckIcon className="text-primary h-4 w-4" aria-hidden />
              <p className="text-sm font-medium">Want the AI to read your docs?</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Upgrade to <strong>AI Report</strong> ($295) and we&rsquo;ll parse your closing
                disclosure, extract every line item, and build a per-asset schedule from your
                receipts and photos — no data entry required.
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="w-full"
                trailingIcon={<ArrowRightIcon />}
              >
                <Link href="/pricing">See upgrade options</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
