interface Snapshot {
  readonly path: string;
  types: number;
  status: "ready" | "pending";
}

// Preserve the distinction between a type, a property, and a local value.
export async function inspect(path: string): Promise<Snapshot> {
  const response = await fetch(`/api/inspect?path=${encodeURIComponent(path)}`);
  if (!response.ok) throw new Error(`Inspection failed: ${response.status}`);

  const snapshot: Snapshot = await response.json();
  return { ...snapshot, status: "ready" };
}

export const DEFAULT_LIMIT = 128;
