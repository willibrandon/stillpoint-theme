import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { colorDistance, oklab } from './color-math.mjs';

const roles = ['keyword', 'type', 'function', 'string', 'number', 'property', 'parameter'];

// Day-specific visual regression guard, not a WCAG or color-vision threshold.
// Neutral prose/operators and deliberately shared semantic roles are excluded.
export function checkSyntaxDistinction(theme) {
  const colors = Object.fromEntries(roles.map(role => [role, theme.semanticTokenColors[role].foreground]));
  const results = [];
  for (const [i, role] of roles.entries()) {
    for (const other of ['foreground', ...roles.slice(i + 1)]) {
      const actual = colorDistance(colors[role], other === 'foreground' ? theme.colors['editor.foreground'] : colors[other]);
      results.push({ pair: [role, other], actual, minimum: 0.075, pass: actual >= 0.075 });
    }
  }
  return results;
}

async function verify() {
  // Independent conversion sanity checks: neutral endpoints and sRGB red.
  for (const [color, expected] of [
    ['#000000', [0, 0, 0]], ['#FFFFFF', [1, 0, 0]],
    ['#FF0000', [0.627955, 0.224863, 0.125846]]
  ]) assert.ok(oklab(color).every((value, i) => Math.abs(value - expected[i]) < 0.000002));
  assert.equal(colorDistance('#003592', '#003592'), 0);
  const theme = JSON.parse(await readFile(new URL('../themes/stillpoint-day.json', import.meta.url), 'utf8'));
  const results = checkSyntaxDistinction(theme);
  for (const key of ['activityBar.foreground', 'icon.foreground', 'profileBadge.foreground', 'terminal.ansiWhite']) {
    assert.ok(Math.hypot(...oklab(theme.colors[key]).slice(1)) < 0.04, `${key}: keep generic chrome neutral`);
  }
  const failed = results.filter(row => !row.pass);
  assert.deepEqual(failed, [], 'Day syntax colors must remain distinguishable');
  const previous = { keyword: '#3F275F', type: '#003D39', function: '#15355A', string: '#2A3814', number: '#4A2C0F', property: '#233542', parameter: '#2A3440' };
  for (const mutation of ['previous palette', 'all neutral', 'identical type/string']) {
    const changed = structuredClone(theme);
    if (mutation === 'previous palette') {
      changed.colors['editor.foreground'] = '#26333D';
      for (const role of roles) changed.semanticTokenColors[role].foreground = previous[role];
    } else if (mutation === 'all neutral') {
      for (const role of roles) changed.semanticTokenColors[role].foreground = '#292B30';
    } else changed.semanticTokenColors.string.foreground = changed.semanticTokenColors.type.foreground;
    assert.ok(checkSyntaxDistinction(changed).some(row => !row.pass), mutation + ' must fail');
  }
  const directory = new URL('../output/reports/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('day-syntax-distinction.json', directory), JSON.stringify({
    method: 'Euclidean Oklab distance from generated semantic colors. Visual regression only, not accessibility certification.',
    results
  }, null, 2) + '\n');
  console.log(`Day syntax distinction: ${results.length} color pairs; 3 rejected regressions.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await verify();
