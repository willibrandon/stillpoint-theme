import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import textmate from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';
const { Registry, parseRawGrammar } = textmate;
const { loadWASM, OnigScanner, OnigString } = oniguruma;

const root = new URL('../',import.meta.url);
const read = path => readFile(new URL(path,root),'utf8');
const manifest=JSON.parse(await read('package.json'));
assert.equal(manifest.main,undefined,'Theme must not activate runtime code');
assert.equal(manifest.browser,undefined,'Theme must not activate browser code');
assert.equal(manifest.activationEvents,undefined,'Asset-only extension must not declare activation events');
assert.deepEqual(Object.keys(manifest.contributes), ['themes']);
assert.equal(manifest.repository?.url, 'https://github.com/willibrandon/stillpoint-theme.git');
const icon = await readFile(new URL(manifest.icon, root));
assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Icon must be PNG');
assert.equal(icon.readUInt32BE(16), 256, 'Icon width');
assert.equal(icon.readUInt32BE(20), 256, 'Icon height');
assert.equal(manifest.contributes.themes.length,3);
const registrations=JSON.parse(await read('validation/vscode-colors-1.136.1.json')).colors;
const palettes=JSON.parse(await read('palette.json'));
const unknown=[];
const opaque=[];
for(const contribution of manifest.contributes.themes){
  const theme=JSON.parse(await read(contribution.path));
  assert.equal(theme.semanticHighlighting,true);
  for(const [key,value] of Object.entries(theme.colors)){
    assert.ok(!key.startsWith('agentsMobileDiff.'), 'Mobile-only colors are not registered by the desktop editor');
    assert.match(value,/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/,key);
    if(!registrations[key])unknown.push(key);
    if(registrations[key]?.needsTransparency && (value.length!==9||value.slice(-2).toUpperCase()==='FF'))opaque.push(key);
  }
  for(const key of Object.keys(theme.semanticTokenColors))assert.match(key,/^(?:[\w-]+|\*)(?:\.[\w-]+)*(?::[\w-]+)?$/);
  for(const key of ['diffEditor.insertedLineBackground','diffEditor.removedLineBackground','diffEditor.insertedTextBackground','diffEditor.removedTextBackground'])assert.equal(theme.colors[key].length,9,`${key} must have alpha`);
}
assert.deepEqual([...new Set(unknown)],[], 'Unregistered colors in VS Code 1.136.1');
assert.deepEqual([...new Set(opaque)],[], 'Colors that must be transparent in VS Code 1.136.1');
console.log('Manifest, public color registrations, semantic selector syntax, and transparent diff overlays passed.');

