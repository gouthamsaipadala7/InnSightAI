"use client";

import { useEffect, useState, useCallback } from "react";
import { DoorOpen, Loader2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  roomNumber: string;
  status: "available" | "occupied" | "dirty" | "cleaning";
  roomTypeId: string;
  roomTypeName: string;
}
interface RoomType {
  id: string;
  name: string;
  basePrice: number;
}

const STATUS_STYLE: Record<Room["status"], string> = {
  available: "border-emerald bg-emerald-soft text-emerald-hover",
  occupied: "border-graphite-700 bg-graphite-700 text-white",
  dirty: "border-graphite-300 bg-graphite-300 text-graphite-800",
  cleaning: "border-graphite-300 bg-graphite-100 text-graphite-500 animate-pulse",
};

const PULSE_STATUSES: Room["status"][] = ["occupied", "dirty"];

function floorOf(roomNumber: string): string {
  const digits = roomNumber.replace(/\D/g, "");
  return digits.length >= 3 ? digits[0] : "0";
}

const POLL_MS = 5000;

export default function CheckinPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkinTime, setCheckinTime] = useState(() => toLocalDateTimeInput(new Date()));
  const [initialPayment, setInitialPayment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const [highlightedRoom, setHighlightedRoom] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data.rooms);
      setRoomTypes(data.roomTypes);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchRooms]);

    useEffect(() => {
    if (searchParams.get("new") === "1") {
      openDialog();
    }
    const highlight = searchParams.get("highlight");
    if (highlight) {
      setHighlightedRoom(highlight);
      setTimeout(() => setHighlightedRoom(null), 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openDialog(room?: Room) {
    setErrors([]);
    setCustomerName("");
    setPhone("");
    setInitialPayment("");
    setCheckinTime(toLocalDateTimeInput(new Date()));
    setSelectedRoomTypeId(room?.roomTypeId ?? "");
    setSelectedRoomId(room?.id ?? "");
    setDialogOpen(true);
  }

  const availableRooms = rooms.filter((r) => r.status === "available");
  const roomsOfSelectedType = availableRooms.filter((r) => r.roomTypeId === selectedRoomTypeId);
  const typesWithAvailability = roomTypes.filter((rt) =>
    availableRooms.some((r) => r.roomTypeId === rt.id)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);

    try {
      const res = await fetch("/api/bookings/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          roomId: selectedRoomId,
          checkinTime: new Date(checkinTime).toISOString(),
          initialPayment: Number(initialPayment),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? "Something went wrong."]);
        return;
      }

      // Optimistic update — mark the room occupied immediately, don't wait
      // for the next poll tick.
      setRooms((prev) =>
        prev.map((r) => (r.id === selectedRoomId ? { ...r, status: "occupied" } : r))
      );
      toast.success(`Room ${rooms.find((r) => r.id === selectedRoomId)?.roomNumber ?? ""} checked in`);
      setDialogOpen(false);
    } catch {
      setErrors(["Couldn't reach the server. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Check-in & Availability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {availableRooms.length} of {rooms.length} rooms available
          </p>
        </div>
        <Button onClick={() => openDialog()} disabled={availableRooms.length === 0}>
          <Plus className="size-4" />
          New check-in
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-graphite-500">
        <Legend swatch="border-emerald bg-emerald-soft" label="Available" />
        <Legend swatch="border-graphite-700 bg-graphite-700" label="Occupied" />
        <Legend swatch="border-graphite-300 bg-graphite-300" label="Dirty" />
        <Legend swatch="border-graphite-300 bg-graphite-100" label="Cleaning" />
      </div>

                 {!loaded ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(
            rooms.reduce<Record<string, Room[]>>((acc, room) => {
              const floor = floorOf(room.roomNumber);
              (acc[floor] ??= []).push(room);
              return acc;
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([floor, floorRooms]) => (
              <div key={floor} className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-graphite-600">Floor {floor}</h2>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                  {floorRooms
                    .slice()
                    .sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber))
                    .map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        disabled={room.status !== "available"}
                        onClick={() => openDialog(room)}
                        title={`${room.roomNumber} — ${room.roomTypeName} (${room.status})`}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-sm font-medium shadow-soft transition-transform",
                          STATUS_STYLE[room.status],
                          highlightedRoom === room.roomNumber && "ring-2 ring-emerald ring-offset-2",
                          room.status === "available" &&
                            "hover:-translate-y-0.5 hover:shadow-soft-md cursor-pointer",
                          room.status !== "available" && "cursor-default"
                        )}
                      >
                        {PULSE_STATUSES.includes(room.status) && (
                          <span className="absolute right-1.5 top-1.5 flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-emerald" />
                          </span>
                        )}
                        <DoorOpen className="size-4" />
                        {room.roomNumber}
                      </button>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New check-in</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Room type</Label>
              <Select
                value={selectedRoomTypeId}
                onValueChange={(v) => {
                  setSelectedRoomTypeId(v);
                  setSelectedRoomId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a room type" />
                </SelectTrigger>
                <SelectContent>
                  {typesWithAvailability.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Room</Label>
              <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  {roomsOfSelectedType.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="customerName">Customer name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="initialPayment">Initial payment</Label>
                <Input
                  id="initialPayment"
                  type="number"
                  min={0}
                  step="0.01"
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="checkinTime">Check-in time</Label>
              <Input
                id="checkinTime"
                type="datetime-local"
                value={checkinTime}
                onChange={(e) => setCheckinTime(e.target.value)}
                required
              />
            </div>

            {errors.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errors.map((err, i) => (
                  <span key={i}>{err}</span>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting || !selectedRoomId}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Checking in…
                  </>
                ) : (
                  "Check in"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm border", swatch)} />
      {label}
    </span>
  );
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}