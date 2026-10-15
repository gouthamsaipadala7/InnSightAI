"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Card {
  id: string;
  roomId: string;
  roomNumber: string;
  assignedStaff: string | null;
  board: "dirty" | "in_progress" | "completed" | "available";
}
interface AvailableStaff { id: string; name: string }
interface AssignedStaff { id: string; name: string; roomNumber: string }

const COLUMNS: { key: Card["board"]; label: string; dot: string }[] = [
  { key: "dirty", label: "Dirty", dot: "bg-graphite-500" },
  { key: "in_progress", label: "In Progress", dot: "bg-emerald animate-pulse" },
  { key: "completed", label: "Completed", dot: "bg-graphite-300" },
  { key: "available", label: "Available", dot: "bg-emerald" },
];

export default function HousekeepingPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([]);
  const [assignedStaff, setAssignedStaff] = useState<AssignedStaff[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

  async function fetchAll() {
    const [hkRes, staffRes] = await Promise.all([fetch("/api/housekeeping"), fetch("/api/staff")]);
    const hkData = await hkRes.json();
    const staffData = await staffRes.json();

    const next: Card[] = hkData.cards ?? [];
    setCards((prev) => {
      for (const c of next) {
        const before = prev.find((p) => p.roomId === c.roomId);
        if (before && before.board !== "completed" && c.board === "completed") {
          toast.success(`Room ${c.roomNumber} cleaning completed`);
        }
      }
      return next;
    });
    console.log("staff API response:", staffData);
    setAvailableStaff(staffData.available ?? []);
    setAssignedStaff(staffData.assigned ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleAssign(id: string, roomNumber: string) {
    const staffId = selections[id];
    if (!staffId) return;
    setAssigning(id);
    try {
      const res = await fetch(`/api/housekeeping/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.staffName} assigned to Room ${roomNumber}`);
        fetchAll();
      } else {
        toast.error(data.error ?? "Assignment failed.");
      }
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Housekeeping</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rooms move across automatically as their cleaning status changes.
        </p>
      </div>

      {assignedStaff.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-soft">
          <h2 className="mb-2 text-sm font-semibold text-graphite-700">Currently assigned staff</h2>
          <div className="flex flex-wrap gap-2">
            {assignedStaff.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1.5 rounded-full bg-emerald-soft px-3 py-1 text-xs font-medium text-emerald-hover"
              >
                <User className="size-3" />
                {s.name} — Room {s.roomNumber}
              </span>
            ))}
          </div>
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const colCards = cards.filter((c) => c.board === col.key);
            return (
              <div key={col.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn("size-2 rounded-full", col.dot)} />
                  <h2 className="text-sm font-semibold text-graphite-700">{col.label}</h2>
                  <span className="text-xs text-graphite-400">{colCards.length}</span>
                </div>

                <div className="flex flex-col gap-2 rounded-xl bg-graphite-50 p-2 min-h-[120px]">
                  {colCards.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border/70 bg-card p-3 shadow-soft">
                      <span className="font-medium text-graphite-900">Room {c.roomNumber}</span>

                                            {c.board === "dirty" && (
                        <div className="mt-3 flex flex-col gap-2">
                          <Select
                            value={selections[c.id] ?? ""}
                            onValueChange={(v) => setSelections((prev) => ({ ...prev, [c.id]: v }))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select staff" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableStaff.length === 0 ? (
                                <div className="px-2 py-4 text-center text-sm text-graphite-400">
                                  No staff available
                                </div>
                              ) : (
                                availableStaff.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            className="w-full"
                            disabled={assigning === c.id || !selections[c.id]}
                            onClick={() => handleAssign(c.id, c.roomNumber)}
                          >
                            {assigning === c.id ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Assigning…
                              </>
                            ) : (
                              <>
                                <User className="size-4" />
                                Assign
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {c.board === "in_progress" && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-graphite-500">
                          <Sparkles className="size-3.5" />
                          {c.assignedStaff} cleaning…
                        </p>
                      )}
                      {c.board === "completed" && <p className="mt-2 text-xs text-graphite-400">Just finished</p>}
                    </div>
                  ))}
                  {colCards.length === 0 && <p className="py-6 text-center text-xs text-graphite-300">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}