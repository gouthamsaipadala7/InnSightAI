"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Loader2, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Booking {
  id: string;
  customerName: string;
  phone: string;
  roomNumber: string;
  roomType: string;
  checkinTime: string;
  checkoutTime: string | null;
  initialPayment: number;
  totalAmount: number | null;
  status: "active" | "checked_out";
}

type SortKey = "customerName" | "roomNumber" | "checkinTime" | "status";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("checkinTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => setBookings(data.bookings ?? []))
      .finally(() => setLoaded(true));
  }, []);
    useEffect(() => {
    const q = searchParams.get("search");
    if (q) setSearch(q);
  }, [searchParams]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = bookings;
    if (q) {
      rows = rows.filter(
        (b) =>
          b.customerName.toLowerCase().includes(q) || b.roomNumber.toLowerCase().includes(q)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "checkinTime") {
        cmp = new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime();
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey]);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [bookings, search, sortKey, sortDir]);

  async function handleCheckout() {
    if (!selected) return;
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch(`/api/bookings/${selected.id}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error ?? "Checkout failed.");
        return;
      }
            setBookings((prev) =>
        prev.map((b) => (b.id === selected.id ? { ...b, status: "checked_out" } : b))
      );
      toast.success(`${selected.customerName} checked out — room ${selected.roomNumber}`);
      setSelected(null);
    } catch {
      setCheckoutError("Couldn't reach the server.");
    } finally {
      setCheckingOut(false);
    }
  }

  function SortHeader({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKeyName)}
        className="flex items-center gap-1 hover:text-graphite-800"
      >
        {label}
        <ArrowUpDown
          className={cn("size-3", sortKey === sortKeyName ? "text-emerald" : "text-graphite-300")}
        />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">View Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"} for this hotel
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-graphite-400" />
        <Input
          placeholder="Search by customer name or room number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {!loaded ? (
        <TableSkeleton cols={7} />
      ) : (
        <div className="rounded-xl border border-border/70 bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead><SortHeader label="Customer" sortKeyName="customerName" /></TableHead>
                <TableHead>Phone</TableHead>
                <TableHead><SortHeader label="Room" sortKeyName="roomNumber" /></TableHead>
                <TableHead>Room type</TableHead>
                <TableHead><SortHeader label="Check-in" sortKeyName="checkinTime" /></TableHead>
                <TableHead><SortHeader label="Status" sortKeyName="status" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs text-graphite-500">
                    {b.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium text-graphite-900">{b.customerName}</TableCell>
                  <TableCell>{b.phone}</TableCell>
                  <TableCell>{b.roomNumber}</TableCell>
                  <TableCell>{b.roomType}</TableCell>
                  <TableCell>{new Date(b.checkinTime).toLocaleString()}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        b.status === "active"
                          ? "bg-emerald-soft text-emerald-hover"
                          : "bg-graphite-100 text-graphite-500"
                      )}
                    >
                      {b.status === "active" ? "Active" : "Checked out"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-graphite-500">
                    No bookings match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setCheckoutError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col gap-3 text-sm">
              <Row label="Booking ID" value={selected.id} mono />
              <Row label="Customer" value={selected.customerName} />
              <Row label="Phone" value={selected.phone} />
              <Row label="Room" value={`${selected.roomNumber} (${selected.roomType})`} />
              <Row label="Check-in" value={new Date(selected.checkinTime).toLocaleString()} />
              <Row
                label="Check-out"
                value={selected.checkoutTime ? new Date(selected.checkoutTime).toLocaleString() : "—"}
              />
              <Row label="Initial payment" value={selected.initialPayment.toFixed(2)} />
              <Row
                label="Total amount"
                value={selected.totalAmount !== null ? selected.totalAmount.toFixed(2) : "—"}
              />
              <Row label="Status" value={selected.status === "active" ? "Active" : "Checked out"} />

              {checkoutError && (
                <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive">
                  {checkoutError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={selected?.status !== "active" || checkingOut}
              onClick={handleCheckout}
            >
              {checkingOut ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Checking out…
                </>
              ) : (
                "Check out"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2">
      <span className="text-graphite-500">{label}</span>
      <span className={cn("font-medium text-graphite-900", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}