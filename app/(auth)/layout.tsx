import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border/60 bg-background/60 border-b backdrop-blur">
        <Container size="xl" className="flex h-16 items-center">
          <BrandMark />
        </Container>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
