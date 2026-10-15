"use client";

import { usePathname } from "next/navigation";

/**
 * Fade + slide entrance whenever the route changes.
 *
 * How it works: keying the wrapper div on `pathname` forces React to
 * unmount the old page and mount a fresh one on every navigation, which
 * replays the `animate-in` classes from scratch — a lightweight way to get
 * a consistent "page transition" feel without pulling in an animation
 * library.
 *
 * Trade-off worth knowing: this animates the *incoming* page in; it doesn't
 * cross-fade against the outgoing one (that would need something like
 * Framer Motion's AnimatePresence, or Next's experimental View Transitions
 * API — either is a reasonable upgrade later, but adds real complexity for
 * a "no abrupt changes" requirement that this simpler approach already
 * satisfies well enough).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {children}
    </div>
  );
}