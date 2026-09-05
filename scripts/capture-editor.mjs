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
const scenes = process.env.CAPTURE_SCENES?.split(',') ?? ['diff', 'merge', 'selection', 'debugger', 'inlay', 'quickpick', 'graph', 'terminal'];
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
      selection: /review-states.ts/,
      debugger: /Paused on debugger statement/,
      inlay: /review-states.ts/,
      quickpick: /Compare group labels, selection, and secondary text/,
      graph: /Inspect assembly snapshots/,
      terminal: /Stillpoint review/
    }[scene];
    if (!expected.test(tree)) throw new Error(`${variant} ${scene}: native scene not ready`);
    if (scene === 'debugger' && !/label, value 'SnapshotReader'/.test(tree)) throw new Error('Variables view is missing');
    const theme = JSON.parse(await readFile(`themes/stillpoint-${variant}.json`, 'utf8'));
    const evidence = invoke('run-code', `async (page) => {
      const expected = ${JSON.stringify(theme.colors['editor.background'])};
      const result = await page.evaluate(() => {
        const workbench = document.querySelector('.monaco-workbench');
        const visible = selector => [...document.querySelectorAll(selector)].filter(el => el.getBoundingClientRect().width > 0);
        return {
          editorBackground: getComputedStyle(workbench).getPropertyValue('--vscode-editor-background').trim(),
          selection: visible('.selected-text').length,
          diagnostic: visible('.squiggly-error').length,
          terminalText: visible('.xterm-rows').map(el => el.textContent).join(' '),
          inlayHints: visible('.view-line [class*="dyn-rule-"]').filter(el => /path:|limit:|ScanResult/.test(el.textContent)).map(el => ({text: el.textContent, color: getComputedStyle(el).color})),
          lineNumbers: visible('.line-numbers').map(el => ({text: el.textContent, color: getComputedStyle(el).color, opacity: getComputedStyle(el).opacity})),
          diffGutters: visible('.gutter-insert, .gutter-delete').map(el => ({className: el.className, background: getComputedStyle(el).backgroundColor}))
        };
      });
      if (result.editorBackground.toUpperCase() !== expected) throw new Error('Wrong rendered theme: ' + result.editorBackground);
      ${scene === 'selection' ? "if (!result.selection || !result.diagnostic) throw new Error('Selection and diagnostic must both be rendered');" : ''}
      ${scene === 'inlay' ? "if (!result.inlayHints.length) throw new Error('Native inlay hints must be rendered');" : ''}
      ${scene === 'terminal' ? "if (!/diff.*--git/.test(result.terminalText) || !result.terminalText.includes('worker.service')) throw new Error('Both ls and git diff output must be visible');" : ''}
      return result;
    }`);
    invoke('screenshot', '--filename', `output/playwright/${variant}-${scene}.png`);
    const metadata = JSON.parse(await readFile(`output/playwright/${variant}-${scene}.json`, 'utf8'));
    if (metadata.themeHash !== createHash('sha256').update(JSON.stringify(theme)).digest('hex')) throw new Error('Theme changed during capture');
    await writeFile(`output/playwright/${variant}-${scene}.evidence.txt`, snapshot + '\n' + evidence);
    console.log(`Captured and asserted ${variant} ${scene}`);
  }
}
