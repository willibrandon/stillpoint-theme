import { readFile, writeFile } from 'node:fs/promises';
const base = new URL('./', import.meta.url);
const palettes = JSON.parse(await readFile(new URL('palette.json', base), 'utf8'));
const rgb = hex => hex.slice(1, 7).match(/../g).map(x => parseInt(x, 16));
const linear = value => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = hex => rgb(hex).map(linear).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [low, high] = [luminance(a), luminance(b)].sort((x,y) => x-y); return (high + 0.05) / (low + 0.05); };
function composite(fg, bg) {
  const alpha = parseInt(fg.slice(7, 9), 16) / 255;
  return '#' + rgb(fg).map((v,i) => Math.round(v * alpha + rgb(bg)[i] * (1-alpha)).toString(16).padStart(2,'0')).join('');
}
const roles = ['fg','muted','keyword','type','function','string','number','property','parameter','operator','error','warning','info','success'];
const checks = [];
const add = (variant, label, foreground, background, minimum) => {
  const contrast = ratio(foreground, background);
  checks.push({variant, label, foreground, background, minimum, ratio:Number(contrast.toFixed(4)), pass:contrast >= minimum});
};
for (const [variant, p] of Object.entries(palettes)) {
  const threshold = variant === 'contrast' ? 7 : 4.5;
  const backgrounds = Object.fromEntries(['bg','recessed','panel','raised','selection'].map(k=>[k,p[k]]));
  for (const role of ['success','error']) {
    backgrounds[`${role}Line`] = composite(p[role]+'10', p.bg);
    backgrounds[`${role}Word`] = composite(p[role]+'18', backgrounds[`${role}Line`]);
  }
  for (const [surface, bg] of Object.entries(backgrounds)) {
    for (const role of roles) add(variant, `${role} on ${surface}`, p[role], bg, threshold);
  }
  add(variant, 'line numbers on editor', p.line, p.bg, threshold);
  add(variant, 'button label on accent', p.bg, p.accent, threshold);
  for (const surface of ['bg','panel','raised','selection']) {
    add(variant, `focus indicator on ${surface}`, p.accent, p[surface], 3);
    add(variant, `control boundary on ${surface}`, p.control, p[surface], 3);
  }
  if (variant === 'contrast') for (const surface of ['bg','panel','raised']) add(variant, `high contrast separator on ${surface}`, p.border, p[surface], 3);
}
const report = {method:'WCAG 2.x sRGB relative luminance; 8-bit alpha compositing before contrast. Unrounded ratios determine pass/fail.', limitation:'Palette and proposed overlay pairs only. This is not a VS Code render audit or a WCAG conformance certification.', checks:checks.length, failures:checks.filter(c=>!c.pass), results:checks};
await writeFile(new URL('contrast-report.json', base), JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify({checks:report.checks,failures:report.failures,minimumByVariant:Object.fromEntries(Object.keys(palettes).map(v=>[v,Math.min(...checks.filter(c=>c.variant===v&&c.minimum>=4.5).map(c=>c.ratio))]))},null,2));
if (report.failures.length) process.exitCode = 1;
