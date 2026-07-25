'use client';

import * as React from 'react';

export type NumberFormat = 'count' | 'percent' | 'currency';

function formatValue(raw: number, format: NumberFormat): string {
  switch (format) {
    case 'percent':
      return `${Math.round(raw)}%`;
    case 'currency': {
      const rupees = Math.trunc(raw / 100);
      return `₹${rupees.toLocaleString('en-IN')}`;
    }
    case 'count':
    default:
      return Math.round(raw).toLocaleString('en-IN');
  }
}

/** Cubic ease-out — quick start, gentle settle. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

const DURATION_MS = 800;

/**
 * Counts up from its previous value to `value` on change. Respects
 * prefers-reduced-motion (Doc 07 accessibility) by jumping straight to the
 * final figure instead of animating. Pure rAF — no animation library.
 */
export function AnimatedNumber({ value, format }: { value: number; format: NumberFormat }) {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [display, setDisplay] = React.useState(reduceMotion ? value : 0);
  const previous = React.useRef(reduceMotion ? value : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      previous.current = value;
      return;
    }

    const from = previous.current;
    const delta = value - from;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      setDisplay(from + delta * easeOutCubic(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    previous.current = value;

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{formatValue(display, format)}</>;
}
