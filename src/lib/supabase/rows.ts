import "server-only";

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
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
