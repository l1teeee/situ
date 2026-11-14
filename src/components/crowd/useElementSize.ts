"use client";

import { useEffect, useState, type RefObject } from "react";

export type ElementSize = { width: number; height: number };

export function useElementSize(elementRef: RefObject<Element | null>): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[entries.length - 1].contentRect;
      const nextWidth = Math.round(width);
      const nextHeight = Math.round(height);
      setSize((previous) =>
        previous && previous.width === nextWidth && previous.height === nextHeight
          ? previous
          : { width: nextWidth, height: nextHeight },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);

  return size;
}