const wasm=await readFile(new URL('node_modules/vscode-oniguruma/release/onig.wasm',root));
await loadWASM(wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength));
const grammarManifest = JSON.parse(await read('validation/grammars/manifest.json'));
const grammarCache = new Map();
for (const entry of grammarManifest.files) {
  assert.match(entry.ref, /^[a-f0-9]{40}$/);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  const content = await readFile(new URL('validation/grammars/' + entry.file, root));
  assert.equal(createHash('sha256').update(content).digest('hex'), entry.sha256, 'Vendored integrity: ' + entry.file);
  if (entry.scope) {
    const grammar = parseRawGrammar(content.toString(), entry.file);
    assert.equal(grammar.scopeName, entry.scope);
    assert.ok(!grammarCache.has(entry.scope), 'Duplicate grammar scope');
    grammarCache.set(entry.scope, grammar);
  }
}
const raw = scope => grammarCache.get(scope) ?? null;
const xmlDocs = JSON.parse(await read('validation/xml-doc-cases.json'));
const xmlDocLines = (await read('fixtures/' + xmlDocs.fixture)).split('\n');
// Exercise Microsoft's semantic fallback scopes, independently of the C# grammar.
const fallbackScope = 'source.stillpoint-xml-doc-fallback';
grammarCache.set(fallbackScope, {
  scopeName: fallbackScope,
  patterns: xmlDocs.semantic.map(({ type, scope }) => ({ match: '^' + type + '$', name: scope }))
});
const cases=[
  {scope:'source.ts',line:'const count = 42;',needle:'42',role:'number'},
  {scope:'source.ts',line:'// A comment remains readable',needle:'comment',role:'comment'},
  {scope:'source.ts',line:'const label = "ready";',needle:'ready',role:'string'},
  {scope:'source.ts',line:'async function inspect() {}',needle:'inspect',role:'function'},
  {scope:'source.cs',line:'public class SnapshotReader {}',needle:'SnapshotReader',role:'type'},
  {scope:'source.cs',line:'var label = "assembly";',needle:'assembly',role:'string'},
  {scope:'source.go',line:'func inspect() {}',needle:'inspect',role:'function'},
  {scope:'source.json',line:'{"status": "ready", "count": 42}',needle:'status',role:'property'},
  {scope:'source.json',line:'{"status": "ready", "count": 42}',needle:'ready',role:'string'},
  {scope:'source.sql',line:'SELECT count(*) FROM assemblies;',needle:'SELECT',role:'keyword'},
  {scope:'source.shell',line:'# Preserve shell comments',needle:'comments',role:'comment'},
  ...[['new','const result = new Item();'],['typeof','const result = typeof value;'],['instanceof','const result = value instanceof Item;'],['delete','delete item.key;'],['void','void inspect();'],['in','for (const key in item) {}'],['of','for (const item of items) {}']].map(([word,line]) => ({scope:'source.ts',line,needle:word,role:'keyword'})),
  ...[['new','var result = new Item();'],['await','var result = await Inspect();'],['is','var result = value is Item;'],['default','var result = default(Item);']].map(([word,line]) => ({scope:'source.cs',line,needle:word,role:'keyword'})),
  ...[['and','left and right'],['or','left or right'],['not','not left'],['is','left is right']].map(([word,expression]) => ({scope:'source.python',line:`result = ${expression}`,needle:word,role:'keyword'})),
  ...['source.ts', 'source.cs', 'source.go', 'source.rust', 'source.json', 'source.python', 'source.java'].map(scope => ({scope,line:'"example"',needle:'"',role:'string'})),
  {scope:'source.ts',line:'const title = `count: ${this.items.size}`;',needle:'this',role:'fg'},
  {scope:'source.ts',line:'const title = `count: ${inspect(value)}`;',needle:'value',role:'fg'},
  {scope:'source.ts',line:'const count = 42;',needle:'count',role:'fg'},
  {scope:'source.ts',line:'class Item extends Base {}',needle:'Base',role:'type'},
  {scope:'source.python',line:'class Item(Base):',needle:'Base',role:'type'},
  {scope:'source.java',line:'class Item extends Base {}',needle:'Base',role:'type'},
  {scope:'source.ts',line:'@memoize()',needle:'memoize',role:'keyword'},
  {scope:'source.python',line:'@memoize',needle:'memoize',role:'keyword'},
  {scope:'source.cs',line:'namespace Stillpoint.Tools;',needle:'Stillpoint',role:'property'},
  {scope:'source.go',line:'var title string',needle:'string',role:'type'},
  {scope:'source.go',line:'var count int',needle:'int',role:'type'},
  {scope:'source.java',line:'List<String> names = new ArrayList<>();',needle:'List',role:'type'},
  {scope:'source.java',line:'List<String> names = new ArrayList<>();',needle:'String',role:'type'},
  {scope:'source.yaml',line:'status: ready',needle:'status',role:'property'},
  {scope:'source.ini',line:'status=ready',needle:'status',role:'property'},
  {scope:'source.toml',line:'status = "ready"',needle:'status',role:'property'},
  {scope:'source.toml',line:'"quoted-key" = 42',needle:'quoted-key',role:'property'},
  {scope:'source.toml',line:'inline = { key = 42 }',needle:'key',role:'property'},
  {scope:'source.systemd',line:'ExecStart=/usr/bin/app',needle:'ExecStart',role:'property'},
  {scope:'source.caddyfile',line:'reverse_proxy localhost:8080',needle:'reverse_proxy',role:'property'},
  {scope:'source.vhs',line:'Set FontSize 16',needle:'FontSize',role:'property'},
  {scope:'source.logrotate',line:'rotate 7',needle:'rotate',role:'property'},
  {scope:'source.vhs',line:'Sleep 500ms',needle:'500',role:'number'},
  {scope:'source.logrotate',line:'create 0640 root adm',needle:'0640',role:'number'},
  {scope:'source.python',line:'result = inspect(value)',needle:'inspect',role:'function'},
  {scope:'source.python',line:'result = inspect(value)',needle:'value',role:'fg'},
  {scope:'source.python',line:'@memoize',needle:'@',role:'keyword'},
  {scope:'source.python',line:'title = f"value: {item}"',needle:'{',role:'keyword'},
  {scope:'source.ts',line:'const title = `value: ${inspect(value)}`;',needle:'(',role:'operator'},
  {scope:'source.java',line:'List<String> names = new ArrayList<>();',needle:'ArrayList',role:'type'},
  {scope:'source.rust',line:'let ready = true;',needle:'true',role:'number'},
  {scope:'source.css',line:'a { color: #aabbcc; }',needle:'#aabbcc',role:'number'},
  {scope:'source.css',line:'a { display: block; }',needle:'block',role:'string'},
  {scope:'source.css',line:'a { width: 12px; }',needle:'px',role:'number'}
];
let tokenChecks=0;
let xmlDocSemanticChecks=0;
const tokenFailures=[];
for(const [variant,p] of Object.entries(palettes)){
  const theme=JSON.parse(await read(`themes/stillpoint-${variant}.json`));
  for(const [selector,role] of [['variable.readonly','fg'],['enumMember','number'],['decorator','keyword'],['namespace','property'],['parameter','parameter'],['property','property'],['comment','comment']]) {
    const actual=theme.semanticTokenColors[selector]?.foreground;
    if(actual!==p[role])tokenFailures.push({variant,selector,expected:p[role],actual});
  }
  const registry=new Registry({theme:{name:theme.name,settings:[{settings:{foreground:p.fg,background:p.bg}},...theme.tokenColors]},onigLib:Promise.resolve({createOnigScanner:patterns=>new OnigScanner(patterns),createOnigString:text=>new OnigString(text)}),loadGrammar:async scope=>raw(scope)});
  for(const c of cases){
    const grammar=await registry.loadGrammar(c.scope);
    const result=grammar.tokenizeLine2(c.line,null);
    const position=c.line.indexOf(c.needle);
    let metadata=0;
    for(let i=0;i<result.tokens.length;i+=2)if(result.tokens[i]<=position)metadata=result.tokens[i+1];
    const foreground=registry.getColorMap()[(metadata>>>15)&511];
    if(foreground?.toUpperCase()!==p[c.role].toUpperCase()) tokenFailures.push({variant,...c,actual:foreground,expected:p[c.role],scopes:grammar.tokenizeLine(c.line,null).tokens.find(token=>token.startIndex<=position&&token.endIndex>position)?.scopes});
    tokenChecks++;
  }
  const csharp = await registry.loadGrammar('source.cs');
  let state = null;
  const docTokens = xmlDocLines.map(line => {
    const result = csharp.tokenizeLine2(line, state);
    state = result.ruleStack;
    return result.tokens;
  });
  for (const c of xmlDocs.cases) {
    const lineIndex = xmlDocLines.findIndex(line => line.includes(c.line));
    assert.ok(lineIndex >= 0, 'Missing XML documentation fixture line: ' + c.line);
    const line = xmlDocLines[lineIndex];
    const start = line.indexOf(c.text);
    assert.ok(start >= 0, 'Missing XML documentation text: ' + c.text);
    const tokens = docTokens[lineIndex];
    // Check the entire range, including closing quotes, entities, and delimiters.
    for (let i = 0; i < tokens.length; i += 2) {
      if (tokens[i] >= start + c.text.length || (tokens[i + 2] ?? line.length) <= start) continue;
      const actual = registry.getColorMap()[(tokens[i + 1] >>> 15) & 511];
      if (actual !== p[c.role]) tokenFailures.push({ variant, ...c, actual, expected: p[c.role] });
    }
    tokenChecks++;
  }
  const fallback = await registry.loadGrammar(fallbackScope);
  for (const c of xmlDocs.semantic) {
    const selector = c.type + ':csharp';
    const actual = theme.semanticTokenColors[selector]?.foreground;
    if (actual !== p[c.role]) tokenFailures.push({ variant, selector, actual, expected: p[c.role] });
    const result = fallback.tokenizeLine2(c.type, null);
    const fallbackColor = registry.getColorMap()[(result.tokens[1] >>> 15) & 511];
    if (fallbackColor !== p[c.role]) tokenFailures.push({ variant, scope: c.scope, actual: fallbackColor, expected: p[c.role] });
    xmlDocSemanticChecks += 2;
  }
  registry.dispose();
}
console.log(`${tokenChecks} real-grammar color checks; ${tokenFailures.length} failures.`);
console.log(`${xmlDocSemanticChecks} XML documentation semantic/fallback checks.`);
for(const failure of tokenFailures)console.error(JSON.stringify(failure));
if(tokenFailures.length)process.exitCode=1;
try {
  await access(new URL('preview.html',root));
  const html=await read('preview.html');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(!match[0].includes('type="application/json"'))new Script(match[1],{filename:'preview.html'});
  }
  const embedded=JSON.parse(html.match(/<script id="palettes" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded,palettes,'Preview palettes must match the theme');
  console.log('Visual preview JavaScript parses and its palette matches the shipped themes.');
} catch(error) { if(error.code!=='ENOENT')throw error; }
