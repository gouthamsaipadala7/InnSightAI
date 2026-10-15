"use client";
import { useEffect, useState } from "react";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Guest { id: string; name: string; phone: string; totalStays: number; lastCheckin: string | null; lastStatus: string | null; }

export default function GuestHistoryPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [showCheckedOutOnly, setShowCheckedOutOnly] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/guests").then((r) => r.json()).then((d) => setGuests(d.guests ?? [])).finally(() => setLoaded(true));
  }, []);

  const filtered = showCheckedOutOnly ? guests.filter((g) => g.lastStatus === "checked_out") : guests;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Guest History</h1>
        <p className="mt-1 text-sm text-muted-foreground">{guests.length} guests total</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setShowCheckedOutOnly(false)} className={cn("rounded-md px-3 py-1.5 text-sm", !showCheckedOutOnly ? "bg-emerald-soft text-emerald-hover font-medium" : "text-graphite-500")}>All guests</button>
        <button onClick={() => setShowCheckedOutOnly(true)} className={cn("rounded-md px-3 py-1.5 text-sm", showCheckedOutOnly ? "bg-emerald-soft text-emerald-hover font-medium" : "text-graphite-500")}>Checked-out only</button>
      </div>
      {!loaded ? (
        <TableSkeleton cols={5} />
      ) : (
        <div className="rounded-xl border border-border/70 bg-card shadow-soft">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Total stays</TableHead><TableHead>Last check-in</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium text-graphite-900">{g.name}</TableCell>
                  <TableCell>{g.phone}</TableCell>
                  <TableCell>{g.totalStays}</TableCell>
                  <TableCell>{g.lastCheckin ? new Date(g.lastCheckin).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{g.lastStatus === "active" ? "Active" : g.lastStatus === "checked_out" ? "Checked out" : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}