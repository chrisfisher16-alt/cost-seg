import "server-only";

import type { User as SupabaseUser } from "@supabase/supabase-js";

import { getPrisma } from "@/lib/db/client";
import type { User } from "@prisma/client";

/**
 * Just-in-time sync between Supabase Auth's `auth.users` and our Prisma
 * `User` table. Called from `requireAuth` so the app-layer User row always
 * exists for authenticated requests.
 *
 * We reuse the Supabase UUID as our `User.id` so that joins across
 * `Study`, `Property`, and `auth.users` all line up.
 */
export async function syncUser(supabaseUser: SupabaseUser): Promise<User> {
  const email = supabaseUser.email;
  if (!email) {
    throw new Error("Supabase user missing email — cannot sync to Prisma User.");
  }
  const displayName =
    (typeof supabaseUser.user_metadata?.full_name === "string" &&
      supabaseUser.user_metadata.full_name) ||
    (typeof supabaseUser.user_metadata?.name === "string" && supabaseUser.user_metadata.name) ||
    null;

  return getPrisma().user.upsert({
    where: { id: supabaseUser.id },
    update: {
      email,
      name: displayName,
    },
    create: {
      id: supabaseUser.id,
      email,
      name: displayName,
    },
  });
}
