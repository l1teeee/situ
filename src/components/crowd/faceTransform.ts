import { roundCoordinate } from "@/domain/crowd/geometry";
import type { Figure } from "@/domain/crowd/figure";

export function faceTransform(figure: Figure, lookX: number, lookY: number): string {
  const x = roundCoordinate(figure.faceX + lookX);
  const y = roundCoordinate(figure.faceY + lookY);
  return `translate(${x} ${y}) rotate(${figure.faceTilt})`;
}
