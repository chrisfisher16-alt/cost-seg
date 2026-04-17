import "server-only";

import type { Route } from "next";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { User, UserRole } from "@prisma/client";

import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

import { syncUser } from "./sync-user";

export interface AuthContext {
  supabaseUser: SupabaseUser;
  user: User;
}

/**
 * Require an authenticated user on a Server Component / Route Handler /
 * Server Action. Redirects to `/sign-in?next=<redirectTo>` when no session
 * is present.
 *
 * See ADR 0002 — this is the single enforcement point for authentication
 * on protected routes; every protected layout must call it.
 */
export async function requireAuth(redirectTo?: string): Promise<AuthContext> {
  const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";

  // In dev / preview without Supabase env, treat everyone as unauthenticated
  // and redirect to /sign-in, which surfaces a clear "not configured" banner.
  if (!isSupabaseConfigured()) {
    redirect(`/sign-in${next}` as Route);
  }

  const supabase = await createServerSupabase();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect(`/sign-in${next}` as Route);
  }

  const user = await syncUser(supabaseUser);
  return { supabaseUser, user };
}

/**
 * Require one of the given roles. Always runs `requireAuth` first. A
 * logged-in user without the right role is sent to `/dashboard` (we don't
 * surface the existence of admin pages to customers).
 */
export async function requireRole(roles: UserRole[], redirectTo?: string): Promise<AuthContext> {
  const ctx = await requireAuth(redirectTo);
  if (!roles.includes(ctx.user.role)) {
    redirect("/dashboard" as Route);
  }
  return ctx;
}

/**
 * Returns the auth context or `null` — non-redirecting variant. Use from
 * marketing pages / the Header to render auth-aware UI without blocking
 * unauthenticated visitors.
 */
export async function getOptionalAuth(): Promise<AuthContext | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();
    if (!supabaseUser) return null;
    const user = await syncUser(supabaseUser);
    return { supabaseUser, user };
  } catch {
    return null;
  }
}

/**
 * Ownership gate. Every read/write of a Study/Property/Document must either
 * match the caller's `userId` or be performed by an ADMIN. Throws — handlers
 * should let it propagate to a 500 (which we treat as an internal bug since
 * the earlier role gate should have prevented entry).
 */
export function assertOwnership(
  caller: { id: string; role: UserRole },
  resource: { userId: string },
): void {
  if (caller.role === "ADMIN") return;
  if (caller.id !== resource.userId) {
    throw new Error("Forbidden: resource does not belong to the caller.");
  }
}
