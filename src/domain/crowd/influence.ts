import { clamp, roundCoordinate } from "./geometry";
import type { Figure } from "./figure";

export const INFLUENCE_RADIUS = 2.6; // cells
export const LIFT = 0.16; // cells
export const LEAN_DEGREES = 4;
export const SWAY_DEGREES = 1.3;
export const SWAY_SPEED = 2.2; // radians per second
export const BOB = 0.018; // cells
export const BOB_SPEED = 1.7; // radians per second
export const LOOK = 0.045; // cells
export const ATTACK_SECONDS = 0.12;
export const RELEASE_SECONDS = 0.5;
export const PIVOT_DEPTH = 1.2; // cells below the head line: the point a figure leans about
export type Pointer = { x: number; y: number };
export type FigurePose = { offsetY: number; rotation: number; lookX: number; lookY: number };

export function targetInfluence(figure: Figure, pointer: Pointer | null, cell: number): number {
  if (!pointer) return 0;
  const distance = Math.hypot(pointer.x - figure.x, pointer.y - figure.focusY);
  const t = clamp(1 - distance / (INFLUENCE_RADIUS * cell), 0, 1);
  return t * t * (3 - 2 * t);
}

// Exponential approach is frame-rate independent.
export function approachInfluence(current: number, target: number, deltaSeconds: number): number {
  const seconds = target > current ? ATTACK_SECONDS : RELEASE_SECONDS;
  const next = current + (target - current) * (1 - Math.exp(-deltaSeconds / seconds));
  return Math.abs(target - next) < 0.001 ? target : next;
}

// The pointer is the last known position, so the pose fades out instead of snapping.
export function figurePose(
  figure: Figure,
  pointer: Pointer,
  influence: number,
  timeSeconds: number,
  cell: number,
  motionScale: number,
): FigurePose {
  const deltaX = pointer.x - figure.x;
  const deltaY = pointer.y - figure.focusY;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const amount = influence * motionScale;
  const lean = LEAN_DEGREES * clamp(deltaX / (INFLUENCE_RADIUS * cell), -1, 1);
  const sway = SWAY_DEGREES * Math.sin(timeSeconds * SWAY_SPEED + figure.swayPhase);
  const bob = BOB * cell * Math.sin(timeSeconds * BOB_SPEED + figure.swayPhase * 1.3);
  const reach = Math.min(1, distance / (cell * 0.6)) * LOOK * cell * amount;
  return {
    offsetY: roundCoordinate((bob - LIFT * cell) * amount),
    rotation: roundCoordinate((lean + sway) * amount),
    lookX: roundCoordinate((deltaX / distance) * reach),
    lookY: roundCoordinate((deltaY / distance) * reach),
  };
}
