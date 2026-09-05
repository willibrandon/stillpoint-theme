import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [variant, scene] = process.argv.slice(2);
const control = JSON.parse(await readFile(new URL('output/capture-control.json', root), 'utf8'));
const response = await fetch(`http://127.0.0.1:${control.port}`, {
  method: 'POST', headers: { authorization: `Bearer ${control.token}` },
  body: JSON.stringify({ variant, scene })
});
if (!response.ok) throw new Error(await response.text());
const result = await response.json();
if (scene !== 'finish') {
  await mkdir(new URL('output/playwright/', root), { recursive: true });
  await writeFile(new URL(`output/playwright/${variant}-${scene}.json`, root), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result));
