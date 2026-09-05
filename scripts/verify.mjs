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
  'source.shell':'extensions/shellscript/syntaxes/shell-unix-bash.tmLanguage.json'
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
  {scope:'source.shell',line:'# Preserve shell comments',needle:'comments',role:'muted'}
];
let tokenChecks=0;
for(const [variant,p] of Object.entries(palettes)){
  const theme=JSON.parse(await read(`themes/stillpoint-${variant}.json`));
  const registry=new Registry({theme:{name:theme.name,settings:[{settings:{foreground:p.fg,background:p.bg}},...theme.tokenColors]},onigLib:Promise.resolve({createOnigScanner:patterns=>new OnigScanner(patterns),createOnigString:text=>new OnigString(text)}),loadGrammar:async scope=>raw(scope)});
  for(const c of cases){
    const grammar=await registry.loadGrammar(c.scope);
    const result=grammar.tokenizeLine2(c.line,null);
    const position=c.line.indexOf(c.needle);
    let metadata=0;
    for(let i=0;i<result.tokens.length;i+=2)if(result.tokens[i]<=position)metadata=result.tokens[i+1];
    const foreground=registry.getColorMap()[(metadata>>>15)&511];
    assert.equal(foreground?.toUpperCase(),p[c.role].toUpperCase(),`${variant} ${c.scope} ${c.needle}`);
    tokenChecks++;
  }
  registry.dispose();
}
console.log(`${tokenChecks} real-grammar color checks passed across all variants.`);
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
