import { clamp, roundCoordinate, svgPath } from "./geometry";
import { between, type RandomSource } from "./seeded-random";
import type { Outline, Silhouette } from "./silhouette";

export type Arms = {
  armPath: string;
  armLeftX: number;
  armRightX: number;
  armY: number;
  armAngle: number;
};

const ARM_INSET = 0.7; // shoulder position as a fraction of the half-width
const HAND_RADIUS = 0.055; // cells

// Both arms share a path drawn straight up from the shoulder, because the runtime places, rotates and scales it.
export function buildArms(
  random: RandomSource, silhouette: Silhouette, outline: Outline, faceY: number, unit: number, cell: number,
): Arms {
  const armLength = cell * between(random, 0.3, 0.42);
  const armAngle = roundCoordinate(between(random, 6, 22));
  const height = silhouette.head
    ? silhouette.head.shoulderHeight * 0.55
    : outline.baseY - (faceY + unit * 0.2) / cell;
  const t = clamp(height / silhouette.capHeight, 0, 1);
  const half = silhouette.halfWidth * silhouette.profile(t) * ARM_INSET;
  const centerX = outline.shiftAt(t);
  const handRadius = HAND_RADIUS * cell;
  const diameter = handRadius * 2;
  const armEnd = handRadius - armLength;
  const armPath =
    svgPath`M 0 0 V ${armEnd} M ${-handRadius} ${-armLength}` +
    svgPath` a ${handRadius} ${handRadius} 0 1 0 ${diameter} 0` +
    svgPath` a ${handRadius} ${handRadius} 0 1 0 ${-diameter} 0 Z`;
  return {
    armPath,
    armLeftX: roundCoordinate((centerX - half) * cell),
    armRightX: roundCoordinate((centerX + half) * cell),
    armY: roundCoordinate((outline.baseY - height) * cell),
    armAngle,
  };
}
