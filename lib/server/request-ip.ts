import "server-only";

import { createHash } from "node:crypto";
import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

/**
 * Best-effort caller IP from proxy headers. On Vercel, `x-forwarded-for`
 * contains the original client; we take the first entry. Falls back to
 * `x-real-ip`. Returns "unknown" when nothing resolvable is present.
 */
export function resolveIp(headers: Headers | ReadonlyHeaders): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}
