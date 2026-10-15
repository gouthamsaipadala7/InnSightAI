"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { RECEPTIONIST_NAV, MANAGER_NAV } from "./nav-config";

const COLLAPSE_STORAGE_KEY = "hms:sidebar-collapsed";

interface SidebarProps {
  role: "receptionist" | "manager";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  const navItems = role === "manager" ? MANAGER_NAV : RECEPTIONIST_NAV;

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border/70 bg-surface transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[76px]" : "w-72",
        !hydrated && "transition-none"
      )}
    >
        <Link
        href={navItems[0]?.href ?? "/login"}
        className="flex h-[72px] shrink-0 items-center border-b border-border/70 px-5"
      >
        {collapsed ? (
          <img src="/logo/icon-only.png" alt="InnSight AI" className="size-8" />
        ) : (
          <img
            src="/logo/logo-primary-navbar.png"
            alt="InnSight AI"
            className="h-9 w-auto"
          />
        )}
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3.5 rounded-lg px-3.5 py-3 text-sm transition-colors",
                isActive
                  ? "bg-emerald-soft font-medium text-emerald-hover"
                  : "text-graphite-600 hover:bg-graphite-100 hover:text-graphite-900"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200",
                  collapsed ? "max-w-0 opacity-0" : "max-w-[12rem] opacity-100"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/70 p-4">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-3.5 rounded-lg px-3.5 py-3 text-sm text-graphite-500 transition-colors hover:bg-graphite-100 hover:text-graphite-800"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5 shrink-0" />
          ) : (
            <PanelLeftClose className="size-5 shrink-0" />
          )}
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200",
              collapsed ? "max-w-0 opacity-0" : "max-w-[12rem] opacity-100"
            )}
          >
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}