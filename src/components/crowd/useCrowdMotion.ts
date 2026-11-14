"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";
import gsap from "gsap";
import { createEntry, drawFigure } from "@/components/crowd/figureEntry";
import { readThemeColor, rgbToCss } from "@/components/crowd/crowdColors";
import type { ElementSize } from "@/components/crowd/useElementSize";
import {
  CELEBRATION_SECONDS, SKY_COLORS, celebrationAmount, celebrationPose, rippleDelay, skyEnvelope,
  type Celebration,
} from "@/domain/crowd/celebration";
import type { Crowd } from "@/domain/crowd/crowd-layout";
import { idlePose, RESTING_IDLE } from "@/domain/crowd/idle";
import { roundCoordinate } from "@/domain/crowd/geometry";
import { BODY_DEPTH } from "@/domain/crowd/silhouette";
import {
  approachInfluence, figurePose, PIVOT_DEPTH, targetInfluence, type FigurePose, type Pointer,
} from "@/domain/crowd/influence";

// Canvas raster cost grows with backing pixels, and phones have the weakest GPUs.
const MAX_PIXEL_RATIO = 2;
const MAX_TOUCH_PIXEL_RATIO = 1.5;

type FieldState = {
  pointer: Pointer | null;
  lastPointer: Pointer;
  tick: gsap.TickerCallback | null;
  awake: boolean;
  motionScale: number;
  cell: number;
  celebrations: { celebration: Celebration; endTime: number; skyColor: string }[];
  pendingClicks: { origin: Pointer; reach: number; skyColor: string }[];
  clickCount: number;
  skyColor: string | null;
  skyOpacity: number;
  entranceStart: number | null;
  entrancePlayed: boolean;
};

const RESTING_POSE: FigurePose = { offsetY: 0, rotation: 0, lookX: 0, lookY: 0 };

function updateSky(state: FieldState, time: number): void {
  let amount = 0;
  for (const { celebration, endTime } of state.celebrations) {
    amount = Math.max(amount, skyEnvelope(time - celebration.startTime, endTime - celebration.startTime));
  }
  const opacity = Math.round(amount * 100) / 100;
  const color = state.celebrations[state.celebrations.length - 1]?.skyColor;
  if (color !== undefined && color !== state.skyColor) {
    state.skyColor = color;
  }
  if (opacity !== state.skyOpacity) {
    state.skyOpacity = opacity;
  }
}

function wake(state: FieldState) {
  if (!document.hidden && !state.awake && state.tick) {
    state.motionScale = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1;
    gsap.ticker.add(state.tick);
    state.awake = true;
  }
}

