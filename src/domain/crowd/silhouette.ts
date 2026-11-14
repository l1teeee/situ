import { svgPath } from "./geometry";
import { between, type RandomSource } from "./seeded-random";

export type Silhouette = {
  halfWidth: number;
  capHeight: number;
  rise: number;
  profile: (t: number) => number;
  head: { halfWidth: number; centerHeight: number; shoulderHeight: number } | null;
};
export type SilhouetteType = { name: string; weight: number; build: (random: RandomSource) => Silhouette };
export type Outline = { path: string; shiftAt: (t: number) => number; baseY: number };

// Profiles describe half-width from the cap base to its top, in cells.
const superellipse = (exponent: number) => (t: number) => Math.pow(1 - Math.pow(t, exponent), 1 / exponent);

export const SILHOUETTE_TYPES: readonly SilhouetteType[] = [
  { name: "dome", weight: 24, build(random) {
    const halfWidth = between(random, 0.36, 0.5);
    const capHeight = halfWidth * between(random, 0.95, 1.5);
    const rise = between(random, 0.12, 0.42);
    const profile = superellipse(between(random, 2, 2.7));
    return { halfWidth, capHeight, rise, profile, head: null };
  } },
  { name: "tall", weight: 16, build(random) {
    const halfWidth = between(random, 0.25, 0.33);
    const capHeight = halfWidth * between(random, 1.2, 1.9);
    const rise = between(random, 0.5, 0.95);
    const profile = superellipse(between(random, 2, 2.5));
    return { halfWidth, capHeight, rise, profile, head: null };
  } },
  { name: "wide", weight: 11, build(random) {
    const halfWidth = between(random, 0.58, 0.76);
    const capHeight = halfWidth * between(random, 0.55, 0.8);
    const rise = between(random, 0.08, 0.24);
    const profile = superellipse(between(random, 2, 2.4));
    return { halfWidth, capHeight, rise, profile, head: null };
  } },
  { name: "block", weight: 13, build(random) {
    const halfWidth = between(random, 0.34, 0.5);
    const capHeight = halfWidth * between(random, 0.55, 0.95);
    const rise = between(random, 0.15, 0.6);
    const profile = superellipse(between(random, 3.6, 5.5));
    return { halfWidth, capHeight, rise, profile, head: null };
  } },
  { name: "peak", weight: 11, build(random) {
    const halfWidth = between(random, 0.36, 0.5);
    const power = between(random, 0.5, 0.78);
    const capHeight = halfWidth * between(random, 1.5, 2.3);
    const rise = between(random, 0.3, 0.7);
    const profile = (t: number) => Math.pow(1 - t, power);
    return { halfWidth, capHeight, rise, profile, head: null };
  } },
  { name: "bust", weight: 15, build(random) {
    // A head on shoulders: the union of a shoulder dome and a head ellipse.
    const halfWidth = between(random, 0.44, 0.6);
    const shoulderHeight = halfWidth * between(random, 0.45, 0.7);
    const headHalfWidth = between(random, 0.19, 0.26);
    const headHalfHeight = headHalfWidth * between(random, 1.0, 1.35);
    const shoulders = superellipse(between(random, 2, 2.6));
    const rise = between(random, 0.3, 0.6);
    const capHeight = shoulderHeight + headHalfHeight * 1.5;
    const headCenterHeight = shoulderHeight + headHalfHeight * 0.5;
    const profile = (t: number) => {
      const height = t * capHeight;
      const shoulderHalf = height < shoulderHeight ? halfWidth * shoulders(height / shoulderHeight) : 0;
      const headOffset = (height - headCenterHeight) / headHalfHeight;
      const headHalf = Math.abs(headOffset) < 1 ? headHalfWidth * Math.sqrt(1 - headOffset * headOffset) : 0;
      return Math.max(shoulderHalf, headHalf) / halfWidth;
    };
    return {
      halfWidth,
      capHeight,
      rise,
      profile,
      head: { halfWidth: headHalfWidth, centerHeight: headCenterHeight, shoulderHeight },
    };
  } },
  { name: "pear", weight: 10, build(random) {
    const halfWidth = between(random, 0.4, 0.56);
    const taper = between(random, 0.3, 0.48);
    const dome = superellipse(between(random, 2, 2.4));
    const capHeight = halfWidth * between(random, 1.3, 1.9);
    const rise = between(random, 0.3, 0.7);
    const profile = (t: number) => dome(t) * (1 - taper * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5));
    return { halfWidth, capHeight, rise, profile, head: null };
  } },
];

const CAP_SAMPLES = 11;
const BODY_DEPTH = 2.3; // cells below the head line, hidden behind the rows in front

export function buildOutline(random: RandomSource, silhouette: Silhouette, cell: number): Outline {
  const leanAmount = between(random, -0.3, 0.3);
  const lean = random() < 0.45 ? leanAmount : leanAmount * 0.25;
  const leftScale = between(random, 0.94, 1.06);
  const rightScale = between(random, 0.94, 1.06);
  const flare = between(random, 0, 0.1);
  const leftPhase = between(random, 0, Math.PI * 2);
  const rightPhase = between(random, 0, Math.PI * 2);
  const { halfWidth, capHeight, rise, profile } = silhouette;
  const baseY = capHeight - rise;
  const shiftAt = (t: number) => lean * capHeight * Math.pow(t, 1.5);
  // Smooth waves keep close samples near the top from jittering.
  const wobble = (t: number, phase: number) =>
    0.013 * Math.sin(t * 5.2 + phase) + 0.006 * Math.sin(t * 11 + phase * 1.7);
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let step = 0; step < CAP_SAMPLES; step += 1) {
    const t = 1 - Math.pow(1 - step / CAP_SAMPLES, 1.8);
    const half = halfWidth * profile(t);
    const y = baseY - capHeight * t;
    left.push([shiftAt(t) - half * leftScale + wobble(t, leftPhase), y]);
    right.push([shiftAt(t) + half * rightScale + wobble(t, rightPhase), y]);
  }
  right.reverse();
  const midY = (baseY + BODY_DEPTH) / 2;
  const points: [number, number][] = [
    [-halfWidth * leftScale * (1 + flare), BODY_DEPTH],
    [-halfWidth * leftScale * (1 + flare * 0.5) + wobble(-0.5, leftPhase), midY],
    ...left, [shiftAt(1), baseY - capHeight], ...right,
    [halfWidth * rightScale * (1 + flare * 0.5) + wobble(-0.5, rightPhase), midY],
    [halfWidth * rightScale * (1 + flare), BODY_DEPTH],
  ];
  return { path: smoothClosedPath(points.map(([x, y]) => [x * cell, y * cell])), shiftAt, baseY };
}

// Tangent-based control points prevent unevenly spaced samples from kinking.
function smoothClosedPath(points: [number, number][]): string {
  const tangentAt = (index: number): [number, number] => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const length = Math.hypot(next[0] - previous[0], next[1] - previous[1]) || 1;
    return [(next[0] - previous[0]) / length, (next[1] - previous[1]) / length];
  };
  let path = svgPath`M ${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const third = Math.hypot(end[0] - start[0], end[1] - start[1]) / 3;
    const startTangent = tangentAt(index);
    const endTangent = tangentAt(index + 1);
    const control1X = start[0] + startTangent[0] * third;
    const control1Y = start[1] + startTangent[1] * third;
    const control2X = end[0] - endTangent[0] * third;
    const control2Y = end[1] - endTangent[1] * third;
    path += svgPath` C ${control1X} ${control1Y} ${control2X} ${control2Y} ${end[0]} ${end[1]}`;
  }
  return `${path} Z`;
}
