"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        className: "!bg-card !text-card-foreground !border-border !shadow-lg !rounded-md",
        duration: 4000,
      }}
      richColors
      closeButton
    />
  );
}
