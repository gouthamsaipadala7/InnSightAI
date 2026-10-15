"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, IndianRupee, BarChart3, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ManagerDashboardPage() {
  const [data, setData] = useState<{ bookingsToday: number; revenueToday: number } | null>(null);

  useEffect(() => {
  const load = () =>
    fetch("/api/dashboard/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); });
  load();
  const t = setInterval(load, 15000);
  return () => clearInterval(t);
}, []);

  const cards = [
    {
      key: "bookings",
      icon: CalendarCheck,
      label: "Today's bookings",
      value: data?.bookingsToday ?? "—",
      href: null,
    },
    {
      key: "revenue",
      icon: IndianRupee,
      label: "Today's revenue",
      value: `₹${(data?.revenueToday ?? 0).toLocaleString()}`,
      href: null,
    },
    { key: "analysis", icon: BarChart3, label: "View full Analysis →", href: "/dashboard/reception/analysis" },
    { key: "revenue-link", icon: Wallet, label: "View full Revenue →", href: "/dashboard/reception/revenue" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">MD Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Today at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        {cards.map((c, i) => {
          const Icon = c.icon;
          const content = (
            <Card
              className="glass-surface animate-in fade-in slide-in-from-bottom-1 hover:-translate-y-0.5 transition-transform"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-5 text-emerald-hover" />
                </div>
                {"value" in c ? (
                  <div>
                    <p className="text-xs text-graphite-500">{c.label}</p>
                    <p className="text-2xl font-semibold text-graphite-900">{c.value}</p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-graphite-800">{c.label}</p>
                )}
              </CardContent>
            </Card>
          );
          return c.href ? (
            <Link key={c.key} href={c.href}>
              {content}
            </Link>
          ) : (
            <div key={c.key}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}