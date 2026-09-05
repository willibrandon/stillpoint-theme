import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import textmate from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';
const { Registry, parseRawGrammar } = textmate;
const { loadWASM, OnigScanner, OnigString } = oniguruma;

const root = new URL('../',import.meta.url);
const reference = fileURLToPath(new URL('../../vscode/',import.meta.url));
const git = (...args) => execFileSync('git',['-C',reference,...args],{encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const read = path => readFile(new URL(path,root),'utf8');
const manifest=JSON.parse(await read('package.json'));
assert.equal(manifest.main,undefined,'Theme must not activate runtime code');
assert.equal(manifest.browser,undefined,'Theme must not activate browser code');
assert.equal(manifest.contributes.themes.length,3);
const registrations=JSON.parse(await read('validation/vscode-colors-1.136.1.json')).colors;
const palettes=JSON.parse(await read('palette.json'));
const unknown=[];
const opaque=[];
for(const contribution of manifest.contributes.themes){
  const theme=JSON.parse(await read(contribution.path));
  assert.equal(theme.semanticHighlighting,true);
  for(const [key,value] of Object.entries(theme.colors)){
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
const grammarFiles={
  'source.ts':'extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json',
  'source.cs':'extensions/csharp/syntaxes/csharp.tmLanguage.json',
  'source.go':'extensions/go/syntaxes/go.tmLanguage.json',
  'source.json':'extensions/json/syntaxes/JSON.tmLanguage.json',
  'source.sql':'extensions/sql/syntaxes/sql.tmLanguage.json',
  'source.shell':'extensions/shellscript/syntaxes/shell-unix-bash.tmLanguage.json',
  'source.python':'extensions/python/syntaxes/MagicPython.tmLanguage.json',
  'source.java':'extensions/java/syntaxes/java.tmLanguage.json',
  'source.rust':'extensions/rust/syntaxes/rust.tmLanguage.json',
  'source.yaml':'extensions/yaml/syntaxes/yaml.tmLanguage.json',
  'source.yaml.1.0':'extensions/yaml/syntaxes/yaml-1.0.tmLanguage.json',
  'source.yaml.1.1':'extensions/yaml/syntaxes/yaml-1.1.tmLanguage.json',
  'source.yaml.1.2':'extensions/yaml/syntaxes/yaml-1.2.tmLanguage.json',
  'source.yaml.1.3':'extensions/yaml/syntaxes/yaml-1.3.tmLanguage.json',
  'source.yaml.embedded':'extensions/yaml/syntaxes/yaml-embedded.tmLanguage.json',
  'source.ini':'extensions/ini/syntaxes/ini.tmLanguage.json',
  'source.css':'extensions/css/syntaxes/css.tmLanguage.json'
};
const grammarCache = new Map();
function raw(scope){
  const path=grammarFiles[scope];
  if(!path)return null;
  if(!grammarCache.has(path))grammarCache.set(path,parseRawGrammar(git('show',`1.136.1:${path}`),path));
  return grammarCache.get(path);
}
const cases=[
  {scope:'source.ts',line:'const count = 42;',needle:'42',role:'number'},
  {scope:'source.ts',line:'// A comment remains readable',needle:'comment',role:'muted'},
  {scope:'source.ts',line:'const label = "ready";',needle:'ready',role:'string'},
  {scope:'source.ts',line:'async function inspect() {}',needle:'inspect',role:'function'},
  {scope:'source.cs',line:'public class SnapshotReader {}',needle:'SnapshotReader',role:'type'},
  {scope:'source.cs',line:'var label = "assembly";',needle:'assembly',role:'string'},
  {scope:'source.go',line:'func inspect() {}',needle:'inspect',role:'function'},
  {scope:'source.json',line:'{"status": "ready", "count": 42}',needle:'status',role:'property'},
  {scope:'source.json',line:'{"status": "ready", "count": 42}',needle:'ready',role:'string'},
  {scope:'source.sql',line:'SELECT count(*) FROM assemblies;',needle:'SELECT',role:'keyword'},
  {scope:'source.shell',line:'# Preserve shell comments',needle:'comments',role:'muted'},
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
  {scope:'source.python',line:'result = inspect(value)',needle:'inspect',role:'function'},
  {scope:'source.css',line:'a { width: 12px; }',needle:'px',role:'number'}
];
let tokenChecks=0;
const tokenFailures=[];
for(const [variant,p] of Object.entries(palettes)){
  const theme=JSON.parse(await read(`themes/stillpoint-${variant}.json`));
  for(const [selector,role] of [['variable.readonly','fg'],['enumMember','number'],['decorator','keyword'],['namespace','property']]) {
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
  registry.dispose();
}
console.log(`${tokenChecks} real-grammar color checks; ${tokenFailures.length} failures.`);
for(const failure of tokenFailures)console.error(JSON.stringify(failure));
if(tokenFailures.length)process.exitCode=1;
try {
  await access(new URL('preview.html',root));
  const html=await read('preview.html');
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(!match[0].startsWith('<script id="palettes"'))new Script(match[1],{filename:'preview.html'});
  }
  const embedded=JSON.parse(html.match(/<script id="palettes" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded,palettes,'Preview palettes must match the theme');
  console.log('Visual preview JavaScript parses and its palette matches the shipped themes.');
} catch(error) { if(error.code!=='ENOENT')throw error; }
