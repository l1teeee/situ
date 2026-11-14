import { faceTransform } from "@/components/crowd/faceTransform";
import { HAPPY_THRESHOLD, type CelebrationPose } from "@/domain/crowd/celebration";
import type { Figure } from "@/domain/crowd/figure";
import type { IdlePose } from "@/domain/crowd/idle";
import { roundCoordinate } from "@/domain/crowd/geometry";
import type { FigurePose } from "@/domain/crowd/influence";

export type FigureEntry = {
  figure: Figure;
  body: SVGGElement;
  outline: SVGPathElement;
  arms: SVGGElement;
  armLeft: SVGPathElement;
  armRight: SVGPathElement;
  face: SVGGElement;
  seriousFace: SVGGElement;
  happyFace: SVGGElement;
  seriousEyes: SVGGElement;
  happyEyes: SVGGElement;
  influence: number;
  active: boolean;
  armsVisible: boolean;
  happy: boolean;
  fill: string;
};

export type FigureFrame = {
  hover: FigurePose;
  party: CelebrationPose;
  envelope: number;
  influence: number;
  idle: IdlePose;
};

function outlineFill(figure: Figure, influence: number, envelope: number): string {
  const hoverPercentage = roundCoordinate(influence * 100);
  const hoverFill = `color-mix(in srgb, var(--color-background), ${figure.color} ${hoverPercentage}%)`;
  return envelope > 0
    ? `color-mix(in srgb, ${hoverFill}, ${figure.partyColor} ${roundCoordinate(envelope * 100)}%)`
    : hoverFill;
}

function findPart<T extends Element>(element: Element | undefined, id: string, part: string): T {
  const result = element?.querySelector<T>(`[data-part="${part}"]`);
  if (!result) {
    throw new Error(`Figure "${id}" missing part "${part}"`);
  }
  return result;
}

export function createEntry(figure: Figure, elements: Map<string | undefined, SVGGElement>): FigureEntry {
  const element = elements.get(figure.id);
  return {
    figure,
    body: findPart<SVGGElement>(element, figure.id, "body"),
    outline: findPart<SVGPathElement>(element, figure.id, "outline"),
    arms: findPart<SVGGElement>(element, figure.id, "arms"),
    armLeft: findPart<SVGPathElement>(element, figure.id, "arm-left"),
    armRight: findPart<SVGPathElement>(element, figure.id, "arm-right"),
    face: findPart<SVGGElement>(element, figure.id, "face"),
    seriousFace: findPart<SVGGElement>(element, figure.id, "serious-face"),
    happyFace: findPart<SVGGElement>(element, figure.id, "happy-face"),
    seriousEyes: findPart<SVGGElement>(element, figure.id, "serious-eyes"),
    happyEyes: findPart<SVGGElement>(element, figure.id, "happy-eyes"),
    influence: 0,
    active: false,
    armsVisible: false,
    happy: false,
    fill: "",
  };
}

function setTransform(element: SVGElement, transform: string): void {
  if (element.getAttribute("transform") !== transform) {
    element.setAttribute("transform", transform);
  }
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// Per-frame updates of dozens of figures must not go through React state.
export function applyFrame(entry: FigureEntry, frame: FigureFrame, pivotY: number): void {
  const { hover, party, idle } = frame;
  const idleAmount = 1 - Math.max(frame.influence, frame.envelope);
  const offset = roundCoordinate(hover.offsetY - party.hop + idle.offsetY * idleAmount);
  const rotation = roundCoordinate(hover.rotation + party.wiggle + idle.rotation * idleAmount);
  const scaleY = roundScale(1 + (idle.scaleY - 1) * idleAmount);
  setTransform(entry.body, `translate(0 ${offset}) rotate(${rotation} 0 ${pivotY}) ` +
    `translate(0 ${pivotY}) scale(1 ${scaleY}) translate(0 ${-pivotY})`);
  setTransform(entry.face, faceTransform(entry.figure,
    hover.lookX + idle.lookX * idleAmount, hover.lookY + idle.lookY * idleAmount));
  const blink = `scale(1 ${roundScale(idle.blink)})`;
  setTransform(entry.seriousEyes, blink);
  setTransform(entry.happyEyes, blink);
  const fill = frame.influence === 0 && frame.envelope === 0
    ? "" : outlineFill(entry.figure, frame.influence, frame.envelope);
  if (fill !== entry.fill) {
    entry.outline.style.fill = fill;
    entry.fill = fill;
  }
  const celebrating = frame.envelope > 0;
  const leftReach = celebrating ? party.armReach : idle.leftArmReach * idleAmount;
  const rightReach = celebrating ? party.armReach : idle.rightArmReach * idleAmount;
  const armsVisible = leftReach > 0.01 || rightReach > 0.01;
  if (armsVisible !== entry.armsVisible) {
    entry.arms.setAttribute("visibility", armsVisible ? "visible" : "hidden");
    entry.armsVisible = armsVisible;
  }
  if (armsVisible) {
    const { armLeftX, armRightX, armY } = entry.figure;
    const leftRotation = celebrating ? party.leftArmRotation : idle.leftArmRotation;
    const rightRotation = celebrating ? party.rightArmRotation : idle.rightArmRotation;
    setTransform(entry.armLeft, `translate(${armLeftX} ${armY}) ` +
      `rotate(${roundCoordinate(leftRotation)}) scale(${roundScale(leftReach)})`);
    setTransform(entry.armRight, `translate(${armRightX} ${armY}) ` +
      `rotate(${roundCoordinate(rightRotation)}) scale(${roundScale(rightReach)})`);
  }
  const happy = frame.envelope > HAPPY_THRESHOLD || (idle.smile && idleAmount > 0.5);
  if (happy !== entry.happy) {
    entry.seriousFace.setAttribute("visibility", happy ? "hidden" : "visible");
    entry.happyFace.setAttribute("visibility", happy ? "visible" : "hidden");
    entry.happy = happy;
  }
  entry.active = true;
}

export function resetEntry(entry: FigureEntry): void {
  entry.body.removeAttribute("transform");
  entry.face.setAttribute("transform", faceTransform(entry.figure, 0, 0));
  entry.seriousEyes.removeAttribute("transform");
  entry.happyEyes.removeAttribute("transform");
  entry.outline.style.removeProperty("fill");
  entry.arms.setAttribute("visibility", "hidden");
  entry.happyFace.setAttribute("visibility", "hidden");
  entry.seriousFace.setAttribute("visibility", "visible");
  entry.active = false;
  entry.armsVisible = false;
  entry.happy = false;
  entry.fill = "";
}
