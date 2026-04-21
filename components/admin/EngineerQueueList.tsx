"use client";

import { AlertCircleIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { adminBulkMarkFailedAction } from "@/app/(admin)/admin/studies/[id]/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { BULK_MARK_FAILED_CAP } from "@/lib/studies/admin-limits";

/**
 * Client-side selection wrapper around the engineer-queue row cards. The list
 * of rows is rendered server-side (keeps the main page a Server Component);
 * this component takes the pre-rendered row nodes as children along with
 * their IDs + addresses, overlays a checkbox per row, and surfaces a sticky
 * action bar when selection > 0.
 *
 * The only bulk action today is "mark failed" — see the comment on
 * adminBulkMarkFailedAction for why this is the only honest bulk action for
 * an AWAITING_ENGINEER queue (each sign-off needs a unique PDF).
 */
export function EngineerQueueList({
  items,
}: {
  items: Array<{
    id: string;
    /** Short summary shown in the confirmation dialog, e.g. "123 Main St · Austin, TX". */
    label: string;
    /** The pre-rendered row card (server-rendered) — we just wrap it with a checkbox. */
    node: React.ReactNode;
  }>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const selectedCount = selected.size;
  // Max rows the select-all button will pick up — the SERVER caps bulk
  // mark-failed at `BULK_MARK_FAILED_CAP`, so selecting more on the client
  // just wastes the admin's time filling out a reason that will bounce.
  const selectableCount = Math.min(items.length, BULK_MARK_FAILED_CAP);
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const cappedBySelectAll = items.length > BULK_MARK_FAILED_CAP;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    // Select the first `BULK_MARK_FAILED_CAP` items (the queue is ordered
    // oldest-first, so this is "the N most overdue"). Beyond the cap, admin
    // must do the remainder in a follow-up batch — a banner in the
    // select-all header signals the cap is active.
    setSelected(new Set(items.slice(0, BULK_MARK_FAILED_CAP).map((i) => i.id)));
  }

  // Stable label list for the dialog — we don't want to re-pull names while
  // the admin is typing a reason.
  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);

  return (
    <>
      {/* Select-all header — only shown when there's anything to act on. */}
      {items.length > 0 ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-dashed px-4 py-2 text-xs">
          <label className="text-muted-foreground inline-flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label={allSelected ? "Clear selection" : "Select all rows"}
            />
            <span>
              {selectedCount > 0
                ? `${selectedCount} selected`
                : `Select rows to act on ${items.length} in queue`}
              {cappedBySelectAll ? (
                <span className="text-muted-foreground/70 ml-1.5">
                  (select-all caps at {BULK_MARK_FAILED_CAP} per batch)
                </span>
              ) : null}
            </span>
          </label>
          {selectedCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/5"
              leadingIcon={<AlertCircleIcon />}
              onClick={() => setDialogOpen(true)}
            >
              Mark {selectedCount} failed
            </Button>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <Checkbox
              className="mt-5 ml-1"
              checked={selected.has(item.id)}
              onCheckedChange={() => toggle(item.id)}
              aria-label={`Select ${item.label}`}
            />
            <div className="min-w-0 flex-1">{item.node}</div>
          </li>
        ))}
      </ul>

      <BulkMarkFailedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedItems={selectedItems}
        onComplete={() => {
          setSelected(new Set());
          setDialogOpen(false);
        }}
      />
    </>
  );
}

function BulkMarkFailedDialog({
  open,
  onOpenChange,
  selectedItems,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: Array<{ id: string; label: string }>;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const ids = selectedItems.map((i) => i.id);
      const result = await adminBulkMarkFailedAction(ids, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const ok = result.results.filter((r) => r.ok).length;
      const failed = result.results.length - ok;
      if (failed === 0) {
        toast.success(`Marked ${ok} ${ok === 1 ? "study" : "studies"} failed`, {
          icon: <XCircleIcon className="h-4 w-4" />,
        });
      } else {
        // Honest partial-failure toast — admin can re-open individual studies
        // for details (the server wrote per-row StudyEvents for the successes).
        toast.warning(`Marked ${ok} failed, skipped ${failed}`, {
          description: result.results
            .filter((r) => !r.ok)
            .slice(0, 3)
            .map((r) => ("error" in r ? r.error : "unknown"))
            .join(" · "),
        });
      }
      setReason("");
      onComplete();
      router.refresh();
    });
  }

  // Dialog reuses the same copy contract as the single-study MarkFailedDialog
  // so admins reading StudyEvents don't see drift between singular + bulk flows.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Mark {selectedItems.length} {selectedItems.length === 1 ? "study" : "studies"} as failed
          </DialogTitle>
          <DialogDescription>
            Flips each selected study to <code className="font-mono">FAILED</code> with the reason
            you enter below, and writes one <code className="font-mono">admin.marked_failed</code>{" "}
            event per study (with <code className="font-mono">bulk: true</code> in the payload).
            Customers see the failure state on their pipeline pages. Refund in Stripe separately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {selectedItems.length > 0 ? (
            <div className="bg-muted/40 max-h-32 overflow-y-auto rounded-md border p-2 text-xs">
              <ul className="space-y-1">
                {selectedItems.map((i) => (
                  <li key={i.id} className="text-muted-foreground truncate">
                    {i.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Field
            label="Shared reason"
            required
            hint="Applied to every selected study. Keep it concise — it's the reason the customer sees."
          >
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Closing disclosure illegible after scan — needs resubmission."
              required
              minLength={3}
              maxLength={500}
            />
          </Field>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={isPending}
              loadingText="Marking…"
              disabled={selectedItems.length === 0}
            >
              Mark {selectedItems.length} failed
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
