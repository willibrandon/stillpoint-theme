import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { listFiles, PackageManager } from '@vscode/vsce';

const files = await listFiles({
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  packageManager: PackageManager.None
});
assert.deepEqual(files.sort(), [
  'package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'assets/icon.png',
  'themes/stillpoint-night.json', 'themes/stillpoint-day.json', 'themes/stillpoint-contrast.json'
].sort(), 'VSIX source allowlist: no generators, fixtures, grammars, or private artifacts');
console.log('Package allowlist passed: 8 asset/metadata files, no runtime code.');
