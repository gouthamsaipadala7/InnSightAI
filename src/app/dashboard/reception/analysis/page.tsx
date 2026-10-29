"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMERALD = "#10B981";

export default function AnalysisPage() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ totalRevenue: number; totalBookings: number; avgRevenuePerGuest: number; roomTypeDistribution: { name: string; value: number }[]; momentum: { label: string; bookings: number }[] } | null>(null);

  async function load() {
    const res = await fetch(`/api/analysis?from=${from}&to=${to}`);
    setData(await res.json());
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-8 p-8 bg-[#FAFAFA]">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button onClick={load} className="h-10 rounded-md bg-[#10B981] px-4 text-sm font-medium text-white">Apply</button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-xs text-[#A1A1AA]">Total revenue</p>
              <p className="mt-1 text-2xl font-semibold text-[#18181B]">₹{(data.totalRevenue ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-xs text-[#A1A1AA]">Total bookings</p>
              <p className="mt-1 text-2xl font-semibold text-[#18181B]">{data.totalBookings}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-xs text-[#A1A1AA]">Avg revenue / guest</p>
              <p className="mt-1 text-2xl font-semibold text-[#18181B]">₹{data.avgRevenuePerGuest.toFixed(0)}</p>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-[#18181B] font-semibold mb-4">Room Type Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.roomTypeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="name" stroke="#71717A" fontSize={12} />
                  <YAxis stroke="#71717A" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E4E4E7" }} />
                  <Bar dataKey="value" fill={EMERALD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-[#18181B] font-semibold mb-4">Booking Momentum</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.momentum}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="label" stroke="#71717A" fontSize={12} />
                  <YAxis stroke="#71717A" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E4E4E7" }} />
                  <Line type="monotone" dataKey="bookings" stroke={EMERALD} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}