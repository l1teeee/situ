"use client";

import { useEffect, useMemo, useRef } from "react";
import { useElementSize } from "@/components/crowd/useElementSize";
import { useCrowdMotion } from "@/components/crowd/useCrowdMotion";
import { buildCrowd } from "@/domain/crowd/crowd-layout";

const CROWD_SEED = 20261113;

export default function Crowd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(containerRef);
  const crowd = useMemo(
    () => (size ? buildCrowd({ width: size.width, height: size.height, seed: CROWD_SEED }) : null),
    [size],
  );
  const pointerHandlers = useCrowdMotion(canvasRef, crowd, size);

  useEffect(() => {
    function playWelcome() {
      window.removeEventListener("pointerdown", playWelcome);
      window.removeEventListener("keydown", playWelcome);
      const audio = new AudioContext();
      const frequencies = [392, 493.88, 587.33];
      frequencies.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        const start = audio.currentTime + index * 0.08;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        volume.gain.setValueAtTime(0.0001, start);
        volume.gain.exponentialRampToValueAtTime(0.025, start + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
        oscillator.connect(volume);
        volume.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.3);
        if (index === frequencies.length - 1) {
          oscillator.onended = () => { void audio.close(); };
        }
      });
    }

    window.addEventListener("pointerdown", playWelcome);
    window.addEventListener("keydown", playWelcome);
    return () => {
      window.removeEventListener("pointerdown", playWelcome);
      window.removeEventListener("keydown", playWelcome);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-full w-full touch-none select-none"
        {...pointerHandlers}
      />
    </div>
  );
}
