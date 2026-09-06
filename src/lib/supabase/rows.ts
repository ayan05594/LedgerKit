import "server-only";

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function snakeKey(key: string) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function fromSupabaseRows<T>(rows: unknown[] | null) {
  return (rows ?? []).map((row) =>
    Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, value]) => [
        camelKey(key),
        value,
      ]),
    ),
  ) as T[];
}

/** Convert a Drizzle-shaped object into the column names expected by PostgREST. */
export function toSupabaseRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [snakeKey(key), value]),
  );
}