export function useCrowdMotion(canvasRef: RefObject<HTMLCanvasElement | null>, crowd: Crowd | null,
  size: ElementSize | null) {
  const field = useRef<FieldState>({
    pointer: null,
    lastPointer: { x: 0, y: 0 },
    tick: null,
    awake: false,
    motionScale: 1,
    cell: 0,
    celebrations: [],
    pendingClicks: [],
    clickCount: 0,
    skyColor: null,
    skyOpacity: 0,
    entranceStart: null,
    entrancePlayed: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !crowd || !size) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Crowd canvas has no 2D context");
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const dpr = Math.min(window.devicePixelRatio, coarsePointer ? MAX_TOUCH_PIXEL_RATIO : MAX_PIXEL_RATIO);
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    const background = readThemeColor("--color-background");
    const foreground = rgbToCss(readThemeColor("--color-foreground"));
    const state = field.current;
    state.cell = crowd.cell;
    const sorted = [...crowd.figures].sort((a, b) => b.y - a.y || a.x - b.x);
    const delays = new Map(sorted.map((figure, index) => [
      figure.id, index * Math.min(0.04, 2.5 / crowd.figures.length),
    ]));
    const entries = crowd.figures.map((figure) => createEntry(figure, delays.get(figure.id)!));
    const playEntrance = !state.entrancePlayed;
    if (playEntrance) {
      state.entrancePlayed = true;
      state.entranceStart = null;
    }
    const pivotY = roundCoordinate(PIVOT_DEPTH * crowd.cell);
    let idleTime = 0;
    const tick: gsap.TickerCallback = (time, deltaTime) => {
      idleTime += Math.min(deltaTime / 1000, 0.05);
      for (const { origin, reach, skyColor } of state.pendingClicks) {
        state.celebrations.push({
          celebration: { origin, startTime: time },
          endTime: time + CELEBRATION_SECONDS + rippleDelay(reach, crowd.cell),
          skyColor,
        });
      }
      state.pendingClicks = [];
      state.celebrations = state.celebrations.filter((entry) => entry.endTime > time);
      updateSky(state, time);
      const celebrations = state.celebrations.map((entry) => entry.celebration);
      if (playEntrance && state.entranceStart === null) state.entranceStart = time;
      const elapsed = playEntrance ? time - state.entranceStart! : Infinity;
      let anyActive = state.motionScale !== 0;
      let entranceActive = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, size.width, size.height);
      if (state.skyOpacity > 0 && state.skyColor !== null) {
        ctx.globalAlpha = state.skyOpacity;
        ctx.fillStyle = state.skyColor;
        ctx.fillRect(0, 0, size.width, size.height);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = foreground;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const entry of entries) {
        const target = targetInfluence(entry.figure, state.pointer, crowd.cell);
        const envelope = celebrationAmount(entry.figure, celebrations, time, crowd.cell);
        if (target !== 0 || entry.influence !== 0) {
          entry.influence = approachInfluence(entry.influence, target, deltaTime / 1000);
        }
        if (entry.influence !== 0 || envelope > 0) anyActive = true;
        const hover = entry.influence > 0
          ? figurePose(entry.figure, state.lastPointer, entry.influence, time, crowd.cell, state.motionScale)
          : RESTING_POSE;
        const party = celebrationPose(entry.figure, envelope, time, crowd.cell, state.motionScale);
        const idle = state.motionScale === 0 ? RESTING_IDLE : idlePose(entry.figure, idleTime, crowd.cell);
        const progress = state.motionScale === 0
          ? 1 : Math.max(0, Math.min(1, (elapsed - entry.entranceDelay) / 0.45));
        const entrance = 1 - (1 - progress) ** 5;
        if (progress < 1) entranceActive = true;
        drawFigure(entry, { hover, party, idle, envelope, influence: entry.influence },
          { ctx, pivotY, strokeWidth: crowd.strokeWidth, background, entrance },
          { x: entry.figure.x, y: entry.figure.y + BODY_DEPTH * crowd.cell });
      }
      if (!anyActive && !entranceActive && state.pointer === null &&
        !state.celebrations.length && !state.pendingClicks.length) {
        gsap.ticker.remove(tick);
        state.awake = false;
      }
    };
    state.tick = tick;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function syncPlayback() {
      state.motionScale = reducedMotion.matches ? 0 : 1;
      if (document.hidden) {
        gsap.ticker.remove(tick);
        state.awake = false;
        state.pointer = null;
      } else {
        wake(state);
      }
    }
    document.addEventListener("visibilitychange", syncPlayback);
    reducedMotion.addEventListener("change", syncPlayback);
    syncPlayback();
    return () => {
      document.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion.removeEventListener("change", syncPlayback);
      gsap.ticker.remove(tick);
      state.tick = null;
      state.awake = false;
      state.pointer = null;
      state.celebrations = [];
      state.pendingClicks = [];
      state.skyOpacity = 0;
      state.skyColor = null;
    };
  }, [canvasRef, crowd, size]);

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const state = field.current;
    if (!canvas || !state.tick) return;
    const bounds = canvas.getBoundingClientRect();
    const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    state.pointer = pointer;
    state.lastPointer = pointer;
    wake(state);
  }

  function onPointerLeave() {
    field.current.pointer = null;
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") {
      field.current.pointer = null;
    }
  }

  function onClick(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const state = field.current;
    if (!canvas || !state.tick) return;
    const bounds = canvas.getBoundingClientRect();
    const origin = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const reach = Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(bounds.width - origin.x, origin.y),
      Math.hypot(origin.x, bounds.height - origin.y),
      Math.hypot(bounds.width - origin.x, bounds.height - origin.y),
    ) + 2 * state.cell;
    // The GSAP ticker clock is only trustworthy inside the ticker callback.
    const skyColor = SKY_COLORS[state.clickCount % SKY_COLORS.length];
    state.clickCount += 1;
    state.pendingClicks.push({ origin, reach, skyColor });
    wake(state);
  }

  return {
    onPointerDown: onPointerMove,
    onPointerMove,
    onPointerLeave,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onClick,
  };
}
