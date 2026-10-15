import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BrainCircuit,
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
 * Receptionist modules, in the same order as the original project spec
 * (Check-in & Room Availability listed first — that's also where
 * /dashboard/reception redirects to by default).
 */
export const RECEPTIONIST_NAV: NavItem[] = [
  { label: "Check-in & Availability", href: "/dashboard/reception/checkin", icon: DoorOpen },
  { label: "Room Types", href: "/dashboard/reception/room-types", icon: BedDouble },
  { label: "View Bookings", href: "/dashboard/reception/bookings", icon: ClipboardList },
  { label: "Housekeeping", href: "/dashboard/reception/housekeeping", icon: Sparkles },
  { label: "Guest History", href: "/dashboard/reception/guests", icon: History },
  { label: "Revenue", href: "/dashboard/reception/revenue", icon: Wallet },
  { label: "AI Analytics", href: "/dashboard/reception/analytics", icon: BrainCircuit },
  { label: "Analysis", href: "/dashboard/reception/analysis", icon: BarChart3 },
];

/**
 * Manager/MD nav. "Hotel Settings" isn't one of Phase 5's 8 listed
 * placeholders, but it's a real page built in Phase 4 — linking to it here
 * is the natural, low-risk way to make it reachable now that a manager has
 * an actual shell instead of the login page's old placeholder button.
 */
export const MANAGER_NAV: NavItem[] = [
  { label: "MD Dashboard", href: "/dashboard/manager", icon: LayoutDashboard },
  { label: "Hotel Settings", href: "/settings/hotel", icon: Settings },
];