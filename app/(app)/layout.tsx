import { headers } from "next/headers";

import { AppHeader } from "@/components/app/AppHeader";
import { requireAuth } from "@/lib/auth/require";
import { PATHNAME_HEADER } from "@/proxy";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get(PATHNAME_HEADER) ?? undefined;
  const ctx = await requireAuth(pathname);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader ctx={ctx} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
