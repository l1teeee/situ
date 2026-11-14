"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";
import gsap from "gsap";
import { applyFrame, createEntry, resetEntry } from "@/components/crowd/figureEntry";
import {
  CELEBRATION_SECONDS, SKY_COLORS, celebrationAmount, celebrationPose, rippleDelay, skyEnvelope,
  type Celebration,
} from "@/domain/crowd/celebration";
import type { Crowd } from "@/domain/crowd/crowd-layout";
import { idlePose, RESTING_IDLE } from "@/domain/crowd/idle";
import { roundCoordinate } from "@/domain/crowd/geometry";
import {
  approachInfluence, figurePose, PIVOT_DEPTH, targetInfluence, type FigurePose, type Pointer,
} from "@/domain/crowd/influence";

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
};

const RESTING_POSE: FigurePose = { offsetY: 0, rotation: 0, lookX: 0, lookY: 0 };

function updateSky(sky: SVGRectElement, state: FieldState, time: number): void {
  let amount = 0;
  for (const { celebration, endTime } of state.celebrations) {
    amount = Math.max(amount, skyEnvelope(time - celebration.startTime, endTime - celebration.startTime));
  }
  const opacity = Math.round(amount * 100) / 100;
  const color = state.celebrations[state.celebrations.length - 1]?.skyColor;
  if (color !== undefined && color !== state.skyColor) {
    sky.setAttribute("fill", color);
    state.skyColor = color;
  }
  if (opacity !== state.skyOpacity) {
    sky.setAttribute("opacity", String(opacity));
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

export function useCrowdMotion(svgRef: RefObject<SVGSVGElement | null>, crowd: Crowd | null) {
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
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !crowd) return;
    const sky = svg.querySelector<SVGRectElement>('[data-part="sky"]');
    if (!sky) {
      throw new Error("Crowd missing sky");
    }
    const state = field.current;
    state.cell = crowd.cell;
    const elements = new Map(
      Array.from(svg.querySelectorAll<SVGGElement>("[data-figure]"), (element) => [
        element.dataset.figure,
        element,
      ]),
    );
    const entries = crowd.figures.map((figure) => createEntry(figure, elements));
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
      updateSky(sky, state, time);
      const celebrations = state.celebrations.map((entry) => entry.celebration);
      let anyActive = false;
      for (const entry of entries) {
        const target = targetInfluence(entry.figure, state.pointer, crowd.cell);
        const envelope = celebrationAmount(entry.figure, celebrations, time, crowd.cell);
        if (target !== 0 || entry.influence !== 0) {
          entry.influence = approachInfluence(entry.influence, target, deltaTime / 1000);
        }
        if (state.motionScale === 0 && entry.influence === 0 && envelope === 0) {
          if (entry.active) {
            resetEntry(entry);
          }
          continue;
        }
        anyActive = true;
        const hover = entry.influence > 0
          ? figurePose(entry.figure, state.lastPointer, entry.influence, time, crowd.cell, state.motionScale)
          : RESTING_POSE;
        const party = celebrationPose(entry.figure, envelope, time, crowd.cell, state.motionScale);
        const idle = state.motionScale === 0 ? RESTING_IDLE : idlePose(entry.figure, idleTime, crowd.cell);
        applyFrame(entry, { hover, party, idle, envelope, influence: entry.influence }, pivotY);
      }
      if (!anyActive && state.pointer === null && !state.celebrations.length && !state.pendingClicks.length) {
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
      sky.setAttribute("opacity", "0");
      state.skyOpacity = 0;
      state.skyColor = null;
      for (const entry of entries) {
        if (entry.active) {
          resetEntry(entry);
        }
      }
    };
  }, [svgRef, crowd]);

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const state = field.current;
    if (!svg || !state.tick) return;
    const bounds = svg.getBoundingClientRect();
    const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    state.pointer = pointer;
    state.lastPointer = pointer;
    wake(state);
  }

  function onPointerLeave() {
    field.current.pointer = null;
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "touch") {
      field.current.pointer = null;
    }
  }

  function onClick(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const state = field.current;
    if (!svg || !state.tick) return;
    const bounds = svg.getBoundingClientRect();
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
