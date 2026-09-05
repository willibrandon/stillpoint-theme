import { spawnSync } from 'node:child_process';

// Run every gate even during a test-first change, so one failure cannot hide others.
let failed = false;
for (const [script, ...args] of [
  ['scripts/build.mjs', '--check'],
  ['verify-palette.mjs'],
  ['scripts/verify-state-contracts.mjs'],
  ['scripts/verify-coverage.mjs'],
  ['scripts/verify.mjs'],
  ['scripts/verify-package.mjs']
]) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) console.error(result.error);
  failed ||= result.status !== 0;
}
process.exitCode = failed ? 1 : 0;
