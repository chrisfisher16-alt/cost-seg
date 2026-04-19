"use client";

import {
  CheckCircle2Icon,
  Clock3Icon,
  CopyIcon,
  MailIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  listSharesAction,
  revokeShareAction,
  shareStudyAction,
  type SerializableShareRow,
} from "@/app/(app)/studies/[id]/share/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  studyId: string;
  propertyLabel: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerSize?: "sm" | "default" | "lg" | "xl";
}

export function ShareStudyDialog({
  studyId,
  propertyLabel,
  triggerLabel = "Share with CPA",
  triggerVariant = "outline",
  triggerSize = "default",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [shares, setShares] = React.useState<SerializableShareRow[]>([]);
  const [shareUrls, setShareUrls] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = React.useState(false);

  async function loadShares() {
    const res = await listSharesAction(studyId);
    if (res.ok) {
      setShares(res.shares);
      setShareUrls(res.shareUrls);
    }
    setLoadedOnce(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !loadedOnce) void loadShares();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await shareStudyAction(studyId, { email, note: note || undefined });
      if (res.ok) {
        setShares((prev) => {
          const without = prev.filter((s) => s.id !== res.share.id);
          return [res.share, ...without];
        });
        setShareUrls((prev) => ({ ...prev, [res.share.id]: res.shareUrl }));
        setEmail("");
        setNote("");
        toast.success(`Invite sent to ${res.share.invitedEmail}`, {
          description: "Link is valid until you revoke it.",
          icon: <MailIcon className="h-4 w-4" />,
        });
      } else {
        setError(res.error);
      }
    });
  }

  async function onRevoke(shareId: string) {
    const res = await revokeShareAction(studyId, shareId);
    if (res.ok) {
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast("Access revoked");
    } else {
      toast.error("Couldn't revoke", { description: res.error });
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy — select and copy manually from the field.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} leadingIcon={<Share2Icon />}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share with your CPA</DialogTitle>
          <DialogDescription>
            Read-only access to the study for {propertyLabel}. They&rsquo;ll see property details,
            the asset schedule, the MACRS projection, and the PDF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field label="CPA email" required htmlFor="cpa-email">
            <Input
              id="cpa-email"
              type="email"
              required
              placeholder="priya@acmecpa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leadingAdornment={<MailIcon className="h-4 w-4" />}
            />
          </Field>
          <Field label="Note (optional)" hint="Appears in the invite email.">
            <Textarea
              rows={3}
              placeholder="Please review this before I file."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-destructive text-xs font-medium">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="sm" loading={isPending} loadingText="Sending invite…">
            Send invite
          </Button>
        </form>

        <div className="border-border mt-2 border-t pt-4">
          <p className="text-muted-foreground mb-3 font-mono text-xs tracking-[0.18em] uppercase">
            Current invites
          </p>
          {shares.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {loadedOnce ? "Nobody has been invited yet." : "Loading invites…"}
            </p>
          ) : (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="border-border bg-card flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <StatusIcon status={share.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{share.invitedEmail}</p>
                    <p className="text-muted-foreground text-xs">
                      {share.status === "ACCEPTED"
                        ? `Accepted ${share.acceptedAtIso ? new Date(share.acceptedAtIso).toLocaleDateString() : ""}`
                        : `Invited ${new Date(share.createdAtIso).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => copyLink(shareUrls[share.id] ?? "")}
                      aria-label="Copy share link"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onRevoke(share.id)}
                      aria-label="Revoke access"
                    >
                      <Trash2Icon className="text-muted-foreground hover:text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ status }: { status: SerializableShareRow["status"] }) {
  if (status === "ACCEPTED") {
    return (
      <span className="bg-success/10 text-success inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        <CheckCircle2Icon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
      )}
    >
      <Clock3Icon className="h-4 w-4" />
    </span>
  );
}
