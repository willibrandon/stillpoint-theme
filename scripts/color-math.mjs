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

// Public-domain linear-sRGB conversion by Björn Ottosson:
// https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
export function oklab(color) {
  const [r, g, b] = rgba(color).slice(0, 3).map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

export function colorDistance(first, second) {
  const a = oklab(first), b = oklab(second);
  return Math.hypot(...a.map((value, i) => value - b[i]));
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
