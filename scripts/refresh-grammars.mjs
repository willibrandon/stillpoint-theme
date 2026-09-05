// Maintainer-only download; npm run check uses the committed copies offline.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../validation/grammars/', import.meta.url);
const manifestFile = new URL('manifest.json', root);
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
const record = process.argv.includes('--record-checksums');
const referenceIndex = process.argv.indexOf('--reference');
const reference = referenceIndex < 0 ? null : process.argv[referenceIndex + 1];
for (const entry of manifest.files) {
  assert.match(entry.ref, /^[a-f0-9]{40}$/, 'Only immutable commits may be downloaded');
  assert.ok(!entry.file.includes('..') && !entry.file.startsWith('/'));
  let content;
  if (reference && entry.repository === 'microsoft/vscode') {
    content = execFileSync('git', ['-C', reference, 'show', `${entry.ref}:${entry.path}`], { maxBuffer: 16 * 1024 * 1024 });
  } else {
    const response = await fetch(`https://raw.githubusercontent.com/${entry.repository}/${entry.ref}/${entry.path}`);
    if (!response.ok) throw new Error(`Download ${entry.path}: ${response.status}`);
    content = Buffer.from(await response.arrayBuffer());
  }
  const hash = createHash('sha256').update(content).digest('hex');
  if (!record) assert.equal(hash, entry.sha256, `Checksum: ${entry.file}`);
  entry.sha256 = hash;
  const target = new URL(entry.file, root);
  await mkdir(dirname(fileURLToPath(target)), { recursive: true });
  await writeFile(target, content);
  console.log(`Pinned ${entry.file}`);
}
if (record) await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
