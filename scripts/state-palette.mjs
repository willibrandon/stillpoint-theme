import { composite, hex, rgba, ratio, textRoles } from './color-math.mjs';

// Fills are independent of readable success/error foregrounds: desaturate toward
// the source's mean channel value, then darken. Search all 8-bit alpha steps.
export function statePalette(palette, variant) {
  const minimum = variant === 'contrast' ? 7 : 4.5;
  const readable = [...textRoles, 'line'].map(role => palette[role]);
  const tint = role => {
    const rgb = rgba(palette[role]).slice(0, 3);
    const mean = rgb.reduce((sum, value) => sum + value, 0) / 3;
    return hex(rgb.map(value => (mean * 0.30 + value * 0.70) * 0.55));
  };
  const solve = (role, target) => {
    const color = tint(role);
    for (let step = 1; step < 255; step++) {
      const wash = hex(rgba(color), step / 255);
      const resolved = composite(wash, palette.bg);
      if (ratio(resolved, palette.bg) >= target && readable.every(foreground => ratio(foreground, resolved) >= minimum)) return wash;
    }
    throw new Error(`No readable ${variant} ${role} wash reaches ${target}:1`);
  };
  const diffInserted = solve('success', 1.40);
  const diffRemoved = solve('error', 1.54);
  const mergeCurrent = solve('accent', 1.40);
  const mergeIncoming = solve('info', 1.40);
  const mergeCommon = solve('keyword', 1.40);
  const stackFrame = solve('warning', 1.40);
  const focusedStackFrame = solve('warning', 1.54);
  const wordWash = wash => hex(rgba(wash), 0.015);
  return {
    diffInserted, diffRemoved, diffInsertedWord: wordWash(diffInserted), diffRemovedWord: wordWash(diffRemoved),
    mergeCurrent, mergeIncoming, mergeCommon, stackFrame, focusedStackFrame,
    // Headers are independently rendered siblings of content, not an opaque tint.
    mergeHeader: '#00000000',
    readonlyOpacity: variant === 'contrast' ? '#000000FF' : '#000000F5'
  };
}
