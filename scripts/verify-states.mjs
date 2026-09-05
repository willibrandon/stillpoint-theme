import { readFile, writeFile } from 'node:fs/promises';
import { composite, hex, rgba, ratio, hueDistance, textRoles } from './color-math.mjs';

const root = new URL('../', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const palettes = await read('palette.json');
const results = [];
const add = (variant, label, actual, minimum, details = {}) => results.push({
  variant, label, ...details, minimum, actual: Number(actual.toFixed(4)), pass: actual >= minimum
});

for (const [variant, palette] of Object.entries(palettes)) {
  const { colors } = await read(`themes/stillpoint-${variant}.json`);
  const minimum = variant === 'contrast' ? 7 : 4.5;
  const editor = colors['editor.background'];
  const surfaceKeys = ['editor.background', 'sideBar.background', 'panel.background', 'editorWidget.background', 'editor.selectionBackground'];
  const surfaces = Object.fromEntries(surfaceKeys.map(key => [key, composite(colors[key], editor)]));
  const resolve = keys => keys.reduce((background, key) => {
    if (!colors[key]) throw new Error(`Missing state color: ${variant} ${key}`);
    return composite(colors[key], background);
  }, editor);
  const states = { ...surfaces };
  // Audit every shipped alpha value, not a second copy of the generator's alpha.
  for (const [key, value] of Object.entries(colors)) {
    if (value.length !== 9) continue;
    const background = key.startsWith('terminal.') ? colors['terminal.background'] : editor;
    const resolved = composite(value, background);
    add(variant, `alpha composition: ${key}`, ratio(resolved, background), 1, { value, background, resolved });
    // Slider thumbs, minimap marks and overview-ruler marks have no text on top.
    const textSurface = /^(editor\.|terminal\.|diffEditor\.|merge\.|mergeEditor\.|inlineEdit\.|inlineChatDiff\.|chat\.)/.test(key)
      && /Background$|\.background$/.test(key) && !/gutterIndicator/.test(key);
    if (textSurface) states[key] = resolved;
  }
  for (const kind of ['inserted', 'removed']) {
    states[`${kind} word on line`] = resolve([`diffEditor.${kind}LineBackground`, `diffEditor.${kind}TextBackground`]);
    states[`${kind} selected word`] = resolve([`diffEditor.${kind}LineBackground`, `diffEditor.${kind}TextBackground`, 'editor.selectionBackground']);
    const line = resolve([`diffEditor.${kind}LineBackground`]);
    add(variant, `${kind} line visibility`, ratio(line, editor), 1.38, { line, editor });
    const border = colors[`diffEditor.${kind}TextBorder`];
    add(variant, `${kind} word border exists`, border ? 1 : 0, 1);
    if (border) for (const surface of [editor, line, states[`${kind} word on line`]]) {
      add(variant, `${kind} word border contrast`, ratio(composite(border, surface), surface), 3);
    }
    const gutter = colors[`editorGutter.${kind === 'inserted' ? 'added' : 'deleted'}Background`];
    add(variant, `${kind} gutter contrast`, ratio(gutter, editor), 3);
  }
  const inserted = resolve(['diffEditor.insertedLineBackground']);
  const removed = resolve(['diffEditor.removedLineBackground']);
  add(variant, 'insert/remove luminance separation', ratio(inserted, removed), 1.08);
  add(variant, 'insert/remove hue separation (degrees)', hueDistance(inserted, removed), 45);
  for (const key of ['editor.selectionBackground', 'editor.inactiveSelectionBackground', 'list.activeSelectionBackground', 'list.inactiveSelectionBackground']) {
    const base = key.startsWith('list.') ? colors['sideBar.background'] : editor;
    add(variant, `${key} visibility`, ratio(composite(colors[key], base), base), variant === 'day' ? 1.38 : 1.3);
  }
  for (const kind of ['current', 'incoming', 'common']) {
    states[`merge ${kind} header on content`] = resolve([`merge.${kind}ContentBackground`, `merge.${kind}HeaderBackground`]);
    add(variant, `merge ${kind} content visibility`, ratio(resolve([`merge.${kind}ContentBackground`]), editor), 1.38);
  }
  for (const [label, background] of Object.entries(states)) {
    for (const role of [...textRoles, 'line']) add(variant, `${role} on ${label}`, ratio(palette[role], background), minimum, { foreground: palette[role], background });
  }
  const opacity = rgba(colors['editorUnnecessaryCode.opacity'] ?? '#000000FF')[3];
  if (variant !== 'contrast') {
    add(variant, 'unused code actually fades', opacity < 1 ? 1 : 0, 1);
    for (const [label, background] of Object.entries(states)) for (const role of textRoles) {
      add(variant, `unused ${role} on ${label}`, ratio(composite(hex(rgba(palette[role]), opacity), background), background), 4.5);
    }
  }
  if (variant === 'contrast') for (const key of ['editor.lineHighlightBorder', 'editor.selectionHighlightBorder']) {
    add(variant, `${key} exists`, colors[key] ? 1 : 0, 1);
    if (colors[key]) add(variant, `${key} state cue`, ratio(composite(colors[key], editor), editor), 3);
  }
  for (const [key, foreground] of [['button.background', colors['button.foreground']], ['statusBar.debuggingBackground', colors['statusBar.debuggingForeground']]]) {
    add(variant, `${key} text`, ratio(foreground, composite(colors[key], editor)), minimum);
  }
}

const failures = results.filter(check => !check.pass);
const report = {
  method: 'WCAG sRGB contrast; actual generated theme colors; alpha rounded to 8-bit before measurement. RGB hue angle complements luminance and native non-color cues; not a color-vision certification.',
  thresholds: { text: { night: 4.5, day: 4.5, contrast: 7 }, lineVisibility: 1.38, lineSeparation: 1.08, hueSeparationDegrees: 45, essentialCue: 3 },
  checks: results.length, failures, results
};
await writeFile(new URL('contrast-report.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(`Generated-color validation: ${results.length} checks; ${failures.length} failures.`);
for (const failure of failures.slice(0, 45)) console.error(`${failure.variant}: ${failure.label}: ${failure.actual} < ${failure.minimum}`);
if (failures.length) process.exitCode = 1;
