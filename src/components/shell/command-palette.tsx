"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, Search, UserRound } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { RECEPTIONIST_NAV, MANAGER_NAV } from "./nav-config";

interface Guest {
  id: string;
  name: string;
}
interface RoomLite {
  id: string;
  roomNumber: string;
}

export function CommandPalette({ role }: { role: "receptionist" | "manager" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<RoomLite[]>([]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lazy-load search data only once the palette is actually opened.
  useEffect(() => {
    if (!open || guests.length || rooms.length) return;
    fetch("/api/guests").then((r) => r.json()).then((d) => setGuests(d.guests ?? []));
    fetch("/api/rooms").then((r) => r.json()).then((d) => setRooms(d.rooms ?? []));
  }, [open, guests.length, rooms.length]);

  const runCommand = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  const navItems = role === "manager" ? MANAGER_NAV : RECEPTIONIST_NAV;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search guests, rooms, or jump to a page…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {role === "receptionist" && (
          <CommandGroup heading="Quick actions">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/dashboard/reception/checkin?new=1"))}
            >
              <DoorOpen className="size-4" />
              New check-in
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Navigate">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.href} onSelect={() => runCommand(() => router.push(item.href))}>
                <Icon className="size-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {role === "receptionist" && guests.length > 0 && (
          <CommandGroup heading="Guests">
            {guests.slice(0, 8).map((g) => (
              <CommandItem
                key={g.id}
                value={`guest ${g.name}`}
                onSelect={() =>
                  runCommand(() =>
                    router.push(`/dashboard/reception/bookings?search=${encodeURIComponent(g.name)}`)
                  )
                }
              >
                <UserRound className="size-4" />
                {g.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {role === "receptionist" && rooms.length > 0 && (
          <CommandGroup heading="Rooms">
            {rooms.slice(0, 8).map((r) => (
              <CommandItem
                key={r.id}
                value={`room ${r.roomNumber}`}
                onSelect={() =>
                  runCommand(() =>
                    router.push(`/dashboard/reception/checkin?highlight=${r.roomNumber}`)
                  )
                }
              >
                <Search className="size-4" />
                Room {r.roomNumber}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center justify-end border-t border-border/70 px-4 py-2">
        <CommandShortcut>Ctrl / ⌘ + K</CommandShortcut>
      </div>
    </CommandDialog>
  );
}