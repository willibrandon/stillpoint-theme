import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { statePalette } from './state-palette.mjs';

const root = new URL('../', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const palettes = await read('palette.json');
const workbench = await read('mappings/workbench.json');
const textmate = await read('mappings/textmate.json');
const semantic = await read('mappings/semantic.json');
const checking = process.argv.includes('--check');

function theme(palette, variant) {
  const roles = { ...palette, ...statePalette(palette, variant) };
  const resolve = value => {
    if (!value.startsWith('$')) return value;
    const [role, alpha] = value.slice(1).split('/');
    if (!roles[role]) throw new Error(`Unknown role: ${value}`);
    return roles[role] + (alpha ?? '');
  };
  const colors = {};
  const assign = (key, value) => {
    if (Object.hasOwn(colors, key)) throw new Error(`Duplicate mapping: ${variant} ${key}`);
    const color = resolve(value);
    if (!/^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(color)) throw new Error(`Malformed color: ${key} ${color}`);
    colors[key] = color;
  };
  for (const { value, keys } of workbench.groups) for (const key of keys) assign(key, value);
  for (const [key, value] of Object.entries(workbench.variants[variant])) assign(key, value);
  const settings = value => ({
    ...value,
    ...(value.foreground ? { foreground: resolve(value.foreground) } : {})
  });
  return {
    $schema: 'vscode://schemas/color-theme',
    name: palette.name,
    semanticHighlighting: true,
    colors: Object.fromEntries(Object.entries(colors).sort(([a], [b]) => a.localeCompare(b))),
    tokenColors: textmate.map(rule => ({ ...rule, settings: settings(rule.settings) })),
    semanticTokenColors: Object.fromEntries(Object.entries(semantic).map(([selector, value]) => [selector, settings(value)]))
  };
}

await mkdir(new URL('themes/', root), { recursive: true });
await mkdir(new URL('dist/', root), { recursive: true });
const previewStates = {};
for (const [variant, palette] of Object.entries(palettes)) {
  const result = theme(palette, variant);
  previewStates[variant] = Object.fromEntries([
    ['diffInserted', 'diffEditor.insertedLineBackground'],
    ['diffRemoved', 'diffEditor.removedLineBackground'],
    ['focusedStackFrame', 'editor.focusedStackFrameHighlightBackground']
  ].map(([role, key]) => [role, result.colors[key]]));
  const file = new URL(`themes/stillpoint-${variant}.json`, root);
  if (checking) {
    const existing = JSON.parse(await readFile(file, 'utf8'));
    if (!isDeepStrictEqual(existing, result)) throw new Error(`Generated theme is stale: ${file.pathname}`);
  } else {
    await writeFile(file, JSON.stringify(result, null, 2) + '\n');
  }
  console.log(`${checking ? 'Verified' : 'Built'} ${palette.name}: ${Object.keys(result.colors).length} workbench colors, ${result.tokenColors.length} grammar rules, ${Object.keys(result.semanticTokenColors).length} semantic rules.`);
}
const previewFile = new URL('preview.html', root);
const preview = await readFile(previewFile, 'utf8');
const previewTag = `<script id="states" type="application/json">${JSON.stringify(previewStates)}</script>`;
const updated = preview.replace(/<script id="states" type="application\/json">.*?<\/script>/, previewTag);
if (checking && preview !== updated) throw new Error('Preview state colors are stale');
if (!checking) await writeFile(previewFile, updated);
