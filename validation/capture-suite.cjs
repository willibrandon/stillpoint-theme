const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { randomBytes, createHash } = require('node:crypto');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
exports.run = async () => {
  const root = path.resolve(__dirname, '..');
  const workspace = vscode.workspace.workspaceFolders[0].uri.fsPath;
  if (!workspace.startsWith(path.join(root, 'output', 'editor-workspace-'))) throw new Error('Capture suite requires its isolated generated workspace');
  const uri = file => vscode.Uri.file(path.join(workspace, file));
  const config = async (key, value) => vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
  for (const [key, value] of Object.entries({
    'workbench.startupEditor': 'none', 'workbench.tips.enabled': false,
    'window.autoDetectColorScheme': false, 'window.autoDetectHighContrast': false,
    'editor.fontSize': 15, 'editor.minimap.enabled': false, 'editor.renderWhitespace': 'all',
    'editor.inlayHints.enabled': 'on', 'editor.semanticHighlighting.enabled': true,
    'typescript.inlayHints.parameterNames.enabled': 'all', 'typescript.inlayHints.variableTypes.enabled': true,
    'git.mergeEditor': true, 'git.openRepositoryInParentFolders': 'never',
    'merge-conflict.decorators.enabled': true, 'merge-conflict.codeLens.enabled': true,
    'editor.overviewRulerBorder': true,
    'terminal.integrated.fontSize': 14, 'terminal.integrated.gpuAcceleration': 'off',
    'debug.openDebug': 'openOnDebugBreak',
    'window.commandCenter': true
  })) await config(key, value);
  // Start from a known setting so a reused profile's cached startup theme cannot
  // make the first Day request a no-op while the renderer is still on Night.
  await config('workbench.colorTheme', 'Stillpoint Night');
  const diagnostics = vscode.languages.createDiagnosticCollection('stillpoint-review');
  const diagnostic = new vscode.Diagnostic(new vscode.Range(11, 6, 11, 11), 'Review fixture: number is not assignable to string', vscode.DiagnosticSeverity.Error);
  diagnostics.set(uri('review-states.ts'), [diagnostic]);
  await vscode.extensions.getExtension('vscode.git').activate();
  const git = vscode.extensions.getExtension('vscode.git').exports.getAPI(1);
  for (let i = 0; i < 100 && !git.repositories.length; i++) await delay(100);
  let quickPick;
  let terminal;
  const controlToken = randomBytes(24).toString('hex');
  let finish;
  const complete = new Promise(resolve => { finish = resolve; });
  const open = async file => vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri(file)), { preview: false });
  const setup = async ({ variant, scene }) => {
    let semanticTokenCount = 0;
    if (!['night', 'day', 'contrast'].includes(variant)) throw new Error('Unknown variant');
    const theme = JSON.parse(await fs.readFile(path.join(root, 'themes', `stillpoint-${variant}.json`), 'utf8'));
    await config('workbench.colorTheme', theme.name);
    await config('editor.renderWhitespace', ['xml-docs', 'syntax'].includes(scene) ? 'none' : 'all');
    quickPick?.dispose();
    if (scene !== 'debugger' && vscode.debug.activeDebugSession) await vscode.debug.stopDebugging();
    await vscode.commands.executeCommand('workbench.action.closePanel');
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    await vscode.commands.executeCommand('workbench.view.explorer');
    if (scene === 'diff') await vscode.commands.executeCommand('vscode.diff', uri('base.ts'), uri('current.ts'), 'Review: range fills and word borders');
    else if (scene === 'merge') await vscode.commands.executeCommand('git.openMergeEditor', uri('review.ts'));
    else if (scene === 'inline-merge') {
      await vscode.extensions.getExtension('vscode.merge-conflict').activate();
      await vscode.commands.executeCommand('vscode.openWith', uri('review-inline.ts'), 'default');
    } else if (scene === 'xml-docs') {
      const editor = await open('XmlDocumentation.cs');
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      editor.revealRange(new vscode.Range(0, 0, 27, 0), vscode.TextEditorRevealType.AtTop);
    } else if (scene === 'syntax') {
      const editor = await open('review-syntax.ts');
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      editor.revealRange(new vscode.Range(0, 0, 16, 0), vscode.TextEditorRevealType.AtTop);
      for (let i = 0; i < 50 && !semanticTokenCount; i++) {
        const tokens = await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', editor.document.uri);
        semanticTokenCount = (tokens?.data?.length ?? 0) / 5;
        if (!semanticTokenCount) await delay(100);
      }
      if (!semanticTokenCount) throw new Error('Native TypeScript semantic tokens must be ready');
    } else if (/^unused-(roles|parameter|property|method|function|type)(-selected|-inactive)?$/.test(scene)) {
      const [, role, state] = scene.match(/^unused-(roles|parameter|property|method|function|type)(-selected|-inactive)?$/);
      const editor = await open('review-unused.ts');
      const names = role === 'roles' ? ['unusedParameter', 'unusedProperty', 'unusedMethod', 'unusedFunction', 'UnusedType', 'unusedVariable'] : [role === 'type' ? 'UnusedType' : `unused${role[0].toUpperCase()}${role.slice(1)}`];
      const ranges = names.map(name => {
        const offset = editor.document.getText().indexOf(name);
        if (offset < 0) throw new Error(`Missing unused specimen: ${name}`);
        return new vscode.Selection(editor.document.positionAt(offset), editor.document.positionAt(offset + name.length));
      });
      if (role === 'roles') ranges.unshift(new vscode.Selection(0, 0, 0, editor.document.lineAt(0).text.length));
      editor.selections = state ? ranges : [new vscode.Selection(ranges[0].start, ranges[0].start)];
      for (let i = 0; i < 100; i++) {
        if (ranges.every(range => vscode.languages.getDiagnostics(editor.document.uri).some(d => d.tags?.includes(vscode.DiagnosticTag.Unnecessary) && d.range.contains(range.start)))) break;
        await delay(100);
      }
      if (state === '-inactive') await vscode.commands.executeCommand('workbench.files.action.focusFilesExplorer');
    } else if (scene === 'unused' || scene === 'unused-selected') {
      const editor = await open('review-states.ts');
      editor.selection = scene === 'unused-selected' ? new vscode.Selection(6, 8, 6, 14) : new vscode.Selection(6, 0, 6, 0);
      for (let i = 0; i < 100; i++) {
        if (vscode.languages.getDiagnostics(editor.document.uri).some(d => d.tags?.includes(vscode.DiagnosticTag.Unnecessary))) break;
        await delay(100);
      }
    }
    else if (scene === 'selection' || scene === 'inactive-selection' || scene === 'hover' || scene === 'inlay') {
      const editor = await open('review-states.ts');
      editor.selection = scene === 'inlay' ? new vscode.Selection(10, 0, 10, 0) : new vscode.Selection(11, 0, 11, 25);
      if (scene === 'inactive-selection') await vscode.commands.executeCommand('workbench.files.action.focusFilesExplorer');
    } else if (scene === 'quickpick') {
      await open('review-states.ts');
      quickPick = vscode.window.createQuickPick();
      quickPick.title = 'Stillpoint: inspect a snapshot';
      quickPick.placeholder = 'Compare group labels, selection, and secondary text';
      quickPick.items = [{ label: 'Assemblies', kind: vscode.QuickPickItemKind.Separator }, { label: 'SnapshotReader', description: 'C# metadata inspection' }, { label: 'ModuleReader', description: 'Go module inventory' }, { label: 'Review', kind: vscode.QuickPickItemKind.Separator }, { label: 'Open changes', description: 'Compare the two snapshots' }];
      quickPick.show();
    } else if (scene === 'graph') {
      await vscode.commands.executeCommand('workbench.view.scm');
      await vscode.commands.executeCommand('workbench.scm.history.focus');
    } else if (scene === 'terminal') {
      await open('inspect.ts');
      terminal?.dispose();
      terminal = vscode.window.createTerminal({ name: 'Stillpoint review', cwd: workspace, shellPath: '/bin/zsh', shellArgs: ['-f'], env: { TERM: 'xterm-256color', CLICOLOR: '1', PS1: '%~ > ' } });
      terminal.show();
      await vscode.commands.executeCommand('workbench.action.toggleMaximizedPanel');
      terminal.sendText('ls; git --no-pager -c color.ui=always diff -- inspect.ts');
    } else if (scene === 'debugger') {
      if (!vscode.debug.activeDebugSession) {
        const started = await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], { type: 'pwa-node', request: 'launch', name: 'Stillpoint: paused variables', program: uri('review-debug.js').fsPath, skipFiles: ['<node_internals>/**'], console: 'internalConsole' });
        if (!started) throw new Error('Node debugger did not start');
      }
      await vscode.commands.executeCommand('workbench.view.debug');
    } else if (scene === 'validate') {
      await require('./editor-suite.cjs').run();
    } else throw new Error('Unknown scene');
    await delay(scene === 'debugger' ? 2200 : 1000);
    return { variant, scene, semanticTokenCount, vscodeVersion: vscode.version, workspace, theme: theme.name, themeHash: createHash('sha256').update(JSON.stringify(theme)).digest('hex'), debugSession: vscode.debug.activeDebugSession?.name ?? null, diagnostics: vscode.languages.getDiagnostics(uri('review-states.ts')).map(d => d.message), repositories: git.repositories.length };
  };
  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST' || request.headers.authorization !== `Bearer ${controlToken}`) { response.writeHead(403).end(); return; }
    try {
      let body = '';
      for await (const chunk of request) { body += chunk; if (body.length > 4096) throw new Error('Request too large'); }
      const input = JSON.parse(body);
      const result = input.scene === 'finish' ? { finished: true } : await setup(input);
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
      if (input.scene === 'finish') finish();
    } catch (error) { response.writeHead(500).end(String(error.stack)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await fs.writeFile(path.join(root, 'output', 'capture-control.json'), JSON.stringify({ port: server.address().port, token: controlToken, workspace }));
  await complete;
  server.close();
  quickPick?.dispose(); terminal?.dispose(); diagnostics.dispose();
};
