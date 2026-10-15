"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Plus, Trash2 } from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = "standard" | "deluxe" | "suite" | "custom";

const CATEGORY_LABEL: Record<Category, string> = {
  standard: "Standard",
  deluxe: "Deluxe",
  suite: "Suite",
  custom: "Custom",
};

interface RoomTypeRow {
  id: string;
  category: Category;
  name: string;
  count: string;
  basePrice: string;
}

function newRow(category: Category = "standard"): RoomTypeRow {
  return {
    id: crypto.randomUUID(),
    category,
    name: category === "custom" ? "" : CATEGORY_LABEL[category],
    count: "",
    basePrice: "",
  };
}

interface SuccessSummary {
  totalRooms: number;
  roomTypes: Array<{ name: string; count: number; roomNumbers: string[] }>;
}

export function OnboardingForm({ role }: { role: "receptionist" | "manager" }) {
  const router = useRouter();
  const [hotelName, setHotelName] = useState("");
  const [employeesCount, setEmployeesCount] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([newRow()]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<SuccessSummary | null>(null);

  const totalRooms = roomTypes.reduce((sum, rt) => sum + (Number(rt.count) || 0), 0);

  function updateRow(id: string, patch: Partial<RoomTypeRow>) {
    setRoomTypes((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleCategoryChange(id: string, category: Category) {
    setRoomTypes((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const wasDefaultLabel = r.name === "" || r.name === CATEGORY_LABEL[r.category];
        return {
          ...r,
          category,
          name: wasDefaultLabel ? (category === "custom" ? "" : CATEGORY_LABEL[category]) : r.name,
        };
      })
    );
  }

  function addRow() {
    setRoomTypes((rows) => [...rows, newRow()]);
  }

  function removeRow(id: string) {
    setRoomTypes((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setLoading(true);

    try {
      const res = await fetch("/api/hotel/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelName,
          employeesCount: Number(employeesCount),
          contactNumber,
          email,
          address,
          roomTypes: roomTypes.map((rt) => ({
            category: rt.category,
            name: rt.name,
            count: Number(rt.count),
            basePrice: Number(rt.basePrice),
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? "Something went wrong."]);
        return;
      }

      setSuccess(data);
      toast.success("Hotel setup saved");
    } catch {
      setErrors(["Couldn't reach the server. Please try again."]);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="animate-in fade-in duration-300">
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex items-center gap-3 rounded-lg border border-emerald/20 bg-emerald-soft px-4 py-3">
            <CircleCheck className="size-5 shrink-0 text-emerald-hover" />
            <div className="text-sm">
              <p className="font-medium text-graphite-900">Setup complete</p>
              <p className="text-graphite-500">
                {success.totalRooms} rooms created across {success.roomTypes.length} room type
                {success.roomTypes.length === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {success.roomTypes.map((rt) => (
              <div key={rt.name} className="rounded-md border border-border/70 px-3 py-2 text-sm">
                <span className="font-medium text-graphite-800">{rt.name}</span>
                <span className="text-graphite-500"> — {rt.count} rooms: </span>
                <span className="text-graphite-500">{rt.roomNumbers.join(", ")}</span>
              </div>
            ))}
          </div>
                    <p className="text-xs text-graphite-400">
            Taking you to your dashboard…
          </p>
          <Button
            onClick={() =>
              router.push(role === "manager" ? "/dashboard/manager" : "/dashboard/reception/checkin")
            }
            className="w-full"
          >
            Continue to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <h2 className="text-sm font-semibold text-graphite-800">Hotel details</h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="hotelName">Hotel name</Label>
            <Input
              id="hotelName"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="employeesCount">Number of employees</Label>
              <Input
                id="employeesCount"
                type="number"
                min={1}
                value={employeesCount}
                onChange={(e) => setEmployeesCount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contactNumber">Contact number</Label>
              <Input
                id="contactNumber"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-graphite-800">Room types</h2>
            <span className="text-xs text-graphite-400">
              Total rooms: <span className="font-medium text-graphite-700">{totalRooms}</span>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {roomTypes.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_1fr_5rem_6rem_auto] items-end gap-2 rounded-lg border border-border/70 p-3"
              >
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={row.category}
                    onValueChange={(v) => handleCategoryChange(row.id, v as Category)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="deluxe">Deluxe</SelectItem>
                      <SelectItem value="suite">Suite</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    placeholder={row.category === "custom" ? "e.g. Poolside Villa" : undefined}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Count</Label>
                  <Input
                    type="number"
                    min={1}
                    value={row.count}
                    onChange={(e) => updateRow(row.id, { count: e.target.value })}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Base price</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.basePrice}
                    onChange={(e) => updateRow(row.id, { basePrice: e.target.value })}
                    required
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={roomTypes.length === 1}
                  aria-label="Remove room type"
                >
                  <Trash2 className="size-4 text-graphite-400" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addRow} className="w-fit">
            <Plus className="size-4" />
            Add room type
          </Button>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {errors.map((err, i) => (
            <span key={i}>{err}</span>
          ))}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Setting up…
          </>
        ) : (
          "Complete setup"
        )}
      </Button>
    </form>
  );
}