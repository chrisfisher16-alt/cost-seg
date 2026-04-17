"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/observability/posthog-client";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);
  return children;
}
