import type { MetadataRoute } from "next";

import { SAMPLE_IDS } from "@/lib/samples/catalog";

/**
 * Dynamic sitemap for the marketing surface. Authenticated + API routes are
 * excluded (robots.txt disallows them, but belt-and-suspenders).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: "weekly" | "monthly";
  }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/samples", priority: 0.8, changeFrequency: "weekly" },
    { path: "/compare", priority: 0.8, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/partners", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
    { path: "/legal/scope-disclosure", priority: 0.3, changeFrequency: "monthly" },
    { path: "/legal/methodology", priority: 0.3, changeFrequency: "monthly" },
    { path: "/legal/privacy", priority: 0.2, changeFrequency: "monthly" },
    { path: "/legal/terms", priority: 0.2, changeFrequency: "monthly" },
  ];

  const sampleRoutes = SAMPLE_IDS.map((id) => ({
    path: `/samples/${id}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }));

  return [...staticRoutes, ...sampleRoutes].map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
