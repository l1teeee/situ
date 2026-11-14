import type { Figure } from "./figure";
import type { FigurePose } from "./influence";
import { clamp } from "./geometry";

export type IdlePose = FigurePose & {
  scaleY: number;
  blink: number;
  smile: boolean;
  leftArmReach: number;
  rightArmReach: number;
  leftArmRotation: number;
  rightArmRotation: number;
};

export const RESTING_IDLE: IdlePose = {
  offsetY: 0, rotation: 0, lookX: 0, lookY: 0,
  scaleY: 1, blink: 1, smile: false,
  leftArmReach: 0, rightArmReach: 0,
  leftArmRotation: 0, rightArmRotation: 0,
};

function smoothStep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

// Each figure changes its gesture every cycle, with a quiet pause between actions.
export function idlePose(figure: Figure, time: number, cell: number): IdlePose {
  const phase = figure.swayPhase;
  const period = 7 + phase * 0.55;
  const clock = time + phase * 1.73;
  const cycle = Math.floor(clock / period);
  const local = clock - cycle * period;
  const duration = 3.1;
  const amount = smoothStep(local / 0.4) * smoothStep((duration - local) / 0.5);
  const breath = Math.sin(time * 1.8 + phase);
  const blinkClock = (time + phase * 2) % (3.3 + phase * 0.3);
  const blink = 1 - 0.94 * Math.sin(Math.PI * clamp(blinkClock / 0.18, 0, 1));
  const pose: IdlePose = {
    ...RESTING_IDLE,
    offsetY: -cell * 0.006 * (1 + breath),
    rotation: Math.sin(time * 0.9 + phase) * 0.6,
    scaleY: 1 + breath * 0.006,
    blink,
  };
  if (amount === 0) return pose;

  const gesture = (cycle + Math.floor(phase * 11)) % 5;
  const beat = Math.sin(local * 8);
  switch (gesture) {
    case 0: // Look at a neighbour, then look the other way.
      pose.lookX = Math.sin(local * 2.3) * cell * 0.055 * amount;
      pose.lookY = -cell * 0.012 * amount;
      pose.rotation += Math.sin(local * 2.3) * 2 * amount;
      break;
    case 1: // A one-handed hello.
      pose.smile = amount > 0.3;
      pose.rightArmReach = amount;
      pose.rightArmRotation = figure.armAngle + 24 + beat * 23;
      pose.rotation += 2 * amount;
      pose.lookX = cell * 0.025 * amount;
      break;
    case 2: // Laugh, with little shoulder bounces.
      pose.smile = amount > 0.2;
      pose.offsetY -= Math.abs(beat) * cell * 0.035 * amount;
      pose.scaleY -= Math.abs(beat) * 0.025 * amount;
      pose.rotation += Math.sin(local * 5) * 2.5 * amount;
      break;
    case 3: { // Crouch, then make two small jumps.
      const jumpTime = local - 0.45;
      const jumping = jumpTime > 0 && jumpTime < 1.6;
      const hop = jumping ? Math.abs(Math.sin(jumpTime * Math.PI / 0.8)) : 0;
      const crouch = local < 0.45 ? Math.sin(local * Math.PI / 0.45) : 0;
      pose.smile = amount > 0.3;
      pose.offsetY += cell * (crouch * 0.03 - hop * 0.13) * amount;
      pose.scaleY += (hop * 0.025 - crouch * 0.05) * amount;
      pose.leftArmReach = hop * amount;
      pose.rightArmReach = hop * amount;
      pose.leftArmRotation = -figure.armAngle - 30;
      pose.rightArmRotation = figure.armAngle + 30;
      break;
    }
    case 4: // A cheerful nod and a small wave with the other hand.
      pose.smile = amount > 0.3;
      pose.lookY = (1 - Math.cos(local * 5)) * cell * 0.018 * amount;
      pose.rotation += Math.sin(local * 3) * 2 * amount;
      pose.leftArmReach = amount * 0.8;
      pose.leftArmRotation = -figure.armAngle - 18 + Math.sin(local * 10) * 15;
      break;
  }
  return pose;
}
