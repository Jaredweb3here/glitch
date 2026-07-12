import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useAnimatedNumber(value: number, duration = 620) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const frame = useRef<number>();

  useEffect(() => {
    const from = previous.current;
    const to = value;
    const start = performance.now();
    cancelAnimationFrame(frame.current ?? 0);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      previous.current = to;
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current ?? 0);
  }, [duration, value]);

  return display;
}
