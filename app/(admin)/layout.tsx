import { AdminHeader } from "@/components/admin/AdminHeader";
import { requireRole } from "@/lib/auth/require";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole(["ADMIN"]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminHeader ctx={ctx} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
