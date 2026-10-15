"use client";

import { useEffect, useState } from "react";
import { BedDouble, Check, Crown, Sparkles, Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface RoomType {
  id: string;
  name: string;
  basePrice: number;
}
interface Room {
  id: string;
  roomTypeId: string;
  status: "available" | "occupied" | "dirty" | "cleaning";
}

const ICONS = [BedDouble, Star, Crown, Sparkles];
const TINTS = [
  { bg: "from-graphite-50 to-graphite-100", ring: "ring-graphite-300", icon: "text-graphite-500", chip: "bg-graphite-800" },
  { bg: "from-emerald-soft to-emerald-soft/40", ring: "ring-emerald/40", icon: "text-emerald-hover", chip: "bg-emerald-hover" },
  { bg: "from-graphite-100 to-graphite-200", ring: "ring-graphite-400", icon: "text-graphite-700", chip: "bg-graphite-900" },
  { bg: "from-emerald-soft/70 to-graphite-100", ring: "ring-emerald/30", icon: "text-emerald", chip: "bg-emerald" },
];

export default function RoomTypesPage() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data) => {
        setRoomTypes(data.roomTypes ?? []);
        setRooms(data.rooms ?? []);
        if (data.roomTypes?.length) setSelected(data.roomTypes[0].id);
      })
      .finally(() => setLoaded(true));
  }, []);

  const selectedTint = selected
    ? TINTS[roomTypes.findIndex((rt) => rt.id === selected) % TINTS.length]
    : TINTS[0];

  return (
    <div
      className={cn(
        "-m-8 flex min-h-[calc(100vh-72px)] flex-col gap-8 bg-gradient-to-br p-8 transition-colors duration-500",
        selectedTint.bg
      )}
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">Room Types</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Show a guest what&apos;s available and at what price — tap a room type to preview it.
        </p>
      </div>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading room types…</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {roomTypes.map((rt, i) => {
            const Icon = ICONS[i % ICONS.length];
            const tint = TINTS[i % TINTS.length];
            const availableCount = rooms.filter(
              (r) => r.roomTypeId === rt.id && r.status === "available"
            ).length;
            const isSelected = selected === rt.id;

            return (
              <button
                key={rt.id}
                type="button"
                onClick={() => setSelected(rt.id)}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-2xl border bg-surface text-left shadow-soft transition-all duration-300",
                  isSelected
                    ? cn("ring-2 shadow-soft-lg", tint.ring)
                    : "border-border/70 hover:-translate-y-1 hover:shadow-soft-md"
                )}
              >
                <div
                  className={cn(
                    "flex h-40 items-center justify-center bg-gradient-to-br transition-transform duration-300 group-hover:scale-105",
                    tint.bg
                  )}
                >
                  <Icon className={cn("size-16", tint.icon)} strokeWidth={1.25} />
                </div>

                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-graphite-900">{rt.name}</h3>
                    {isSelected && (
                      <span className={cn("flex size-5 items-center justify-center rounded-full text-white", tint.chip)}>
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-semibold text-graphite-900">
                    ₹{rt.basePrice.toLocaleString()}
                    <span className="text-sm font-normal text-graphite-400"> / night</span>
                  </p>
                  <p className="text-xs text-graphite-500">
                    {availableCount} room{availableCount === 1 ? "" : "s"} available now
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}