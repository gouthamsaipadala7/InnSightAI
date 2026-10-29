"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Room { id: string; roomNumber: string; roomTypeName: string; basePrice: number }
interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  roomNumber: string;
  checkinTime: string;
  checkoutTime: string | null;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");
const selectCls = "h-10 w-full rounded-md border border-input bg-surface px-3 text-sm";

export default function ReservationsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [advance, setAdvance] = useState("0");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<Reservation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const r = await fetch("/api/reservations/list", { cache: "no-store" });
    const d = await r.json();
    setList(d.reservations ?? []);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function search() {
    if (!from || !to) return toast.error("Choose both dates.");
    setSearching(true);
    try {
      const r = await fetch(`/api/availability?from=${from}&to=${to}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.details?.[0] ?? d.error ?? "Search failed.");
        setRooms(null);
        return;
      }
      setRooms(d.rooms);
      setRoomId("");
    } finally {
      setSearching(false);
    }
  }

  async function reserve() {
    if (!roomId) return toast.error("Select a room.");
    setSaving(true);
    try {
      const r = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name, phone, roomId, from, to, initialPayment: advance }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(`Reserved Room ${d.roomNumber}`);
        setName(""); setPhone(""); setAdvance("0");
        await Promise.all([search(), loadList()]);
      } else if (r.status === 409) {
        toast.error("Room already booked for this period.");
        search();
      } else {
        toast.error(d.details?.[0] ?? d.error ?? "Reservation failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, kind: "checkin" | "cancel" | "no_show") {
    setBusy(id + kind);
    try {
      const r =
        kind === "checkin"
          ? await fetch(`/api/reservations/${id}/checkin`, { method: "POST" })
          : await fetch(`/api/reservations/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: kind }),
            });
      const d = await r.json();
      if (r.ok) {
        toast.success(kind === "checkin" ? `Checked in to Room ${d.roomNumber}` : "Updated.");
        loadList();
      } else {
        toast.error(d.error ?? "Action failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reservations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Book rooms for future dates. Check-in and check-out are at 12:00.</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold text-graphite-700">New reservation</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><label className="text-xs text-graphite-500">Check-in date</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-graphite-500">Check-out date</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="flex items-end">
            <Button className="w-full" onClick={search} disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : "Find available rooms"}
            </Button>
          </div>
        </div>

        {rooms && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-graphite-500">Room ({rooms.length} available)</label>
              <select className={selectCls} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Select a room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} - {r.roomTypeName} - Rs {r.basePrice}
                  </option>
                ))}
              </select>
            </div>
            <div><label className="text-xs text-graphite-500">Guest name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="text-xs text-graphite-500">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label className="text-xs text-graphite-500">Advance payment</label>
              <Input type="number" min="0" value={advance} onChange={(e) => setAdvance(e.target.value)} /></div>
            <div className="flex items-end">
              <Button className="w-full" onClick={reserve} disabled={saving || !roomId || !name || !phone}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Reserve"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold text-graphite-700">Upcoming reservations ({list.length})</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming reservations.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-graphite-500">
                  <th className="py-2 pr-4">Guest</th><th className="pr-4">Phone</th><th className="pr-4">Room</th>
                  <th className="pr-4">Check-in</th><th className="pr-4">Check-out</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="py-2 pr-4">{r.customerName}</td>
                    <td className="pr-4">{r.phone}</td>
                    <td className="pr-4">{r.roomNumber}</td>
                    <td className="pr-4">{fmt(r.checkinTime)}</td>
                    <td className="pr-4">{fmt(r.checkoutTime)}</td>
                    <td className="flex gap-2 py-2">
                      <Button size="sm" disabled={!!busy} onClick={() => act(r.id, "checkin")}>Check in</Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        onClick={() => confirm("Cancel this reservation?") && act(r.id, "cancel")}>Cancel</Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        onClick={() => confirm("Mark as no-show?") && act(r.id, "no_show")}>No-show</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}