export type RandomSource = () => number;

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashGridCell(seed: number, row: number, column: number): number {
  let hash = seed >>> 0;
  hash = Math.imul(hash ^ (row + 0x9e3779b9), 0x85ebca6b);
  hash = Math.imul(hash ^ (column + 0x7f4a7c15), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function between(random: RandomSource, min: number, max: number): number {
  return min + random() * (max - min);
}

export function pickWeighted<T extends { weight: number }>(random: RandomSource, entries: readonly T[]): T {
  let totalWeight = 0;
  for (const entry of entries) {
    totalWeight += entry.weight;
  }
  let remaining = random() * totalWeight;
  for (const entry of entries) {
    remaining -= entry.weight;
    if (remaining < 0) return entry;
  }
  throw new Error("Weights do not cover the random range");
}
