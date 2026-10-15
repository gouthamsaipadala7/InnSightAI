import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { AuthError, requireRole } from "@/lib/session";
import { HotelSettingsForm } from "@/components/settings/hotel-settings-form";

export default async function HotelSettingsPage() {
  let session;
  try {
    session = await requireRole("manager");
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id: session.hotelId },
    include: { roomTypes: { orderBy: { createdAt: "asc" } } },
  });

  if (!hotel) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground">Hotel Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update {hotel.name}&apos;s profile and room inventory.
          </p>
        </div>
        <HotelSettingsForm
          hotel={{
            name: hotel.name,
            contactNumber: hotel.contactNumber,
            email: hotel.email,
            address: hotel.address,
          }}
          roomTypes={hotel.roomTypes.map((rt) => ({
            id: rt.id,
            category: rt.category,
            name: rt.name,
            count: rt.count,
            basePrice: Number(rt.basePrice),
          }))}
        />
      </div>
    </main>
  );
}