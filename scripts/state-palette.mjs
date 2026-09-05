import { composite, hex, rgba, ratio, textRoles } from './color-math.mjs';

// Fills are independent of readable success/error foregrounds: desaturate toward
// the source's mean channel value, then darken. Search all 8-bit alpha steps.
export function statePalette(palette, variant) {
  const minimum = variant === 'contrast' ? 7 : 4.5;
  const readable = textRoles.map(role => palette[role]);
  const tint = role => {
    const rgb = rgba(palette[role]).slice(0, 3);
    const mean = rgb.reduce((sum, value) => sum + value, 0) / 3;
    // Day's darker readable foregrounds need a shallower tint reduction to
    // retain a green/red distinction over its warm paper after 8-bit rounding.
    const depth = variant === 'day' && ['success', 'error'].includes(role) ? 0.75 : 0.55;
    return hex(rgb.map(value => (mean * 0.30 + value * 0.70) * depth));
  };
  const solve = (role, target, foregrounds = readable) => {
    const color = tint(role);
    for (let step = 1; step < 255; step++) {
      const wash = hex(rgba(color), step / 255);
      const resolved = composite(wash, palette.bg);
      if (ratio(resolved, palette.bg) >= target && foregrounds.every(foreground => ratio(foreground, resolved) >= minimum)) return wash;
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
  // Only Contrast replaces selected syntax with a single, white foreground.
  const activeSelection = variant === 'contrast' ? '#345566' : palette.selection;
  let inactiveSelection;
  for (let step = 1; step < 255; step++) {
    const wash = hex(rgba(activeSelection), step / 255);
    if (ratio(composite(wash, palette.bg), palette.bg) >= (variant === 'day' ? 1.38 : 1.3)) {
      inactiveSelection = wash;
      break;
    }
  }
  if (!inactiveSelection) throw new Error(`No visible ${variant} inactive selection`);
  return {
    diffInserted, diffRemoved, diffInsertedWord: wordWash(diffInserted), diffRemovedWord: wordWash(diffRemoved),
    mergeCurrent, mergeIncoming, mergeCommon, stackFrame, focusedStackFrame,
    // Header lines and their description labels are siblings of content lines.
    mergeCurrentHeader: solve('accent', 1.65, [palette.fg, palette.muted]),
    mergeIncomingHeader: solve('info', 1.65, [palette.fg, palette.muted]),
    mergeCommonHeader: solve('keyword', 1.65, [palette.fg, palette.muted]),
    activeSelection, inactiveSelection, listHover: hex(rgba(activeSelection), 0.5),
    // Native unused ranges retain a visible 20% fade, even under selection.
    unusedOpacity: variant === 'contrast' ? '#000000FF' : '#000000CC'
  };
}
