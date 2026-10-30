import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BrainCircuit,
  CalendarPlus,
  ClipboardList,
  DoorOpen,
  History,
  LayoutDashboard,
  Settings,
  Sparkles,
  BedDouble,
  Wallet,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Receptionist modules. Check-in & Availability is listed first, and is
 * where /dashboard/reception redirects to by default.
 */
export const RECEPTIONIST_NAV: NavItem[] = [
  { label: "Check-in & Availability", href: "/dashboard/reception/checkin", icon: DoorOpen },
  { label: "Reservations", href: "/dashboard/reception/reservations", icon: CalendarPlus },
  { label: "Room Types", href: "/dashboard/reception/room-types", icon: BedDouble },
  { label: "View Bookings", href: "/dashboard/reception/bookings", icon: ClipboardList },
  { label: "Housekeeping", href: "/dashboard/reception/housekeeping", icon: Sparkles },
  { label: "Guest History", href: "/dashboard/reception/guests", icon: History },
  { label: "Revenue", href: "/dashboard/reception/revenue", icon: Wallet },
  { label: "AI Analytics", href: "/dashboard/reception/analytics", icon: BrainCircuit },
  { label: "Analysis", href: "/dashboard/reception/analysis", icon: BarChart3 },
];

/**
 * Manager/MD nav. Hotel Settings is a real page, linked here so a manager
 * can reach it from the shell.
 */
export const MANAGER_NAV: NavItem[] = [
  { label: "MD Dashboard", href: "/dashboard/manager", icon: LayoutDashboard },
  { label: "Hotel Settings", href: "/settings/hotel", icon: Settings },
];