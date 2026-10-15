"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RevenuePage() {
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
    const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/revenue?${params}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setError(data?.error ?? `Request failed (${res.status})`);
        return;
      }

      setTotal(data.total ?? 0);
      setCount(data.count ?? 0);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Revenue</h1>
        <p className="mt-1 text-sm text-muted-foreground">Computed from completed checkouts only</p>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button onClick={load} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loaded && !error && (
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-soft">
            <p className="text-xs text-graphite-500">Total revenue</p>
            <p className="mt-1 text-2xl font-semibold text-graphite-900">₹{total.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-soft">
            <p className="text-xs text-graphite-500">Completed checkouts</p>
            <p className="mt-1 text-2xl font-semibold text-graphite-900">{count}</p>
          </div>
        </div>
      )}
    </div>
  );
}