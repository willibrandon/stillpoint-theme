import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { composite, hex, rgba, ratio, hueDistance } from './color-math.mjs';

// Consumer contracts, not a Cartesian product of palette roles and surfaces.
// Inputs are emitted JSON; neither washes nor alpha are regenerated here.
export function checkStates(theme, variant) {
  const { colors } = theme;
  const results = [], alphaInventory = [];
  const minimum = variant === 'contrast' ? 7 : 4.5;
  const color = key => {
    if (!colors[key]) throw new Error(`Missing state color: ${variant} ${key}`);
    return colors[key];
  };
  const editor = color('editor.background');
  const resolve = (keys, base = editor) => keys.reduce((background, key) => composite(color(key), background), base);
  const add = (label, actual, threshold, details = {}) => results.push({
    variant, label, ...details, minimum: threshold, actual: Number(actual.toFixed(4)), pass: actual >= threshold
  });
  const text = (label, foreground, background, threshold = minimum) =>
    add(label, ratio(composite(foreground, background), background), threshold, { foreground, background });
  const syntax = [...new Set([
    color('editor.foreground'), ...theme.tokenColors.map(rule => rule.settings.foreground),
    ...Object.values(theme.semanticTokenColors).map(rule => typeof rule === 'string' ? rule : rule.foreground)
  ].filter(Boolean))];
  const codeSurfaces = new Map();
  const syntaxOn = (label, background, foregrounds = syntax) => {
    codeSurfaces.set(label, background);
    for (const foreground of foregrounds) text(`syntax ${foreground} on ${label}`, foreground, background);
  };

  // Representative owner composites inventory EVERY emitted alpha, including
  // non-text marks. Only explicit consumer contracts below impose contrast.
  for (const [key, value] of Object.entries(colors)) {
    if (value.length !== 9) continue;
    if (/opacity$/i.test(key)) {
      // These keys use only alpha; their black/white RGB channels never paint.
      alphaInventory.push({ variant, key, value, kind: 'opacity parameter', alpha: rgba(value)[3] });
      continue;
    }
    const owner = [
      [/^terminal/, 'terminal.background'], [/^statusBarItem\./, 'statusBar.background'],
      [/^list\./, 'sideBar.background'], [/^chat\.|^agentsVoice\./, 'panel.background'],
      [/^peekViewEditor\./, 'peekViewEditor.background'], [/^peekViewResult\./, 'peekViewResult.background'],
      [/^tab\./, 'tab.inactiveBackground']
    ].find(([pattern]) => pattern.test(key))?.[1] ?? 'editor.background';
    const background = color(owner);
    alphaInventory.push({ variant, key, value, owner, background, resolved: composite(value, background) });
  }

  const codeKeys = [
    'editor.background', 'editor.lineHighlightBackground', 'editor.focusedStackFrameHighlightBackground',
    'editor.stackFrameHighlightBackground', 'editor.findMatchHighlightBackground', 'editor.findRangeHighlightBackground',
    'editor.hoverHighlightBackground', 'editor.linkedEditingBackground', 'editor.rangeHighlightBackground',
    'editor.wordHighlightBackground', 'editor.wordHighlightStrongBackground', 'editor.wordHighlightTextBackground',
    'editorBracketMatch.background', 'diffEditor.unchangedCodeBackground',
    'inlineEdit.modifiedBackground', 'inlineEdit.originalBackground', 'inlineEdit.modifiedChangedLineBackground',
    'inlineEdit.originalChangedLineBackground', 'mergeEditor.change.background', 'mergeEditor.changeBase.background',
    'mergeEditor.conflict.input1.background', 'mergeEditor.conflict.input2.background', 'mergeEditor.conflictingLines.background'
  ];
  for (const key of codeKeys) syntaxOn(key, resolve([key]));
  for (const [line, word] of [
    ['inlineEdit.modifiedChangedLineBackground', 'inlineEdit.modifiedChangedTextBackground'],
    ['inlineEdit.originalChangedLineBackground', 'inlineEdit.originalChangedTextBackground'],
    ['mergeEditor.change.background', 'mergeEditor.change.word.background'],
    ['mergeEditor.changeBase.background', 'mergeEditor.changeBase.word.background']
  ]) syntaxOn(`${word} on line`, resolve([line, word]));
  text('active find text', color('editor.findMatchForeground'), resolve(['editor.findMatchBackground']));

  const selectedSyntax = colors['editor.selectionForeground'] ? [color('editor.selectionForeground')] : syntax;
  for (const key of ['editor.selectionBackground', 'editor.inactiveSelectionBackground']) {
    const background = resolve([key]);
    syntaxOn(key, background, selectedSyntax);
    add(`${key} visibility`, ratio(background, editor), key === 'editor.selectionBackground' && variant === 'contrast' ? 2.4 : variant === 'day' ? 1.38 : 1.3);
  }
  add('active/inactive selection separation', ratio(resolve(['editor.selectionBackground']), resolve(['editor.inactiveSelectionBackground'])), 1.07);
  add('inactive selection alpha below 95%', rgba(color('editor.inactiveSelectionBackground'))[3] < 0.95 ? 1 : 0, 1);

  for (const kind of ['inserted', 'removed']) {
    const lineKey = `diffEditor.${kind}LineBackground`, wordKey = `diffEditor.${kind}TextBackground`;
    const line = resolve([lineKey]), word = resolve([lineKey, wordKey]);
    syntaxOn(`${kind} line`, line);
    syntaxOn(`${kind} word on line`, word);
    for (const selection of ['editor.selectionBackground', 'editor.inactiveSelectionBackground']) {
      syntaxOn(`${kind} word with ${selection}`, resolve([lineKey, wordKey, selection]), selectedSyntax);
    }
    add(`${kind} line visibility`, ratio(line, editor), 1.38);
    add(`${kind} word fill stays light`, rgba(color(wordKey))[3] <= 0.04 ? 1 : 0, 1);
    for (const background of [editor, line, word]) text(`${kind} word border contrast`, color(`diffEditor.${kind}TextBorder`), background, 3);
    const gutter = resolve([`diffEditorGutter.${kind}LineBackground`]);
    for (const key of ['editorLineNumber.foreground', 'editorLineNumber.activeForeground', 'editorLineNumber.dimmedForeground']) {
      text(`${key} on ${kind} gutter`, color(key), gutter);
    }
    const marker = color(`editorGutter.${kind === 'inserted' ? 'added' : 'deleted'}Background`);
    text(`${kind} gutter contrast`, marker, editor, 3);
    text(`${kind} marker on filled gutter`, marker, gutter, 3);
  }
  const inserted = resolve(['diffEditor.insertedLineBackground']), removed = resolve(['diffEditor.removedLineBackground']);
  add('insert/remove luminance separation', ratio(inserted, removed), 1.08);
  add('insert/remove hue separation (degrees)', hueDistance(inserted, removed), 45);

  for (const kind of ['current', 'incoming', 'common']) {
    // merge-conflict paints header and content lines as siblings, not layers.
    const content = resolve([`merge.${kind}ContentBackground`]), header = resolve([`merge.${kind}HeaderBackground`]);
    syntaxOn(`merge ${kind} content`, content);
    for (const key of ['editor.foreground', 'descriptionForeground']) text(`merge ${kind} header ${key}`, color(key), header);
    add(`merge ${kind} content visibility`, ratio(content, editor), 1.38);
    add(`merge ${kind} header visibility`, ratio(header, editor), 1.6);
    add(`merge ${kind} header/content separation`, ratio(header, content), 1.1);
    text(`merge ${kind} explicit ruler mark`, color(`editorOverviewRuler.${kind}ContentForeground`), editor, 3);
  }

  for (const key of ['editorLineNumber.foreground', 'editorLineNumber.activeForeground', 'editorLineNumber.dimmedForeground']) text(`${key} on gutter`, color(key), editor);
  text('ghost text on editor', color('editorGhostText.foreground'), editor);
  text('bright-black on terminal', color('terminal.ansiBrightBlack'), color('terminal.background'));
  const comment = theme.tokenColors.find(rule => [rule.scope].flat().includes('comment'))?.settings.foreground;
  if (!comment) throw new Error(`Missing comment foreground: ${variant}`);
  add('ghost/comment hierarchy', ratio(color('editorGhostText.foreground'), comment), 1.4);
  add('bright-black/terminal foreground hierarchy', ratio(color('terminal.ansiBrightBlack'), color('terminal.foreground')), 2);
  for (const key of ['editorInlayHint.foreground', 'editorInlayHint.typeForeground', 'editorInlayHint.parameterForeground']) text(`${key} on hint`, color(key), resolve(['editorInlayHint.background']));

  for (const owner of ['sideBar.background', 'quickInput.background']) {
    const base = color(owner), hover = resolve(['list.hoverBackground'], base);
    text(`hover text on ${owner}`, color('list.hoverForeground'), hover);
    add(`hover visibility on ${owner}`, ratio(hover, base), 1.06);
    for (const state of ['activeSelection', 'inactiveSelection', 'focus']) {
      const background = resolve([`list.${state}Background`], base);
      text(`${state} list text on ${owner}`, color(`list.${state}Foreground`), background);
      add(`${state} list visibility on ${owner}`, ratio(background, base), variant === 'contrast' ? 1.9 : 1.16);
      add(`hover/${state} separation on ${owner}`, ratio(hover, background), 1.08);
    }
  }
  for (const key of ['terminal.selectionBackground', 'terminal.inactiveSelectionBackground']) {
    const background = resolve([key], color('terminal.background'));
    // ANSI black/background paints are application-owned. xterm retains its
    // user-controlled contrast correction; we never distribute an override.
    const foregrounds = colors['terminal.selectionForeground'] ? [color('terminal.selectionForeground')] :
      ['terminal.foreground', ...Object.keys(colors).filter(key => /^terminal\.ansi/.test(key) && !/Black$/.test(key))].map(color);
    for (const foreground of new Set(foregrounds)) text(`${key} text ${foreground}`, foreground, background);
    if (variant === 'contrast' && key === 'terminal.selectionBackground') add('Contrast terminal selection visibility', ratio(background, color('terminal.background')), 2.4);
  }

  const opacity = rgba(color('editorUnnecessaryCode.opacity'))[3];
  if (variant !== 'contrast') {
    add('unused code fades by at least 18%', opacity <= 0.82 ? 1 : 0, 1);
    for (const [label, background] of codeSurfaces) {
      for (const foreground of syntax) text(`unused ${foreground} on ${label}`, hex(rgba(foreground), opacity), background, 4.5);
    }
    // Native TS also tags whole unused imports: keywords, comments, strings and
    // punctuation really can be faded under selection, not just identifiers.
    for (const key of ['editor.selectionBackground', 'editor.inactiveSelectionBackground']) {
      const background = resolve([key]);
      // Named semantic roles make failures actionable even when colors coincide.
      for (const role of ['variable', 'parameter', 'property', 'method', 'function', 'type']) {
        const foreground = theme.semanticTokenColors[role]?.foreground;
        if (!foreground) throw new Error(`Missing unused identifier foreground: ${variant} ${role}`);
        text(`selected unused ${role} on ${key}`, hex(rgba(foreground), opacity), background, 4.5);
      }
    }
  } else {
    text('unused code border', color('editorUnnecessaryCode.border'), editor, 3);
    for (const key of ['editor.lineHighlightBorder', 'editor.selectionHighlightBorder']) text(`${key} state cue`, color(key), editor, 3);
  }
  for (const [background, foreground] of [
    ['button.background', 'button.foreground'], ['statusBar.debuggingBackground', 'statusBar.debuggingForeground'],
    ['scmGraph.historyItemRefColor', 'scmGraph.historyItemHoverLabelForeground'],
    ['scmGraph.historyItemRemoteRefColor', 'scmGraph.historyItemHoverLabelForeground'],
    ['scmGraph.historyItemBaseRefColor', 'scmGraph.historyItemHoverLabelForeground'],
    ['scmGraph.historyItemHoverDefaultLabelBackground', 'scmGraph.historyItemHoverDefaultLabelForeground']
  ]) text(`${background} label text`, color(foreground), resolve([background]));
  return { results, alphaInventory };
}

