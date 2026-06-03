export function repr<T>(value: T | null | undefined, label?: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `Expected non-null value${label ? ` for ${label}` : ""}, got ${value === null ? "null" : "undefined"}`,
    );
  }
  return value;
}
