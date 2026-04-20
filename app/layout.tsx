import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SkipLink } from "@/components/shared/SkipLink";
import { BRAND } from "@/lib/brand";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — Cost segregation in minutes`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    title: `${BRAND.name} — Cost segregation in minutes`,
    description:
      "Turn your real-estate basis into year-one tax deductions. In minutes, not six weeks.",
  },
};

// Inline theme-init script. Runs before render to prevent a flash of the wrong theme.
// Defaults to LIGHT mode; only switches to dark if the user explicitly chose it.
const themeScript = `(function(){try{var t=localStorage.getItem('cs-theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-background text-foreground selection:bg-primary/20 flex min-h-full flex-col">
        <SkipLink />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
