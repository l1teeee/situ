export type Rgb = readonly [number, number, number];

export function parseHexColor(value: string): Rgb {
  const hex = value.trim();
  if (!/^#[\da-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a #rrggbb color, got "${value}"`);
  }
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

export function rgbToCss(color: Rgb): string {
  return `rgb(${Math.round(color[0])} ${Math.round(color[1])} ${Math.round(color[2])})`;
}

export function readThemeColor(name: string): Rgb {
  return parseHexColor(getComputedStyle(document.documentElement).getPropertyValue(name));
}
