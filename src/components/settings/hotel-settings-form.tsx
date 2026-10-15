"use client";

import { useState } from "react";
import { CircleCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ExistingRoomType {
  id: string;
  category: string;
  name: string;
  count: number;
  basePrice: number;
}

interface NewRoomTypeRow {
  localId: string;
  name: string;
  count: string;
  basePrice: string;
}

interface HotelSettingsFormProps {
  hotel: {
    name: string;
    contactNumber: string;
    email: string;
    address: string;
  };
  roomTypes: ExistingRoomType[];
}

export function HotelSettingsForm({ hotel, roomTypes }: HotelSettingsFormProps) {
  const [hotelName, setHotelName] = useState(hotel.name);
  const [contactNumber, setContactNumber] = useState(hotel.contactNumber);
  const [email, setEmail] = useState(hotel.email);
  const [address, setAddress] = useState(hotel.address);

  const [existing, setExisting] = useState(
    roomTypes.map((rt) => ({
      id: rt.id,
      category: rt.category,
      name: rt.name,
      count: String(rt.count),
      basePrice: String(rt.basePrice),
    }))
  );
  const [newRows, setNewRows] = useState<NewRoomTypeRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ totalRooms: number } | null>(null);

  function updateExisting(id: string, patch: Partial<(typeof existing)[number]>) {
    setExisting((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addNewRow() {
    setNewRows((rows) => [
      ...rows,
      { localId: crypto.randomUUID(), name: "", count: "", basePrice: "" },
    ]);
  }

  function removeNewRow(localId: string) {
    setNewRows((rows) => rows.filter((r) => r.localId !== localId));
  }

  function updateNewRow(localId: string, patch: Partial<NewRoomTypeRow>) {
    setNewRows((rows) => rows.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/hotel/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelName,
          contactNumber,
          email,
          address,
          existingRoomTypes: existing.map((rt) => ({
            id: rt.id,
            name: rt.name,
            count: Number(rt.count),
            basePrice: Number(rt.basePrice),
          })),
          newRoomTypes: newRows.map((rt) => ({
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
      toast.success("Hotel settings updated");
      setNewRows([]); // new rows are now persisted — clear the "add" section
    } catch {
      setErrors(["Couldn't reach the server. Please try again."]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <h2 className="text-sm font-semibold text-graphite-800">Hotel profile</h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="hotelName">Hotel name</Label>
            <Input id="hotelName" value={hotelName} onChange={(e) => setHotelName(e.target.value)} required />
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="text-sm font-semibold text-graphite-800">Room types</h2>

          <div className="flex flex-col gap-3">
            {existing.map((rt) => (
              <div
                key={rt.id}
                className="grid grid-cols-[5rem_1fr_5rem_6rem] items-end gap-2 rounded-lg border border-border/70 p-3"
              >
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Category</Label>
                  <div className="flex h-10 items-center rounded-md bg-graphite-100 px-3 text-sm capitalize text-graphite-500">
                    {rt.category}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input value={rt.name} onChange={(e) => updateExisting(rt.id, { name: e.target.value })} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Count</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rt.count}
                    onChange={(e) => updateExisting(rt.id, { count: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Base price</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rt.basePrice}
                    onChange={(e) => updateExisting(rt.id, { basePrice: e.target.value })}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-graphite-400">
            Lowering a room&apos;s count only removes rooms with no booking history and that
            aren&apos;t currently occupied or dirty — if too few qualify, the change is rejected
            with an explanation and nothing is changed.
          </p>

          {newRows.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
              <p className="text-xs font-medium text-graphite-600">New room types</p>
              {newRows.map((row) => (
                <div
                  key={row.localId}
                  className="grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2 rounded-lg border border-emerald/20 bg-emerald-soft/40 p-3"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={row.name}
                      onChange={(e) => updateNewRow(row.localId, { name: e.target.value })}
                      placeholder="e.g. Poolside Villa"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Count</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.count}
                      onChange={(e) => updateNewRow(row.localId, { count: e.target.value })}
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
                      onChange={(e) => updateNewRow(row.localId, { basePrice: e.target.value })}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeNewRow(row.localId)}
                    aria-label="Remove new room type"
                  >
                    <Trash2 className="size-4 text-graphite-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" onClick={addNewRow} className="w-fit">
            <Plus className="size-4" />
            Add a new room type
          </Button>
        </CardContent>
      </Card>

      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald/20 bg-emerald-soft px-4 py-3 text-sm">
          <CircleCheck className="size-5 shrink-0 text-emerald-hover" />
          <span className="text-graphite-800">
            Saved — hotel now has {success.totalRooms} total rooms.
          </span>
        </div>
      )}

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
            Saving…
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
}