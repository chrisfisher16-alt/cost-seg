import type { MetadataRoute } from "next";

/**
 * Dynamic robots.txt. We disallow crawling of authenticated/admin surfaces and
 * the on-demand PDF endpoint (not hidden, just not useful as a search result).
 * Set NEXT_PUBLIC_APP_URL in production so the sitemap references an absolute URL.
 */
export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/callback",
          "/dashboard",
          "/share/",
          "/studies/",
          "/get-started",
          "/get-started/",
        ],
      },
    ],
    sitemap: `${appUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
