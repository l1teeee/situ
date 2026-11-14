import { roundCoordinate } from "./geometry";
import type { Figure } from "./figure";
import type { Pointer } from "./influence";

export const RIPPLE_SPEED = 9; // cells per second
export const CELEBRATION_ATTACK_SECONDS = 0.14;
export const CELEBRATION_HOLD_SECONDS = 1.9;
export const CELEBRATION_RELEASE_SECONDS = 0.55;
export const CELEBRATION_SECONDS = CELEBRATION_ATTACK_SECONDS + CELEBRATION_HOLD_SECONDS +
  CELEBRATION_RELEASE_SECONDS;
export const HOP = 0.2; // cells
export const HOP_SPEED = 7.2; // radians per second; a hop is half a cycle
export const WIGGLE_DEGREES = 2.5;
export const ARM_WAVE_DEGREES = 13;
export const ARM_WAVE_SPEED = 13; // radians per second
export const HAPPY_THRESHOLD = 0.5; // envelope above which the happy face shows

// Each click lights the background with the next of these colors.
export const SKY_COLORS: readonly string[] = ["#ffd23f", "#ff8fc7", "#7cc6ff", "#9be36b"];
export const SKY_ATTACK_SECONDS = 0.25;
export const SKY_RELEASE_SECONDS = 0.8;

// 0 to 1 and back over one celebration: `totalSeconds` is how long the whole
// ripple takes to cross the crowd and finish.
export function skyEnvelope(elapsedSeconds: number, totalSeconds: number): number {
  if (elapsedSeconds <= 0 || elapsedSeconds >= totalSeconds) return 0;
  const rise = Math.min(1, elapsedSeconds / SKY_ATTACK_SECONDS);
  const fall = Math.min(1, (totalSeconds - elapsedSeconds) / SKY_RELEASE_SECONDS);
  return Math.min(rise, fall);
}

export type Celebration = { origin: Pointer; startTime: number };
export type CelebrationPose = {
  hop: number;
  wiggle: number;
  armReach: number;
  leftArmRotation: number;
  rightArmRotation: number;
};

export function rippleDelay(distance: number, cell: number): number {
  return distance / (RIPPLE_SPEED * cell);
}

export function celebrationEnvelope(localSeconds: number): number {
  if (localSeconds <= 0) return 0;
  if (localSeconds < CELEBRATION_ATTACK_SECONDS) return localSeconds / CELEBRATION_ATTACK_SECONDS;
  const fadeStart = CELEBRATION_ATTACK_SECONDS + CELEBRATION_HOLD_SECONDS;
  if (localSeconds < fadeStart) return 1;
  const remaining = 1 - (localSeconds - fadeStart) / CELEBRATION_RELEASE_SECONDS;
  return remaining > 0 ? remaining * remaining * (3 - 2 * remaining) : 0;
}

export function celebrationAmount(
  figure: Figure, celebrations: readonly Celebration[], timeSeconds: number, cell: number,
): number {
  let amount = 0;
  for (const celebration of celebrations) {
    const distance = Math.hypot(celebration.origin.x - figure.x, celebration.origin.y - figure.focusY);
    const localSeconds = timeSeconds - celebration.startTime - rippleDelay(distance, cell);
    amount = Math.max(amount, celebrationEnvelope(localSeconds));
  }
  return amount;
}

// With motionScale 0 (reduced motion), arms still come up and the face still smiles,
// but nothing hops or waves.
export function celebrationPose(
  figure: Figure, envelope: number, timeSeconds: number, cell: number, motionScale: number,
): CelebrationPose {
  const amount = envelope * motionScale;
  const hopPhase = timeSeconds * HOP_SPEED + figure.swayPhase * 2;
  const wavePhase = timeSeconds * ARM_WAVE_SPEED + figure.swayPhase * 3;
  return {
    hop: roundCoordinate(HOP * cell * Math.abs(Math.sin(hopPhase)) * amount),
    wiggle: roundCoordinate(WIGGLE_DEGREES * Math.sin(hopPhase) * amount),
    armReach: envelope,
    leftArmRotation: roundCoordinate(-figure.armAngle + ARM_WAVE_DEGREES * Math.sin(wavePhase) * motionScale),
    rightArmRotation: roundCoordinate(
      figure.armAngle + ARM_WAVE_DEGREES * Math.sin(wavePhase + 2.1) * motionScale,
    ),
  };
}
