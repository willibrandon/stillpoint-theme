import { mkdir, mkdtemp, cp, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
await mkdir(new URL('output/', root), { recursive: true });
const workspace = await mkdtemp(fileURLToPath(new URL('output/editor-workspace-', root)));
await cp(new URL('fixtures/', root), workspace, { recursive: true });
const git = (...args) => execFileSync('git', ['-c', 'user.name=Stillpoint Review Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', '-C', workspace, ...args], { encoding: 'utf8' });
const base = 'export function inspect(path: string) {\n  const limit = 64;\n  const label = "snapshot";\n  return { path, limit, label };\n}\n';
const current = base.replace('64', '128').replace('"snapshot"', '"assembly"');
const incoming = base.replace('64', '256').replace('"snapshot"', '"module"');
for (const [name, content] of Object.entries({ 'review.ts': base, 'base.ts': base, 'current.ts': current, 'incoming.ts': incoming })) await writeFile(`${workspace}/${name}`, content);
git('init', '-q', '-b', 'main');
git('add', '.');
git('commit', '-qm', 'Add assembly inspection fixtures');
git('switch', '-qc', 'feature');
await writeFile(`${workspace}/review.ts`, incoming);
git('commit', '-qam', 'Inspect module snapshots');
git('switch', '-q', 'main');
await writeFile(`${workspace}/review.ts`, current);
git('commit', '-qam', 'Inspect assembly snapshots');
try { git('-c', 'merge.conflictStyle=diff3', 'merge', '--no-edit', 'feature'); } catch {
  if (!git('ls-files', '-u').trim()) throw new Error('Expected a fixture merge conflict');
}
// The three-way editor initializes its result working copy without markers.
// Keep a separate snapshot of the real Git conflict for the inline renderer.
await cp(`${workspace}/review.ts`, `${workspace}/review-inline.ts`);
await writeFile(`${workspace}/inspect.ts`, '// Review fixture: changed scan limit\n' + current);
await writeFile(new URL('output/editor-workspace.json', root), JSON.stringify({ workspace }, null, 2) + '\n');
console.log(workspace);
