import { mixRgb, parseHexColor, rgbToCss, type Rgb } from "@/components/crowd/crowdColors";
import { HAPPY_THRESHOLD, type CelebrationPose } from "@/domain/crowd/celebration";
import type { Figure } from "@/domain/crowd/figure";
import type { IdlePose } from "@/domain/crowd/idle";
import { roundCoordinate } from "@/domain/crowd/geometry";
import type { FigurePose } from "@/domain/crowd/influence";

export type FigureEntry = {
  figure: Figure;
  outline: Path2D;
  arm: Path2D;
  eyes: Path2D;
  lines: Path2D;
  happyEyes: Path2D;
  happyLines: Path2D;
  color: Rgb;
  partyColor: Rgb;
  influence: number;
  entranceDelay: number;
};

export type FigureFrame = {
  hover: FigurePose;
  party: CelebrationPose;
  envelope: number;
  influence: number;
  idle: IdlePose;
};

export type FigurePaint = {
  ctx: CanvasRenderingContext2D;
  pivotY: number;
  strokeWidth: number;
  background: Rgb;
  entrance: number;
};

export function createEntry(figure: Figure, entranceDelay: number): FigureEntry {
  return {
    figure,
    outline: new Path2D(figure.outlinePath),
    arm: new Path2D(figure.armPath),
    eyes: new Path2D(figure.eyesPath),
    lines: new Path2D(figure.linesPath),
    happyEyes: new Path2D(figure.happyEyesPath),
    happyLines: new Path2D(figure.happyLinesPath),
    color: parseHexColor(figure.color),
    partyColor: parseHexColor(figure.partyColor),
    influence: 0,
    entranceDelay,
  };
}

function outlineFill(entry: FigureEntry, influence: number, envelope: number, background: Rgb): string {
  if (influence === 0 && envelope === 0) return rgbToCss(background);
  const hover = mixRgb(background, entry.color, influence);
  return rgbToCss(envelope > 0 ? mixRgb(hover, entry.partyColor, envelope) : hover);
}

export function drawFigure(
  entry: FigureEntry, frame: FigureFrame, paint: FigurePaint, entranceOrigin: { x: number; y: number },
): void {
  const { ctx, pivotY, strokeWidth, background, entrance } = paint;
  const { figure } = entry;
  const { hover, party, idle } = frame;
  const idleAmount = 1 - Math.max(frame.influence, frame.envelope);
  const offset = roundCoordinate(hover.offsetY - party.hop + idle.offsetY * idleAmount);
  const rotation = roundCoordinate(hover.rotation + party.wiggle + idle.rotation * idleAmount);
  const scaleY = Math.round((1 + (idle.scaleY - 1) * idleAmount) * 1000) / 1000;
  const radians = Math.PI / 180;
  ctx.save();
  if (entrance !== 1) {
    ctx.globalAlpha = entrance;
    ctx.translate(entranceOrigin.x, entranceOrigin.y);
    ctx.translate(0, 18 * (1 - entrance));
    const scale = 0.94 + 0.06 * entrance;
    ctx.scale(scale, scale);
    ctx.translate(-entranceOrigin.x, -entranceOrigin.y);
  }
  ctx.translate(figure.x, figure.y);
  ctx.translate(0, offset);
  ctx.translate(0, pivotY);
  ctx.rotate(rotation * radians);
  ctx.scale(1, scaleY);
  ctx.translate(0, -pivotY);
  ctx.lineWidth = strokeWidth;
  ctx.fillStyle = outlineFill(entry, frame.influence, frame.envelope, background);
  ctx.fill(entry.outline);
  ctx.stroke(entry.outline);
  const celebrating = frame.envelope > 0;
  const leftReach = celebrating ? party.armReach : idle.leftArmReach * idleAmount;
  const rightReach = celebrating ? party.armReach : idle.rightArmReach * idleAmount;
  const leftRotation = celebrating ? party.leftArmRotation : idle.leftArmRotation;
  const rightRotation = celebrating ? party.rightArmRotation : idle.rightArmRotation;
  ctx.fillStyle = figure.handColor;
  for (const [x, reach, armRotation] of [
    [figure.armLeftX, leftReach, leftRotation], [figure.armRightX, rightReach, rightRotation],
  ]) {
    if (reach <= 0.01) continue;
    ctx.save();
    ctx.translate(x, figure.armY);
    ctx.rotate(roundCoordinate(armRotation) * radians);
    const armScale = Math.round(reach * 1000) / 1000;
    ctx.scale(armScale, armScale);
    ctx.fill(entry.arm);
    ctx.stroke(entry.arm);
    ctx.restore();
  }
  ctx.translate(roundCoordinate(figure.faceX + hover.lookX + idle.lookX * idleAmount),
    roundCoordinate(figure.faceY + hover.lookY + idle.lookY * idleAmount));
  ctx.rotate(figure.faceTilt * radians);
  const happy = frame.envelope > HAPPY_THRESHOLD || (idle.smile && idleAmount > 0.5);
  ctx.save();
  ctx.scale(1, Math.round(idle.blink * 1000) / 1000);
  ctx.lineWidth = happy ? strokeWidth : figure.eyeWidth;
  ctx.stroke(happy ? entry.happyEyes : entry.eyes);
  ctx.restore();
  ctx.stroke(happy ? entry.happyLines : entry.lines);
  ctx.restore();
}
