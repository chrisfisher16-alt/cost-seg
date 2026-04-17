import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </>
  );
}
