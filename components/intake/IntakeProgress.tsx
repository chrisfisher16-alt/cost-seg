import type { DocumentKind } from "@prisma/client";

import { DOCUMENT_KIND_META } from "./meta";

interface Props {
  propertyReady: boolean;
  missingKinds: DocumentKind[];
  complete: boolean;
  processing: boolean;
}

export function IntakeProgress({ propertyReady, missingKinds, complete, processing }: Props) {
  if (processing) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        <p className="font-semibold">Processing has started.</p>
        <p className="mt-1">
          We&rsquo;re parsing your documents. You&rsquo;ll get an email when your report is ready.
        </p>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        <p className="font-semibold">All set — processing is queued.</p>
        <p className="mt-1">
          We received everything we need. Your pipeline will kick off within a minute.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-semibold">What&rsquo;s left</p>
      <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
        <li className="flex items-center gap-2">
          <Dot on={propertyReady} />
          Complete property details
        </li>
        {missingKinds.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <Dot on={false} />
            Upload {DOCUMENT_KIND_META[k].label.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={
        on
          ? "h-2 w-2 rounded-full bg-emerald-500"
          : "h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600"
      }
    />
  );
}
