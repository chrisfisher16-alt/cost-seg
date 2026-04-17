"use client";

import { useState } from "react";

/**
 * Collapsible <details>-style JSON inspector for the admin UI. Rendered as a
 * client component so callers can toggle open without a round-trip.
 */
export function JsonViewer({
  label,
  value,
  defaultOpen = false,
}: {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pretty = JSON.stringify(value, null, 2);
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        <span>{label}</span>
        <span className="font-mono text-[10px]">{open ? "▼" : "▶"}</span>
      </button>
      {open ? (
        <pre className="max-h-96 overflow-auto border-t border-zinc-200 bg-zinc-50 p-3 font-mono text-[10px] leading-snug dark:border-zinc-800 dark:bg-zinc-950">
          {pretty}
        </pre>
      ) : null}
    </div>
  );
}
