import "server-only";

function camelKey(key: string) {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [camelKey(key), camelize(child)]),
  );
}

export function fromSupabaseRows<T>(rows: unknown[] | null) {
  return camelize(rows ?? []) as T[];
}
