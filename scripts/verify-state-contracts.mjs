import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkStates } from './verify-states.mjs';

let count = 0;
for (const variant of ['night', 'day', 'contrast']) {
  const theme = JSON.parse(await readFile(new URL(`../themes/stillpoint-${variant}.json`, import.meta.url), 'utf8'));
  const checked = checkStates(theme, variant);
  assert.ok(checked.results.every(row => row.pass), `${variant}: baseline must pass`);
  assert.equal(checked.alphaInventory.length, Object.values(theme.colors).filter(value => value.length === 9).length);
  const rejects = (label, mutate, expected) => {
    const changed = structuredClone(theme);
    mutate(changed.colors, changed);
    assert.ok(checkStates(changed, variant).results.some(row => !row.pass && expected.test(row.label)), `${variant}: ${label} must fail`);
    count++;
  };
  rejects('transparent headers', colors => { colors['merge.currentHeaderBackground'] = '#00000000'; }, /header visibility/);
  rejects('invisible ruler marks', colors => { colors['editorOverviewRuler.currentContentForeground'] = '#00000000'; }, /explicit ruler mark/);
  rejects('identical selections', colors => { colors['editor.inactiveSelectionBackground'] = colors['editor.selectionBackground']; }, /active\/inactive selection separation/);
  rejects('invisible Explorer hover', colors => { colors['list.hoverBackground'] = colors['sideBar.background']; }, /hover visibility on sideBar/);
  rejects('hover equals selection', colors => { colors['list.hoverBackground'] = colors['list.activeSelectionBackground']; }, /hover\/activeSelection separation/);
  rejects('ghost as bright as comments', colors => { colors['editorGhostText.foreground'] = colors['descriptionForeground']; }, /ghost\/comment hierarchy/);
  rejects('bright-black as bright as primary text', colors => { colors['terminal.ansiBrightBlack'] = colors['terminal.foreground']; }, /bright-black\/terminal foreground hierarchy/);
  rejects('washed out gutter numbers', colors => { colors['editorLineNumber.foreground'] = colors['editor.background']; }, /editorLineNumber.foreground on inserted gutter/);
  rejects('collapsed diff hues', colors => { colors['diffEditor.removedLineBackground'] = colors['diffEditor.insertedLineBackground']; }, /insert\/remove/);
  if (variant === 'contrast') {
    rejects('faint Contrast selection', colors => { colors['editor.selectionBackground'] = '#253C49'; }, /editor.selectionBackground visibility/);
    assert.ok(checked.results.filter(row => row.label.startsWith('syntax ') && /editor\.(inactiveS|s)electionBackground/.test(row.label)).every(row => row.foreground === theme.colors['editor.selectionForeground']));
  } else {
    rejects('imperceptible unused fade', colors => { colors['editorUnnecessaryCode.opacity'] = '#000000F5'; }, /fades by at least/);
    rejects('unreadable unused fade', colors => { colors['editorUnnecessaryCode.opacity'] = '#00000020'; }, /unused .* on editor.background/);
    rejects('unreadable selected unused identifier', colors => { colors['editorUnnecessaryCode.opacity'] = '#00000020'; }, /selected unused variable/);
    for (const role of ['parameter', 'property', 'method', 'function', 'type']) {
      rejects(`unreadable selected unused ${role}`, (colors, changed) => {
        changed.semanticTokenColors[role].foreground = colors['editor.selectionBackground'];
      }, new RegExp(`selected unused ${role} on editor.selectionBackground`));
    }
    rejects('unreadable selected unused import comment', (colors, changed) => {
      changed.tokenColors.find(rule => [rule.scope].flat().includes('comment')).settings.foreground = colors['editor.selectionBackground'];
    }, /unused .* on editor.selectionBackground/);
    if (variant === 'day') for (const [role, previous] of [['parameter', '#374453'], ['property', '#293D4B']]) {
      rejects(`previous Day ${role}`, (colors, changed) => { changed.semanticTokenColors[role].foreground = previous; }, new RegExp(`selected unused ${role} on editor.selectionBackground`));
    }
  }
  // Never reintroduce a selection requirement for gutter or ghost foregrounds.
  assert.ok(!checked.results.some(row => /line.number|ghost|bright-black/i.test(row.label) && /selection/.test(row.label)));
  assert.ok(!checked.results.some(row => row.label.startsWith('unused ') && /header|gutter|hint/.test(row.label)));
}
console.log(`State-contract regressions: ${count} rejected mutations; consumer scopes and alpha inventory verified.`);
