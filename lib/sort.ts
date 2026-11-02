export type SortDirection = "asc" | "desc";

/** Generic comparator: nulls/undefined sort last, numbers compare numerically, everything else as locale-aware strings. */
export function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
}

export function applySort<T>(
  items: T[],
  getValue: (item: T) => unknown,
  direction: SortDirection,
): T[] {
  const sorted = [...items].sort((a, b) => compareValues(getValue(a), getValue(b)));
  return direction === "asc" ? sorted : sorted.reverse();
}
