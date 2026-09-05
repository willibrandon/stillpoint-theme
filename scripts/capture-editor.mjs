// Run after connecting a Playwright CLI session to the isolated Electron host.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const cli = process.env.PLAYWRIGHT_CLI ?? 'playwright-cli';
const session = process.env.PLAYWRIGHT_SESSION ?? 'capture';
const invoke = (...args) => {
  const output = execFileSync(cli, [`-s=${session}`, ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (output.includes('### Error')) throw new Error(output);
  return output;
};
const scenes = process.env.CAPTURE_SCENES?.split(',') ?? ['diff', 'merge', 'inline-merge', 'selection', 'inactive-selection', 'unused', 'unused-selected', 'unused-roles', 'unused-roles-selected', 'unused-roles-inactive', 'hover', 'debugger', 'inlay', 'quickpick', 'graph', 'terminal', 'xml-docs', 'syntax'];
const xmlDocs = JSON.parse(await readFile('validation/xml-doc-cases.json', 'utf8'));
const palettes = JSON.parse(await readFile('palette.json', 'utf8'));
const syntaxCases = [
  { line: 'export interface', text: 'interface', role: 'keyword' },
  { line: 'export interface', text: 'ScanResult', role: 'type' },
  { line: 'readonly prefix', text: 'prefix', role: 'property' },
  { line: 'readonly prefix', text: "'snapshot'", role: 'string' },
  { line: 'read(path:', text: 'read', role: 'function' },
  { line: 'read(path:', text: 'path', role: 'parameter' },
  { line: 'read(path:', text: '128', role: 'number' },
  { line: 'const label', text: 'label', role: 'fg' },
  { line: '// Neutral prose', text: 'Neutral prose;', role: 'comment' }
];
// Match this macOS Retina host. A DPR mismatch shrinks xterm's canvas glyphs.
invoke('run-code', `async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 2, mobile: false });
  await cdp.detach();
}`);
for (const variant of process.argv.slice(2).length ? process.argv.slice(2) : ['night', 'day', 'contrast']) {
  for (const scene of scenes) {
    execFileSync(process.execPath, ['scripts/capture-scene.mjs', variant, scene]);
    let snapshot = invoke('snapshot');
    let snapshotPath = snapshot.match(/\]\((\.playwright-cli\/[^)]+)\)/)?.[1];
    if (!snapshotPath) throw new Error('Missing fresh accessibility snapshot');
    let tree = await readFile(snapshotPath, 'utf8');
    if (/dialog "Welcome to Visual Studio Code"/.test(tree)) throw new Error('Dismiss onboarding in the isolated profile before capturing');
    const maximize = scene === 'terminal' && tree.match(/button "Maximize Panel[^\n]*\[ref=(e\d+)\]/)?.[1];
    if (maximize) {
      invoke('click', maximize);
      snapshot = invoke('snapshot');
      snapshotPath = snapshot.match(/\]\((\.playwright-cli\/[^)]+)\)/)[1];
      tree = await readFile(snapshotPath, 'utf8');
    }
    const expected = {
      diff: /Review: range fills and word borders/,
      merge: /Conflict Remaining/,
      'inline-merge': /Accept Current Change/,
      selection: /review-states.ts/,
      'inactive-selection': /review-states.ts/,
      unused: /review-states.ts/,
      'unused-selected': /review-states.ts/,
      'unused-roles': /review-unused.ts/,
      'unused-roles-selected': /review-unused.ts/,
      'unused-roles-inactive': /review-unused.ts/,
      'xml-docs': /XmlDocumentation.cs/,
      syntax: /review-syntax.ts/,
      hover: /base.ts/,
      debugger: /Paused on debugger statement/,
      inlay: /review-states.ts/,
      quickpick: /Compare group labels, selection, and secondary text/,
      graph: /Inspect assembly snapshots/,
      terminal: /Stillpoint review/
    }[scene];
    if (!expected.test(tree)) throw new Error(`${variant} ${scene}: native scene not ready`);
    if (scene === 'hover') {
      const target = tree.match(/treeitem "base.ts[^\n]*\[ref=(e\d+)\]/)?.[1];
      if (!target) throw new Error('Missing fresh Explorer hover target');
      invoke('hover', target);
    } else invoke('run-code', 'async (page) => { await page.mouse.move(1590, 10); }');
    if (scene === 'debugger' && !/label, value 'SnapshotReader'/.test(tree)) throw new Error('Variables view is missing');
    const theme = JSON.parse(await readFile(`themes/stillpoint-${variant}.json`, 'utf8'));
    const evidence = invoke('run-code', `async (page) => {
      const expected = ${JSON.stringify(theme.colors['editor.background'])};
      const colors = ${JSON.stringify(theme.colors)};
      const semantic = ${JSON.stringify(theme.semanticTokenColors)};
      const result = await page.evaluate(colors => {
        const workbench = document.querySelector('.monaco-workbench');
        const visible = selector => [...document.querySelectorAll(selector)].filter(el => el.getBoundingClientRect().width > 0);
        return {
          editorBackground: getComputedStyle(workbench).getPropertyValue('--vscode-editor-background').trim(),
          tokenLines: ${scene === 'xml-docs' || scene === 'syntax'} ? visible('.view-line').map(line => [...line.querySelectorAll('span')].filter(span => !span.children.length).map(span => ({ text: span.textContent.replace(/\\u00a0/g, ' '), color: getComputedStyle(span).color }))) : [],
          selection: visible('.selected-text').length,
          selectionColors: visible('.selected-text').map(el => getComputedStyle(el).backgroundColor),
          selectedForegrounds: visible('.inline-selected-text').map(el => getComputedStyle(el).color),
          focusedEditors: visible('.monaco-editor.focused').length,
          unused: visible('.squiggly-inline-unnecessary').map(el => ({text: el.textContent, opacity: Number(getComputedStyle(el).opacity), color: getComputedStyle(el).color, overlapsSelection: visible('.selected-text').some(selection => {
            const a = el.getBoundingClientRect(), b = selection.getBoundingClientRect();
            return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          })})),
          hoveredRows: visible('.monaco-list-row:hover').map(el => ({text: el.textContent, background: getComputedStyle(el).backgroundColor, selected: el.classList.contains('selected')})),
          conflictLines: visible('.view-line').map(el => el.textContent).filter(text => /<<<<<<<|=======|>>>>>>>|\\|\\|\\|\\|\\|\\|\\|/.test(text)),
          conflictFills: visible('.cdr[class*="TextEditorDecorationType"]').map(el => getComputedStyle(el).backgroundColor),
          rulerMarks: Object.fromEntries(['current', 'incoming', 'common'].map(kind => {
            const rgb = colors['editorOverviewRuler.' + kind + 'ContentForeground'].slice(1).match(/../g).slice(0, 3).map(value => parseInt(value, 16));
            let pixels = 0;
            for (const canvas of visible('canvas.decorationsOverviewRuler')) {
              const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
              for (let i = 0; i < data.length; i += 4) if (data[i] === rgb[0] && data[i + 1] === rgb[1] && data[i + 2] === rgb[2] && data[i + 3]) pixels++;
            }
            return [kind, pixels];
          })),
          diagnostic: visible('.squiggly-error').length,
          terminalText: visible('.xterm-rows').map(el => el.textContent).join(' '),
          inlayHints: visible('.view-line [class*="dyn-rule-"]').filter(el => /path:|limit:|ScanResult/.test(el.textContent)).map(el => ({text: el.textContent, color: getComputedStyle(el).color})),
          lineNumbers: visible('.line-numbers').map(el => ({text: el.textContent, color: getComputedStyle(el).color, opacity: getComputedStyle(el).opacity})),
          diffGutters: visible('.gutter-insert, .gutter-delete').map(el => ({className: el.className, background: getComputedStyle(el).backgroundColor}))
        };
      }, colors);
      if (result.editorBackground.toUpperCase() !== expected) throw new Error('Wrong rendered theme: ' + result.editorBackground);
      const matchesColor = (rendered, hex) => {
        const expected = hex.slice(1).match(/../g).map(value => parseInt(value, 16));
        const actual = rendered.match(/[\\d.]+/g)?.map(Number) ?? [];
        return expected.slice(0, 3).every((value, i) => value === actual[i]) && Math.abs((actual[3] ?? 1) - (expected[3] ?? 255) / 255) < 0.011;
      };
      ${scene === 'selection' ? "if (!result.selection || !result.diagnostic) throw new Error('Selection and diagnostic must both be rendered');" : ''}
      ${scene === 'xml-docs' || scene === 'syntax' ? `
        const cases = ${JSON.stringify(scene === 'xml-docs' ? xmlDocs.cases : syntaxCases)};
        const palette = ${JSON.stringify(palettes[variant])};
        result.tokenColorChecks = 0;
        for (const item of cases) {
          const spans = result.tokenLines.find(line => line.map(span => span.text).join('').includes(item.line));
          if (!spans) throw new Error('Missing rendered fixture line: ' + item.line);
          const text = spans.map(span => span.text).join('');
          const start = text.indexOf(item.text);
          if (start < 0) throw new Error('Missing rendered fixture token: ' + item.text);
          let offset = 0;
          for (const span of spans) {
            const end = offset + span.text.length;
            if (offset < start + item.text.length && end > start && !matchesColor(span.color, palette[item.role])) throw new Error('Wrong rendered token color: ' + JSON.stringify({item, span}));
            offset = end;
          }
          result.tokenColorChecks++;
        }
      ` : ''}
      ${scene === 'inlay' ? "if (!result.inlayHints.length) throw new Error('Native inlay hints must be rendered');" : ''}
      ${scene === 'terminal' ? "if (!/diff.*--git/.test(result.terminalText) || !result.terminalText.includes('worker.service')) throw new Error('Both ls and git diff output must be visible');" : ''}
      ${scene === 'unused' || scene === 'unused-selected' ? `
        const unused = result.unused.find(item => item.text === 'unused');
        const alpha = parseInt(colors['editorUnnecessaryCode.opacity'].slice(7), 16) / 255;
        if (!unused || Math.abs(unused.opacity - alpha) > 0.002) throw new Error('Native unused opacity differs from generated theme');
        if (${scene === 'unused-selected'} && !unused.overlapsSelection) throw new Error('Unused identifier must overlap the native selection');
      ` : ''}
      ${scene.startsWith('unused-roles') ? `
        const selected = ${scene !== 'unused-roles'};
        const selectionKey = '${scene.endsWith('-inactive') ? 'editor.inactiveSelectionBackground' : 'editor.selectionBackground'}';
        const names = { unusedParameter: 'parameter', unusedProperty: 'property', unusedMethod: 'method', unusedFunction: 'function', UnusedType: 'type', unusedVariable: 'variable' };
        for (const [name, role] of Object.entries(names)) {
          const item = result.unused.find(item => item.text === name);
          const foreground = selected && colors['editor.selectionForeground'] ? colors['editor.selectionForeground'] : semantic[role].foreground;
          if (!item || !matchesColor(item.color, foreground)) throw new Error('Native unused role color must match: ' + role);
          if (selected && !item.overlapsSelection) throw new Error('Unused role must actually be selected: ' + role);
        }
        const ink = result.unused.filter(item => item.text.trim());
        if (!ink.some(item => item.text === 'import') || !ink.some(item => item.text.includes('unused') && item.text.includes('/*'))) throw new Error('Native unused import must include keyword and comment');
        if (ink.some(item => Math.abs(item.opacity - parseInt(colors['editorUnnecessaryCode.opacity'].slice(7), 16) / 255) > 0.002)) throw new Error('Native unused opacity must match');
        if (selected) {
          if (ink.some(item => !item.overlapsSelection)) throw new Error('Every unused import token and identifier must actually be selected');
          if (!result.selectionColors.every(fill => matchesColor(fill, colors[selectionKey]))) throw new Error('Native unused selection must match emitted state');
          if (${scene.endsWith('-inactive')} && result.focusedEditors) throw new Error('Unused inactive selection must be unfocused');
          const parse = css => css.startsWith('#') ? css.slice(1).match(/../g).map(value => parseInt(value, 16)) : css.match(/[\\d.]+/g).map(Number);
          const blend = (fg, bg, alpha = fg[3] ?? 1) => fg.slice(0, 3).map((value, i) => Math.round(value * alpha + bg[i] * (1 - alpha)));
          const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
          const background = blend(parse(result.selectionColors[0]), parse(result.editorBackground));
          result.unusedContrast = ink.filter(item => item.overlapsSelection).map(item => {
            const pair = [luminance(blend(parse(item.color), background, item.opacity)), luminance(background)].sort((a, b) => b - a);
            return { text: item.text, ratio: (pair[0] + .05) / (pair[1] + .05) };
          });
          if (result.unusedContrast.some(item => item.ratio < ${variant === 'contrast' ? 7 : 4.5})) throw new Error('Rendered selected unused contrast fails: ' + JSON.stringify(result.unusedContrast));
        }
      ` : ''}
      ${scene === 'inline-merge' ? `
        if (result.conflictLines.length !== 4 || result.conflictFills.length < 6) throw new Error('Native diff3 inline conflict is missing');
        if (Object.values(result.rulerMarks).some(count => count === 0)) throw new Error('Native conflict ruler marks must actually paint');
        for (const kind of ['current', 'incoming', 'common']) if (!result.conflictFills.some(fill => matchesColor(fill, colors['merge.' + kind + 'HeaderBackground']))) throw new Error('Native conflict header must paint the emitted fill');
      ` : ''}
      ${scene === 'inactive-selection' ? "if (!result.selection || result.focusedEditors || !result.selectionColors.every(fill => matchesColor(fill, colors['editor.inactiveSelectionBackground']))) throw new Error('Unfocused editor must paint the emitted inactive selection');" : ''}
      ${scene === 'selection' ? "if (!result.selectionColors.every(fill => matchesColor(fill, colors['editor.selectionBackground']))) throw new Error('Active selection must paint the emitted color');" : ''}
      ${scene === 'selection' && variant === 'contrast' ? "if (!result.selectedForegrounds.length || !result.selectedForegrounds.every(fg => matchesColor(fg, colors['editor.selectionForeground']))) throw new Error('Contrast selection must actually override syntax foregrounds');" : ''}
      ${scene === 'hover' ? "if (!result.hoveredRows.some(row => /base.ts/.test(row.text) && !row.selected && matchesColor(row.background, colors['list.hoverBackground']))) throw new Error('Unselected Explorer row must visibly hover');" : ''}
      return result;
    }`);
    invoke('screenshot', '--filename', `output/playwright/${variant}-${scene}.png`);
    const metadata = JSON.parse(await readFile(`output/playwright/${variant}-${scene}.json`, 'utf8'));
    if (scene === 'syntax' && !(metadata.semanticTokenCount > 0)) throw new Error('Syntax scene requires native semantic tokens');
    if (metadata.themeHash !== createHash('sha256').update(JSON.stringify(theme)).digest('hex')) throw new Error('Theme changed during capture');
    await writeFile(`output/playwright/${variant}-${scene}.evidence.txt`, snapshot + '\n' + evidence);
    console.log(`Captured and asserted ${variant} ${scene}`);
  }
}
