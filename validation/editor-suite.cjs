const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}

exports.run = async () => {
  const root = path.resolve(__dirname, '..');
  const results = [];
  await vscode.extensions.getExtension('vscode.json-language-features').activate();
  const probe = await vscode.workspace.openTextDocument({ language: 'json', content: '{"$schema":"vscode://schemas/color-theme","colors":{"stillpoint.invalid":"#112233"}}' });
  await vscode.window.showTextDocument(probe);
  await until(() => vscode.languages.getDiagnostics(probe.uri).some(d => d.message.includes('stillpoint.invalid')), 'JSON theme schema validation becomes active');
  // This untitled document is created only by the schema probe above.
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  for (const [variant, kind] of [['night', vscode.ColorThemeKind.Dark], ['day', vscode.ColorThemeKind.Light], ['contrast', vscode.ColorThemeKind.HighContrast]]) {
    const theme = JSON.parse(await fs.readFile(path.join(root, 'themes', `stillpoint-${variant}.json`), 'utf8'));
    await vscode.workspace.getConfiguration('workbench').update('colorTheme', theme.name, vscode.ConfigurationTarget.Global);
    await until(() => vscode.window.activeColorTheme.kind === kind, `${theme.name} applies`);
    const document = await vscode.workspace.openTextDocument(path.join(root, 'themes', `stillpoint-${variant}.json`));
    await vscode.window.showTextDocument(document);
    // The probe has established that the language service is running. Give each
    // newly opened document a full validation cycle, including schema resolution.
    await delay(1500);
    const diagnostics = vscode.languages.getDiagnostics(document.uri).filter(d => d.severity <= vscode.DiagnosticSeverity.Warning);
    assert.deepEqual(diagnostics.map(d => d.message), [], `${theme.name} schema diagnostics`);
    results.push({ theme: theme.name, colorThemeKind: kind, diagnostics: diagnostics.length });
  }
  await vscode.extensions.getExtension('vscode.html-language-features').activate();
  const preview = await vscode.workspace.openTextDocument(path.join(root, 'preview.html'));
  await vscode.window.showTextDocument(preview);
  await delay(1500);
  const previewDiagnostics = vscode.languages.getDiagnostics(preview.uri).filter(d => d.severity <= vscode.DiagnosticSeverity.Warning);
  assert.deepEqual(previewDiagnostics.map(d => d.message), [], 'HTML preview diagnostics');
  results.push({ file: 'preview.html', diagnostics: previewDiagnostics.length });
  await fs.mkdir(path.join(root, 'output', 'editor'), { recursive: true });
  await fs.writeFile(path.join(root, 'output', 'editor', 'validation.json'), JSON.stringify({ vscodeVersion: vscode.version, platform: process.platform, results }, null, 2) + '\n');
  console.log(`Stillpoint editor validation passed: ${JSON.stringify(results)}`);
};
