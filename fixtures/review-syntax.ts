export interface ScanResult {
  path: string;
  count: number;
}

// Neutral prose; colored syntax should be identifiable at a glance.
export class SnapshotReader {
  readonly prefix = 'snapshot';

  read(path: string, limit = 128): ScanResult {
    const label = `${this.prefix}: ${path}`;
    return { path: label, count: Math.min(limit, 64) };
  }
}

export const reader = new SnapshotReader();
export const result = reader.read('sample.dll');
