/**
 * Room-numbering conventions, shared between the one-time onboarding form
 * and the ongoing Hotel Settings page so both produce/extend room numbers
 * the same way.
 *
 * - standard → 101, 102, 103, ...
 * - deluxe   → 201, 202, 203, ...
 * - suite    → 301, 302, 303, ...
 * - each *custom*-named room type gets its own free hundred-block starting
 *   at 400 (first custom type → 401.., second custom type → 501.., ...),
 *   assigned in creation order per hotel.
 *
 * Numbers are never reused after a room is removed (see hotel settings'
 * shrink logic) — growth always continues from the current highest number
 * for that room type, not from the count. Real hotels don't renumber rooms
 * once assigned, and reusing a freed number risks confusion with historical
 * records that still reference the old room by number in guest-facing
 * contexts.
 */

export const FIXED_CATEGORY_PREFIX: Record<"standard" | "deluxe" | "suite", number> = {
  standard: 100,
  deluxe: 200,
  suite: 300,
};

/**
 * Prefix for a brand-new custom room type, given how many custom room types
 * this hotel already has. First custom type → 400, second → 500, etc.
 */
export function nextCustomPrefix(existingCustomTypeCount: number): number {
  return 400 + existingCustomTypeCount * 100;
}

/**
 * Builds `count` sequential room numbers starting right after
 * `currentMaxNumber` (pass 0 for a brand-new room type with no rooms yet).
 * `prefix` is the hundred-block (100/200/300/400/500/...); numbers are
 * simply prefix + 1, prefix + 2, ... continuing past whatever already
 * exists in that block.
 */
export function buildSequentialRoomNumbers(
  prefix: number,
  currentMaxNumber: number,
  count: number
): string[] {
  const start = Math.max(prefix, currentMaxNumber) + 1;
  return Array.from({ length: count }, (_, i) => String(start + i));
}