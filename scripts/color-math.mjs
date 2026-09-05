export const textRoles = ['fg', 'muted', 'comment', 'keyword', 'type', 'function', 'string', 'number', 'property', 'parameter', 'operator', 'error', 'warning', 'info', 'success'];

export function rgba(hex) {
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(hex)) throw new Error(`Invalid color: ${hex}`);
  const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16));
  return [...values.slice(0, 3), (values[3] ?? 255) / 255];
}

export function hex(rgb, alpha) {
  return '#' + [...rgb.slice(0, 3), ...(alpha === undefined ? [] : [alpha * 255])]
    .map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function composite(foreground, background) {
  const [r, g, b, alpha] = rgba(foreground);
  const base = rgba(background);
  if (base[3] !== 1) throw new Error(`Composite needs an opaque base: ${background}`);
  return hex([r, g, b].map((value, index) => value * alpha + base[index] * (1 - alpha)));
}

export function luminance(color) {
  return rgba(color).slice(0, 3).map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

export function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function hue(color) {
  const [r, g, b] = rgba(color).slice(0, 3).map(value => value / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta < 0.005) return null;
  const value = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (value * 60 + 360) % 360;
}

export function hueDistance(a, b) {
  const first = hue(a), second = hue(b);
  if (first === null || second === null) return 0;
  const distance = Math.abs(first - second);
  return Math.min(distance, 360 - distance);
}
