import { roundCoordinate, svgPath } from "./geometry";
import { between, pickWeighted, type RandomSource } from "./seeded-random";
import type { Outline, Silhouette } from "./silhouette";

export type Face = {
  happyEyesPath: string;
  happyLinesPath: string;
  eyesPath: string;
  eyeWidth: number;
  linesPath: string;
  tilt: number;
  halfWidth: number;
};

function buildHappyFace(unit: number, eyeHalf: number, eyeDrop: number, nose: string, noseEnd: number) {
  const arc = unit * 0.036;
  const happyEye = (x: number, y: number) => {
    const endY = y + arc * 0.5;
    return svgPath`M ${x - arc} ${endY} Q ${x} ${y - arc * 1.3} ${x + arc} ${endY}`;
  };
  const smileHalf = unit * 0.085;
  const smileY = noseEnd + unit * 0.06 - unit * 0.01;
  const smileControlY = smileY + smileHalf * 1.25;
  return {
    happyEyesPath: `${happyEye(-eyeHalf, 0)} ${happyEye(eyeHalf, eyeDrop)}`,
    happyLinesPath: nose + svgPath` M ${-smileHalf} ${smileY} Q 0 ${smileControlY} ${smileHalf} ${smileY}`,
  };
}

const EYE_TYPES = [
  { name: "dot", weight: 5 },
  { name: "dash", weight: 3 },
  { name: "tall", weight: 2 },
];
const NOSE_TYPES = [
  { name: "line", weight: 3 },
  { name: "hook", weight: 3 },
  { name: "angle", weight: 3 },
  { name: "long", weight: 2 },
  { name: "bridge", weight: 2 },
];
const MOUTH_TYPES = [
  { name: "none", weight: 5 },
  { name: "flat", weight: 4 },
  { name: "low", weight: 2 },
];

function buildEyes(type: string, unit: number, eyeHalf: number, eyeDrop: number): string {
  const eyeStroke = unit * 0.026;
  if (type === "dot") {
    return svgPath`M ${-eyeHalf} 0 h 0.01 M ${eyeHalf} ${eyeDrop} h 0.01`;
  }
  const length = eyeStroke * 2;
  if (type === "dash") {
    const left = -eyeHalf - eyeStroke;
    const right = eyeHalf - eyeStroke;
    return svgPath`M ${left} 0 h ${length} M ${right} ${eyeDrop} h ${length}`;
  }
  const rightY = eyeDrop - eyeStroke;
  return svgPath`M ${-eyeHalf} ${-eyeStroke} v ${length} M ${eyeHalf} ${rightY} v ${length}`;
}

function buildNose(
  random: RandomSource,
  type: string,
  unit: number,
  side: number,
): { path: string; end: number } {
  const noseTop = unit * 0.035;
  let noseEnd = unit * between(random, 0.13, 0.17);
  let path: string;
  if (type === "line") {
    path = svgPath`M 0 ${noseTop} L ${side * unit * 0.008} ${noseEnd}`;
  } else if (type === "hook") {
    const bendY = noseEnd - unit * 0.03;
    const footX = side * unit * 0.045;
    path = svgPath`M 0 ${noseTop} L 0 ${bendY} Q 0 ${noseEnd} ${footX} ${noseEnd}`;
  } else if (type === "angle") {
    path = svgPath`M 0 ${noseTop} L 0 ${noseEnd} L ${side * unit * 0.05} ${noseEnd}`;
  } else if (type === "long") {
    noseEnd = unit * between(random, 0.2, 0.25);
    path = svgPath`M 0 ${noseTop} L ${side * unit * 0.01} ${noseEnd}`;
  } else {
    const startX = -side * unit * 0.03;
    const startY = -unit * 0.005;
    const controlX = side * unit * 0.012;
    const controlY = unit * 0.07;
    const footX = side * unit * 0.04;
    path = svgPath`M ${startX} ${startY} Q ${controlX} ${controlY} ${footX} ${noseEnd} L 0 ${noseEnd}`;
  }
  return { path, end: noseEnd };
}

function buildMouth(random: RandomSource, type: string, unit: number, noseEnd: number): string {
  const mouthY = noseEnd + unit * 0.06;
  const mouthHalf = unit * between(random, 0.04, 0.06);
  if (type === "flat") {
    const slope = unit * between(random, -0.008, 0.008);
    return svgPath` M ${-mouthHalf} ${mouthY} L ${mouthHalf} ${mouthY + slope}`;
  }
  if (type === "low") {
    const endY = mouthY + unit * 0.012;
    const controlY = mouthY - unit * 0.014;
    return svgPath` M ${-mouthHalf} ${endY} Q 0 ${controlY} ${mouthHalf} ${endY}`;
  }
  return "";
}

export function buildFace(random: RandomSource, unit: number): Face {
  const eyeType = pickWeighted(random, EYE_TYPES).name;
  const noseType = pickWeighted(random, NOSE_TYPES).name;
  const mouthType = pickWeighted(random, MOUTH_TYPES).name;
  const eyeHalf = unit * between(random, 0.075, 0.115);
  const eyeDrop = unit * between(random, -0.012, 0.012);
  const side = random() < 0.5 ? -1 : 1;
  const eyesPath = buildEyes(eyeType, unit, eyeHalf, eyeDrop);
  const nose = buildNose(random, noseType, unit, side);
  const linesPath = nose.path + buildMouth(random, mouthType, unit, nose.end);
  const tilt = roundCoordinate(between(random, -9, 9));
  const happy = buildHappyFace(unit, eyeHalf, eyeDrop, nose.path, nose.end);
  return {
    ...happy,
    eyesPath,
    eyeWidth: roundCoordinate(Math.max(2.4, unit * (eyeType === "dot" ? 0.042 : 0.03))),
    linesPath,
    tilt,
    halfWidth: eyeHalf + unit * 0.05,
  };
}

// Place the face at the first depth where the silhouette is wide enough.
const MIN_FACE_DEPTH = 0.19;
export function placeFace(
  random: RandomSource,
  silhouette: Silhouette,
  outline: Outline,
  faceHalfWidth: number,
  cell: number,
): { x: number; y: number } {
  if (silhouette.head) {
    const height = silhouette.head.centerHeight + silhouette.head.halfWidth * 0.2;
    return {
      x: outline.shiftAt(height / silhouette.capHeight) * cell,
      y: (outline.baseY - height) * cell,
    };
  }
  const neededHalfWidth = (faceHalfWidth / cell) * 1.3;
  let t = 0.97;
  while (t > 0 && silhouette.halfWidth * silhouette.profile(t) < neededHalfWidth) {
    t -= 0.02;
  }
  const depth = Math.max((1 - t) * silhouette.capHeight + 0.07, MIN_FACE_DEPTH) + between(random, 0, 0.05);
  const gaze = between(random, -0.05, 0.05);
  const x = outline.shiftAt(Math.max(0, t - 0.1)) + gaze;
  const y = outline.baseY - silhouette.capHeight + depth;
  return { x: x * cell, y: y * cell };
}