export async function verifyStates() {
  const root = new URL('../', import.meta.url);
  const results = [], alphaInventory = [];
  for (const variant of ['night', 'day', 'contrast']) {
    const theme = JSON.parse(await readFile(new URL(`themes/stillpoint-${variant}.json`, root), 'utf8'));
    const checks = checkStates(theme, variant);
    results.push(...checks.results); alphaInventory.push(...checks.alphaInventory);
  }
  const failures = results.filter(check => !check.pass);
  const report = {
    method: 'WCAG sRGB; emitted JSON only; renderer-specific text contracts. Alpha inventory uses representative owners; non-text marks do not become text surfaces. Hue is not a color-vision certification.',
    thresholds: { text: { night: 4.5, day: 4.5, contrast: 7 }, lineVisibility: 1.38, lineSeparation: 1.08, hueSeparationDegrees: 45, essentialCue: 3, mergeHeader: 1.6, inactiveSeparation: 1.07, contrastSelection: 2.4, hover: 1.06 },
    checks: results.length, failures, results, alphaInventory
  };
  await writeFile(new URL('contrast-report.json', root), JSON.stringify(report, null, 2) + '\n');
  console.log(`Generated-color validation: ${results.length} checks; ${alphaInventory.length} alpha entries; ${failures.length} failures.`);
  for (const failure of failures.slice(0, 45)) console.error(`${failure.variant}: ${failure.label}: ${failure.actual} < ${failure.minimum}`);
  if (failures.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await verifyStates();
