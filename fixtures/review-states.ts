interface ScanResult {
  path: string;
  matches: number;
}

function inspect(path: string, limit: number): ScanResult {
  const unused = 'retained for the unused-code rendering check';
  return { path, matches: Math.min(limit, 24) };
}

const result = inspect('src/snapshot.ts', 128);
const label: string = 42;
console.log(`${result.path}: ${result.matches}`, label);

export {};
