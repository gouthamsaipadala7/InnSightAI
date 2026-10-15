import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: session.hotelId } });

  if (!hotel) {
    redirect("/login");
  }

  if (hotel.setupCompleted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <CircleCheck className="size-8 text-emerald" />
            <p className="font-medium text-graphite-900">
              {hotel.name} has already completed setup.
            </p>
            <p className="text-sm text-muted-foreground">
              {session.role === "manager"
                ? "You can update these details anytime from Hotel Settings."
                : "Ask your manager if anything needs to change."}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Welcome — let&apos;s set up {hotel.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This one-time form configures your hotel&apos;s profile and rooms.
            You won&apos;t see it again after this.
          </p>
        </div>
        <OnboardingForm role={session.role} />
      </div>
    </main>
  );
}