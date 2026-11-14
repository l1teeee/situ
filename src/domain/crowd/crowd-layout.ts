import { clamp, roundCoordinate } from "./geometry";
import { between, createSeededRandom, hashGridCell, pickWeighted } from "./seeded-random";
import { buildOutline, SILHOUETTE_TYPES } from "./silhouette";
import { buildFace, placeFace } from "./face";
import type { Figure } from "./figure";
import { buildArms } from "./arms";

export const PALETTE: readonly string[] = [
  "#e0ae3b", "#d5674a", "#7fa58c", "#6d93c0", "#a98bb8", "#e29a84",
];
// Vivid colors used only while celebrating: the body takes one, the hands another.
export const PARTY_PALETTE: readonly string[] = [
  "#ff5d5d", "#ff8a3c", "#ffc93c", "#b7e04a", "#3fcf8e",
  "#2ec4c6", "#4aa3ff", "#6f7dff", "#b56bff", "#ff6fb5",
];

export type Crowd = { cell: number; strokeWidth: number; figures: readonly Figure[] };

type Layout = { width: number; seed: number; cell: number; topMargin: number; rowStep: number };

function buildFigure(
  layout: Layout,
  row: number,
  index: number,
  cursor: number,
): { figure: Figure; nextCursor: number; depthOrder: number } {
  const { seed, cell, topMargin, rowStep } = layout;
  const random = createSeededRandom(hashGridCell(seed, row, index));
  const type = pickWeighted(random, SILHOUETTE_TYPES);
  const silhouette = type.build(random);
  const outline = buildOutline(random, silhouette, cell);
  const unit = cell * between(random, 0.78, 1.0);
  const face = buildFace(random, unit);
  const anchor = placeFace(random, silhouette, outline, face.halfWidth, cell);
  const figureWidth = silhouette.halfWidth * 2 * cell;
  const x = cursor + figureWidth / 2;
  const y = topMargin + row * rowStep + between(random, -0.04, 0.04) * cell;
  const nextCursor = cursor + figureWidth * between(random, 0.8, 0.9);
  const color = PALETTE[Math.floor(random() * PALETTE.length)];
  const depthOrder = random();
  const swayPhase = random() * Math.PI * 2;
  const arms = buildArms(random, silhouette, outline, anchor.y, unit, cell);
  const partyIndex = Math.floor(random() * PARTY_PALETTE.length);
  // 3 to 6 steps around the palette, so the hands never match the body.
  const handIndex = (partyIndex + 3 + Math.floor(random() * 4)) % PARTY_PALETTE.length;
  return {
    nextCursor,
    depthOrder,
    figure: {
      id: `${row}:${index}`,
      x: roundCoordinate(x),
      y: roundCoordinate(y),
      outlinePath: outline.path,
      eyesPath: face.eyesPath,
      eyeWidth: face.eyeWidth,
      linesPath: face.linesPath,
      faceX: roundCoordinate(anchor.x),
      faceY: roundCoordinate(anchor.y),
      faceTilt: face.tilt,
      focusY: roundCoordinate(y + anchor.y),
      color,
      swayPhase: roundCoordinate(swayPhase),
      happyEyesPath: face.happyEyesPath,
      happyLinesPath: face.happyLinesPath,
      ...arms,
      partyColor: PARTY_PALETTE[partyIndex],
      handColor: PARTY_PALETTE[handIndex],
    },
  };
}

// Packing by width keeps existing figures stable when the viewport grows.
function buildRow(layout: Layout, row: number): Figure[] {
  const rowRandom = createSeededRandom(hashGridCell(layout.seed, row, -1));
  let cursor = -layout.cell * between(rowRandom, 0.7, 1.5);
  const rowFigures: { depthOrder: number; figure: Figure }[] = [];
  for (let index = 0; cursor < layout.width + layout.cell * 0.8; index += 1) {
    const entry = buildFigure(layout, row, index, cursor);
    cursor = entry.nextCursor;
    rowFigures.push(entry);
  }
  rowFigures.sort((a, b) => a.depthOrder - b.depthOrder);
  return rowFigures.map((entry) => entry.figure);
}

export function buildCrowd(viewport: { width: number; height: number; seed: number }): Crowd {
  const { width, height, seed } = viewport;
  // Narrow or tall screens: at least 4 cells across and about 11 visible rows,
  // so phones get readable figures instead of a wall of tiny faces.
  const cell = clamp(Math.max(width / 12.5, Math.min(width / 4, height / 8)), 64, 150);
  const rowStep = cell * 0.6;
  const topMargin = cell * 1.3;
  const strokeWidth = clamp(cell * 0.0145, 1.2, 2);
  const rowCount = Math.ceil((height - topMargin) / rowStep) + 2;
  const figures: Figure[] = [];
  const layout: Layout = { width, seed, cell, topMargin, rowStep };
  for (let row = 0; row < rowCount; row += 1) {
    figures.push(...buildRow(layout, row));
  }
  return { cell, strokeWidth, figures };
}
