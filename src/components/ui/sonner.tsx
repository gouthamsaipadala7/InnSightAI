"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-surface text-foreground border border-border/70 shadow-soft-lg rounded-lg",
          description: "text-muted-foreground",
          success: "!border-emerald/30 [&_[data-icon]]:text-emerald",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-graphite-100 !text-graphite-600",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };