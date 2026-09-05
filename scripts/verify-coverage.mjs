import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const registry = await read('validation/vscode-colors-1.136.1.json');
const manifest = await read('validation/accepted-defaults.json');
assert.equal(manifest.version, registry.version);
const reports = {};
const failures = [];
for (const variant of ['night', 'day', 'contrast']) {
  const theme = await read(`themes/stillpoint-${variant}.json`);
  reports[variant] = Object.entries(registry.colors)
    .filter(([key, registration]) => !Object.hasOwn(theme.colors, key) && registration.hexDefaults?.length)
    .map(([key, registration]) => {
      const reason = manifest.accepted[key];
      if (typeof reason !== 'string' || reason.trim().length < 20) failures.push(`${variant}: ${key}`);
      return { key, defaults: registration.defaults, hexDefaults: registration.hexDefaults, source: registration.source, reason: reason ?? null };
    });
}
for (const key of Object.keys(manifest.accepted)) assert.ok(registry.colors[key], `Unknown accepted default: ${key}`);
await mkdir(new URL('../output/reports/', import.meta.url), { recursive: true });
await writeFile(new URL('../output/reports/default-coverage.json', import.meta.url), JSON.stringify(reports, null, 2) + '\n');
console.log(`Default coverage: ${Object.entries(reports).map(([variant, rows]) => `${variant} ${rows.length} listed`).join(', ')}; ${failures.length} unreviewed.`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
