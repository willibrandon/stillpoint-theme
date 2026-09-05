import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const reference=fileURLToPath(new URL('../../vscode/',import.meta.url));
const git=(...args)=>execFileSync('git',['-C',reference,...args],{encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const tag='1.136.1';
const files=git('grep','-l','registerColor(',tag,'--','src').trim().split('\n');
const colors={};
const defaultsMetadata = node => {
  const defaults = typeof node === 'string' ? node : node?.getText() ?? 'dynamic registration; inspect source';
  const hexDefaults = [...new Set(defaults.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
  return { defaults, hexDefaults };
};
for(const file of files){
  const source=git('show',file);
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  function visit(node){
    if(ts.isCallExpression(node)&&/(?:^|\.)registerColor$/.test(node.expression.getText(tree))){
      const [id,defaults,,transparent,deprecation]=node.arguments;
      if(id&&ts.isStringLiteralLike(id))colors[id.text]={needsTransparency:transparent?.kind===ts.SyntaxKind.TrueKeyword,deprecated:!!deprecation&&deprecation.kind!==ts.SyntaxKind.UndefinedKeyword,source:file.slice(tag.length+1),...defaultsMetadata(defaults)};
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
  for(const match of source.matchAll(/['"]((?:terminal\.ansi|editor(?:IndentGuide|BracketPairGuide|BracketHighlight)\.)[^'"$]+)['"]/g)){
    if(match[1].includes('\\') || match[1]==='terminal.ansiColor')continue;
    colors[match[1]]??={needsTransparency:false,deprecated:false,source:file.slice(tag.length+1),...defaultsMetadata(source),defaults:'Dynamic registration: conservatively collect hex defaults from its source file.'};
  }
}
const manifests=git('ls-tree','-r','--name-only',tag,'--','extensions').trim().split('\n').filter(p=>/^extensions\/[^/]+\/package.json$/.test(p));
for(const path of manifests){
  const manifest=JSON.parse(git('show',`${tag}:${path}`));
  for(const entry of manifest.contributes?.colors??[])colors[entry.id]={needsTransparency:false,deprecated:false,source:path,...defaultsMetadata(JSON.stringify(entry.defaults))};
}
await mkdir(new URL('validation/',root),{recursive:true});
await writeFile(new URL('validation/vscode-colors-1.136.1.json',root),JSON.stringify({version:tag,commit:git('rev-parse',tag).trim(),source:'https://github.com/microsoft/vscode/tree/1.136.1',colors:Object.fromEntries(Object.entries(colors).sort(([a],[b])=>a.localeCompare(b)))},null,2)+'\n');
console.log(`Recorded ${Object.keys(colors).length} color registrations from local VS Code ${tag}.`);
