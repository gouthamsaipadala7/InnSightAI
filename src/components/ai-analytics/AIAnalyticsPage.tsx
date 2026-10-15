"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const EMERALD = "#10B981";
const EMERALD_LIGHT = "#10B98122";
const GRAPHITE = ["#3F3F46", "#71717A", "#A1A1AA", "#D4D4D8"];
const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";

type Window = "daily" | "monthly" | "yearly";
type PredictPoint = { period: string; date: string; actual: number | null; forecast: number | null; lower: number | null; upper: number | null; band?: number | null };

export default function AIAnalyticsPage({ hotelId }: { hotelId: string }) {
  const [window, setWindow] = useState<Window>("daily");
  const [predictData, setPredictData] = useState<PredictPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string[]>([]);
  const [explainLoading, setExplainLoading] = useState(false);

  const [occupancyData, setOccupancyData] = useState<{ label: string; bookings: number }[]>([]);
  const [roomTypeData, setRoomTypeData] = useState<{ name: string; value: number }[]>([]);
  const [spikeDates, setSpikeDates] = useState<Set<string>>(new Set());

    useEffect(() => {
    fetch(`/api/hotels/${hotelId}/occupancy`).then(r => r.json()).then(setOccupancyData).catch(() => {});
    fetch(`/api/hotels/${hotelId}/room-types`).then(r => r.json()).then(setRoomTypeData).catch(() => {});
    fetch(`/api/hotels/${hotelId}/spike-dates`).then(r => r.json()).then((dates: string[]) => setSpikeDates(new Set(dates))).catch(() => {});
  }, [hotelId]);

  useEffect(() => {
    setLoading(true);
    fetch(`${AI_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotel_id: hotelId, window }),
    })
      .then(r => r.json())
      .then((data: PredictPoint[]) =>
        setPredictData(data.map(d => ({ ...d, band: d.upper != null && d.lower != null ? d.upper - d.lower : null })))
      )
      .finally(() => setLoading(false));
  }, [hotelId, window]);

  async function handlePointClick(date: string) {
    if (!date) return;
    setSelectedDate(date);
    setExplainLoading(true);
    setExplanation([]);
    try {
      const res = await fetch(`${AI_SERVICE_URL}/explain?hotel_id=${hotelId}&date=${date}`);
      const data = await res.json();
      setExplanation(data.reasons || []);
    } catch {
      setExplanation(["Could not load explanation."]);
    } finally {
      setExplainLoading(false);
    }
  }

  return (
    <div className="space-y-8 p-8 bg-[#FAFAFA]">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-[#18181B] font-semibold mb-4">Daily / Weekly Bookings</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={occupancyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="label" stroke="#71717A" fontSize={12} />
              <YAxis stroke="#71717A" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E4E4E7" }} />
              <Bar dataKey="bookings" fill={EMERALD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-[#18181B] font-semibold mb-4">Room Type Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={roomTypeData} dataKey="value" nameKey="name" outerRadius={90} label>
                {roomTypeData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? EMERALD : GRAPHITE[i % GRAPHITE.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#18181B] font-semibold">Demand Prediction</h3>
          <div className="flex gap-2">
            {(["daily", "monthly", "yearly"] as Window[]).map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  window === w ? "bg-[#10B981] text-white" : "bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]"
                }`}
              >
                {w.charAt(0).toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart
            data={predictData}
            onClick={(e: any) => {
              const point = predictData.find(p => p.period === e?.activeLabel);
              if (point) handlePointClick(point.date);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
            <XAxis dataKey="period" stroke="#71717A" fontSize={12} />
            <YAxis stroke="#71717A" fontSize={12} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E4E4E7" }} />
            <Legend />
            {/* Invisible base at "lower" pushes the stacked band up to start at lower */}
            <Area type="monotone" dataKey="lower" stackId="band" stroke="none" fill="transparent" legendType="none" name="" connectNulls={false} />
            <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill={EMERALD_LIGHT} name="Confidence band" connectNulls={false} />
            <Line type="monotone" dataKey="actual" stroke="#3F3F46" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
                        <Line
              type="monotone"
              dataKey="forecast"
              stroke={EMERALD}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              name="Forecast"
              connectNulls={false}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                if (payload?.forecast == null) return <g key={index} />;
                if (spikeDates.has(payload.date)) {
                  return (
                    <g key={index}>
                      <circle cx={cx} cy={cy} r={6} fill={EMERALD} stroke="#fff" strokeWidth={2} />
                      <title>Detected spike period — {payload.date}</title>
                    </g>
                  );
                }
                return <circle key={index} cx={cx} cy={cy} r={3} fill={EMERALD} cursor="pointer" />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {selectedDate && (
          <div className="mt-4 p-4 bg-[#F4F4F5] rounded-lg">
            <p className="text-sm font-medium text-[#18181B] mb-2">Why this forecast — {selectedDate}</p>
            {explainLoading ? (
              <p className="text-sm text-[#A1A1AA]">Loading explanation...</p>
            ) : (
              <ul className="space-y-1">
                {explanation.map((line, i) => (
                  <li key={i} className="text-sm text-[#52525B]">• {line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {loading && <p className="text-sm text-[#A1A1AA] mt-2">Loading forecast...</p>}
      </section>
    </div>
  );
}