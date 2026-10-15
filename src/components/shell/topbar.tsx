"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TopbarProps {
  hotelName: string;
  role: "receptionist" | "manager";
  name: string;
}

export function Topbar({ hotelName, role, name }: TopbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border/70 bg-surface px-8">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold leading-tight text-foreground">
          {hotelName}
        </p>
        <p className="mt-0.5 text-xs text-graphite-400">
          {role === "manager" ? "Managing Director" : "Receptionist"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-emerald-hover">
            {initials || "?"}
          </div>
          <span className="max-w-[10rem] truncate text-sm font-medium text-graphite-700">
            {name}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-5 text-graphite-400" />
        </Button>
      </div>
    </header>
  );
}