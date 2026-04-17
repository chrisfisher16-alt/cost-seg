import { AppHeader } from "@/components/app/AppHeader";
import { requireAuth } from "@/lib/auth/require";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader ctx={ctx} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
