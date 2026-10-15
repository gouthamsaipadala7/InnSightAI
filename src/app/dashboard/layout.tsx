import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Applies to every route under /dashboard/** (both /dashboard/reception/**
 * and /dashboard/manager/**) — one shell, one place to change it. proxy.ts
 * already blocks the wrong role from reaching these routes; this re-checks
 * the session anyway (defense in depth, same pattern as every other
 * protected page so far) since a layout should never assume middleware
 * definitely ran.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell role={session.role} hotelName={session.hotelName} name={session.name}>
      {children}
    </AppShell>
  );
}