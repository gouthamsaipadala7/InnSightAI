import { redirect } from "next/navigation";
import Link from "next/link";

import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === "manager" ? "/dashboard/manager" : "/dashboard/reception/checkin");
  }

  return (
    <main className="flex h-screen items-center justify-center bg-[#09090B]">
      <div className="relative flex flex-col items-center">
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -z-10 size-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald/10 blur-[140px]"
        />
        <img
          src="/logo/logo-darkmode-navbar.png"
          alt="InnSight AI"
          className="w-[220px] sm:w-[260px] md:w-[340px]"
        />
        <p className="mt-6 text-sm font-normal uppercase tracking-[0.38em] text-[#A1A1AA]">
          Smarter stays. Higher returns.
        </p>
        <Button
          asChild
          className="mt-8 h-12 w-[180px] rounded-xl bg-emerald text-white shadow-[0_8px_24px_-4px_rgba(16,185,129,0.35)] transition-transform duration-200 hover:scale-[1.02] hover:bg-emerald-hover"
        >
          <Link href="/login">Log In</Link>
        </Button>
      </div>
    </main>
  );
}