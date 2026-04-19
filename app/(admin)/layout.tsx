import { headers } from "next/headers";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { requireRole } from "@/lib/auth/require";
import { PATHNAME_HEADER } from "@/proxy";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get(PATHNAME_HEADER) ?? undefined;
  const ctx = await requireRole(["ADMIN"], pathname);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminHeader ctx={ctx} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
