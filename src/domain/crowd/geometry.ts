export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

export function svgPath(strings: TemplateStringsArray, ...coordinates: number[]): string {
  let path = strings[0];
  for (let index = 0; index < coordinates.length; index += 1) {
    path += roundCoordinate(coordinates[index]) + strings[index + 1];
  }
  return path;
}
