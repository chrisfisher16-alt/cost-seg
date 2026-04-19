"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem("cs-theme", theme);
  } catch {
    /* noop */
  }
}

/**
 * Subscribe to the <html> element's class list so the icon stays in sync with
 * the inline theme-init script (which runs before React mounts) and with any
 * other tab toggling the theme.
 */
function subscribeToHtmlClass(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function readClientTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readServerTheme(): Theme {
  return "light"; // matches the server-rendered default; dark class is applied on the client.
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = React.useSyncExternalStore(subscribeToHtmlClass, readClientTheme, readServerTheme);

  function toggle() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={className}
    >
      {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </Button>
  );
}
